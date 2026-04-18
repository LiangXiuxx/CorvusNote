"""
对话 API — 统一入口，整合 RAG 检索 + LangChain 消息封装 + SSE 流式输出
"""
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List
from app.api.auth import get_current_user
from app.services.rag_service import retrieve_context_by_ids
from app.services.ai_service import chat_stream

router = APIRouter(prefix="/api/chat", tags=["chat"])

_NOT_FOUND_IN_KB = (
    "根据已挂载的知识库，未找到与您问题相关的内容。\n\n"
    "建议：\n"
    "- 换一种表述方式重新提问\n"
    "- 确认知识库中是否包含该主题\n"
    "- 卸载知识库后直接向 AI 提问"
)


class ChatRequest(BaseModel):
    history: List[dict] = []          # 历史消息 [{"role": "...", "content": "..."}]
    message: str                       # 当前用户输入
    kb_ids: List[str] = []            # 挂载的知识库 ID 列表（MongoDB _id 字符串）
    model: str = "qwen3.5-flash"       # DashScope 模型名


class InvokeRequest(BaseModel):
    """用于非流式调用（如思维导图生成）"""
    messages: List[dict]               # [{"role": "user", "content": "..."}]
    model: str = "deepseek-v3.2"


@router.post("/stream")
async def stream_chat(
    request: ChatRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    流式对话接口 — SSE 格式输出

    整合流程：
    1. RAG 检索：Query Rewrite → FAISS 检索 → 分数过滤 → Rerank
    2. 动态 Prompt：
       - 有知识库且找到内容 → 严格基于 KB 回答
       - 有知识库但未找到  → 直接返回"未找到"，不调用 LLM
       - 无知识库           → 直接调用 LLM
    3. DashScope SSE 流式输出
    """
    kb_mounted = len(request.kb_ids) > 0
    context = ""

    # Step 1: RAG 检索（仅在挂载了知识库时执行）
    if kb_mounted:
        try:
            context = await retrieve_context_by_ids(request.kb_ids, request.message)
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"RAG 检索失败: {str(e)}",
            )

        # 挂载了知识库但未检索到相关内容 → 直接短路返回，不调用 LLM
        if not context:
            import json

            async def not_found_generator():
                yield (
                    f"data: {json.dumps({'type': 'content', 'text': _NOT_FOUND_IN_KB}, ensure_ascii=False)}\n\n"
                )
                yield "data: [DONE]\n\n"

            return StreamingResponse(
                not_found_generator(),
                media_type="text/event-stream",
                headers={
                    "Cache-Control": "no-cache",
                    "X-Accel-Buffering": "no",
                    "Connection": "keep-alive",
                },
            )

    # Step 2 + 3: 构建消息并流式输出
    async def generate():
        try:
            async for chunk in chat_stream(
                history=request.history,
                message=request.message,
                context=context,
                model=request.model,
                kb_mounted=kb_mounted,
            ):
                yield chunk
        except Exception as e:
            import json
            yield f"data: {json.dumps({'type': 'error', 'text': str(e)}, ensure_ascii=False)}\n\n"
            yield "data: [DONE]\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


@router.post("/invoke")
async def invoke_chat(
    request: InvokeRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    非流式调用接口 — 用于思维导图等需要完整响应的场景
    收集 SSE 流的所有内容后一次性返回
    """
    full_content = ""
    full_reasoning = ""

    async for chunk in chat_stream(
        history=request.messages[:-1],
        message=request.messages[-1]["content"] if request.messages else "",
        context="",
        model=request.model,
        kb_mounted=False,
    ):
        if not chunk.startswith("data: ") or chunk.strip() == "data: [DONE]":
            continue
        import json
        try:
            parsed = json.loads(chunk[6:])
            if parsed.get("type") == "content":
                full_content += parsed.get("text", "")
            elif parsed.get("type") == "reasoning":
                full_reasoning += parsed.get("text", "")
        except json.JSONDecodeError:
            pass

    return {"content": full_content, "reasoning": full_reasoning}
