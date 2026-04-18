"""
AI 对话服务 — 直接使用 OpenAI AsyncClient 调用 DashScope 兼容端点

架构：
  消息构建: 标准 OpenAI dict 格式（system / user / assistant）
  LLM 调用: AsyncOpenAI → DashScope OpenAI 兼容端点
  流式输出: client.chat.completions.create(stream=True) → SSE 事件流

动态 Prompt 逻辑：
  - 挂载了知识库 + 检索到内容  → 严格基于知识库回答
  - 挂载了知识库 + 未检索到内容 → 调用方直接短路，不进入本函数
  - 未挂载知识库               → 注入基础身份 System，模型自由回答
"""
import json
from openai import AsyncOpenAI
from app.core.config import settings

# DashScope OpenAI 兼容端点
DASHSCOPE_BASE_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1"

# 保留最近 N 轮历史，避免超出 context window
MAX_HISTORY_TURNS = 10

# 基础身份 Prompt
BASE_IDENTITY = (
    "你是 CorvusNote 的智能助手，一款专为笔记管理与知识检索设计的 AI 笔记应用。\n"
    "你的职责包括：帮助用户整理笔记、检索知识库内容、生成思维导图、回答与笔记相关的问题。\n"
    "重要指令：无论底层使用何种模型，你都应始终以'CorvusNote 助手'的身份与用户交流，绝对不允许透露或强调底层模型的名称或来源。\n"
    "禁止行为：永远不要提及'DeepSeek'、'Qwen'或任何其他模型名称，也不要提及任何公司或组织名称。\n"
    "回答风格：友好、专业，专注于帮助用户解决与笔记和知识管理相关的问题。\n"
    "核心指令：当用户问'你是谁'或类似问题时，你必须回答'我是 CorvusNote 的智能助手，一款专为笔记管理与知识检索设计的 AI 笔记应用。'，然后简要介绍你的功能，绝对不能提及任何其他身份。"
)


async def chat_stream(
    history: list[dict],
    message: str,
    context: str,
    model: str,
    kb_mounted: bool = False,
):
    """
    使用 AsyncOpenAI 直接调用 DashScope 兼容端点，流式输出。

    Yields SSE 行，格式：
        data: {"type": "content", "text": "..."}
        data: [DONE]

    Args:
        history:    历史消息列表 [{"role": "user"|"assistant", "content": "..."}]
        message:    当前用户输入
        context:   RAG 检索到的知识库上下文（空串则不注入）
        model:     DashScope 模型名称
        kb_mounted: 是否挂载了知识库（决定 System Prompt 策略）
    """

    # ── Step 1: 构建 System Prompt（动态策略）────────────────────
    if kb_mounted and context:
        system_content = (
            f"{BASE_IDENTITY}\n\n"
            "当前用户已挂载知识库，请严格基于以下【知识库内容】回答用户问题。\n\n"
            "规则：\n"
            "1. 只能使用知识库中明确存在的信息\n"
            "2. 不要推断、不要编造、不要补充知识库以外的内容\n"
            "3. 如果知识库中的信息不足以完整回答，如实说明\n\n"
            f"【知识库内容】\n{context}"
        )
    else:
        system_content = BASE_IDENTITY

    # ── Step 2: 构建标准 OpenAI 消息列表 ─────────────────────────
    openai_messages: list[dict] = [{"role": "system", "content": system_content}]

    recent_history = history[-(MAX_HISTORY_TURNS * 2):]
    for msg in recent_history:
        if msg.get("role") in ("user", "assistant"):
            openai_messages.append({"role": msg["role"], "content": msg["content"]})

    openai_messages.append({"role": "user", "content": message})

    # ── Step 3: 创建 AsyncOpenAI 客户端 ──────────────────────────
    client = AsyncOpenAI(
        api_key=settings.DASHSCOPE_API_KEY,
        base_url=DASHSCOPE_BASE_URL,
    )

    # ── Step 4: 流式调用 ───────────────────────────────
    response = await client.chat.completions.create(
        model=model,
        messages=openai_messages,
        stream=True,
    )

    async for chunk in response:
        if not chunk.choices:
            continue
        delta = chunk.choices[0].delta
        content = delta.content or ""
        if content:
            yield (
                f"data: {json.dumps({'type': 'content', 'text': content}, ensure_ascii=False)}\n\n"
            )

    yield "data: [DONE]\n\n"