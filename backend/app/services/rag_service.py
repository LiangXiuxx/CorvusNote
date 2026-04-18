"""
RAG 检索服务 — LangChain LCEL 集成版

LangChain 集成点：
  - TongyiEmbeddings 继承 langchain_core.embeddings.Embeddings 基类
  - RecursiveCharacterTextSplitter（langchain_text_splitters）文本分块
  - FAISS（langchain_community.vectorstores）向量存储与持久化
  - ChatOpenAI（langchain_openai）作为 Runnable LLM 抽象
  - ChatPromptTemplate | ChatOpenAI | StrOutputParser — LCEL 链（query rewrite）
  - VectorStoreRetriever.ainvoke()（LangChain Retriever 接口）用于异步检索
  - Rerank（qwen3-vl-rerank）：DashScope 私有 API，无 LangChain 封装，保留 httpx 调用

架构：
  上传：文件 → RecursiveCharacterTextSplitter → TongyiEmbeddings → FAISS.from_texts → 磁盘
  查询：FAISS.load_local → merge_from → as_retriever → LCEL rewrite → ainvoke → rerank → 上下文
"""
import os
import json
import shutil
from dataclasses import dataclass, asdict
from typing import Optional

import httpx
from langchain_core.embeddings import Embeddings
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_openai import ChatOpenAI
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import FAISS
from app.core.config import settings


# ══════════════════════════════════════════════════════
# Embedding 模型
# ══════════════════════════════════════════════════════

EMBEDDING_MODEL = "tongyi-embedding-vision-flash-2026-03-06"
_EMBED_ENDPOINT = "https://dashscope.aliyuncs.com/compatible-mode/v1/embeddings"
_EMBED_BATCH = 25   # DashScope 单批次最大文本数


class TongyiEmbeddings(Embeddings):
    """
    DashScope Tongyi Embedding 实现（兼容 OpenAI embeddings 接口）。
    使用 httpx 同步客户端，与 FAISS 同步调用保持一致。
    """

    def __init__(self, model: str, api_key: str):
        self.model = model
        self.api_key = api_key

    def _embed_batch(self, texts: list[str]) -> list[list[float]]:
        with httpx.Client(timeout=60.0) as client:
            resp = client.post(
                _EMBED_ENDPOINT,
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": self.model,
                    "input": texts,
                    "encoding_format": "float",
                },
            )
            resp.raise_for_status()
        items = sorted(resp.json()["data"], key=lambda x: x["index"])
        return [item["embedding"] for item in items]

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        result = []
        for i in range(0, len(texts), _EMBED_BATCH):
            result.extend(self._embed_batch(texts[i : i + _EMBED_BATCH]))
        return result

    def embed_query(self, text: str) -> list[float]:
        return self._embed_batch([text])[0]


def _get_embeddings() -> TongyiEmbeddings:
    return TongyiEmbeddings(model=EMBEDDING_MODEL, api_key=settings.DASHSCOPE_API_KEY)


# ══════════════════════════════════════════════════════
# RAG 策略
# ══════════════════════════════════════════════════════

@dataclass
class RAGStrategy:
    chunk_size: int = 500
    chunk_overlap: int = 50
    top_k: int = 4           # 最终返回给 LLM 的 chunk 数
    retrieve_k: int = 10     # 检索候选数（rerank 前的粗检）
    score_threshold: float = 1.0   # FAISS L2 距离阈值，越小越严格
    enable_rewrite: bool = True
    enable_rerank: bool = True


def auto_detect_strategy(content: str, filename: str) -> RAGStrategy:
    """根据文件大小和类型自动推断最优 RAG 策略"""
    size = len(content)
    ext = os.path.splitext(filename)[1].lower()
    is_markdown = ext in (".md", ".markdown")

    if size < 5_000:
        s = RAGStrategy(chunk_size=200, chunk_overlap=30, top_k=3, retrieve_k=8, score_threshold=1.2)
    elif size < 50_000:
        s = RAGStrategy(chunk_size=500, chunk_overlap=50, top_k=4, retrieve_k=10, score_threshold=1.0)
    else:
        s = RAGStrategy(chunk_size=800, chunk_overlap=100, top_k=5, retrieve_k=12, score_threshold=0.9)

    # Markdown 文件：保持默认分隔符即可，只修改备注
    _ = is_markdown  # 占位，后续分隔符在 build 时单独处理
    return s


# ══════════════════════════════════════════════════════
# FAISS 内存缓存（进程内，按 kb_id 缓存已加载的向量索引）
# ══════════════════════════════════════════════════════

_index_cache: dict[str, "FAISS"] = {}


def _load_store_cached(kb_id: str, embeddings) -> "FAISS | None":
    """从缓存或磁盘加载 FAISS 索引，加载后写入内存缓存。"""
    if kb_id in _index_cache:
        return _index_cache[kb_id]
    index_dir = _index_dir(kb_id)
    if not os.path.isdir(index_dir):
        return None
    store = FAISS.load_local(index_dir, embeddings, allow_dangerous_deserialization=True)
    _index_cache[kb_id] = store
    return store


def _invalidate_cache(kb_id: str) -> None:
    _index_cache.pop(kb_id, None)


def _index_dir(kb_id: str) -> str:
    return os.path.join(settings.VECTOR_STORE_DIR, kb_id)


def _strategy_path(kb_id: str) -> str:
    return os.path.join(_index_dir(kb_id), "strategy.json")


def _save_strategy(kb_id: str, strategy: RAGStrategy) -> None:
    with open(_strategy_path(kb_id), "w", encoding="utf-8") as f:
        json.dump(asdict(strategy), f, ensure_ascii=False, indent=2)


def _load_strategy(kb_id: str) -> RAGStrategy:
    path = _strategy_path(kb_id)
    if os.path.exists(path):
        with open(path, encoding="utf-8") as f:
            data = json.load(f)
        return RAGStrategy(**{k: v for k, v in data.items() if k in RAGStrategy.__dataclass_fields__})
    return RAGStrategy()


# ══════════════════════════════════════════════════════
# Query Rewrite
# ══════════════════════════════════════════════════════

_REWRITE_PROMPT = ChatPromptTemplate.from_messages([
    (
        "human",
        "将以下问题改写为适合文档检索的关键词或简洁短句，"
        "要求语义完整、去除口语化表达。"
        "只输出改写结果，不要任何解释：\n{question}",
    )
])

# LangChain LCEL 链：ChatPromptTemplate | ChatOpenAI | StrOutputParser
# 使用 DashScope OpenAI 兼容端点，qwen3.5-flash 负责 query rewrite
# ⚠️ 必须显式传 enable_thinking=False：
#    Qwen3 系列在 DashScope 默认开启思考模式���若��关闭，
#    改写一条查询就要额外等待 1~2 秒（thinking tokens 不可见但占用时间）。
_rewrite_llm = ChatOpenAI(
    model="qwen3.5-flash",
    base_url="https://dashscope.aliyuncs.com/compatible-mode/v1",
    api_key=settings.DASHSCOPE_API_KEY,
    max_tokens=100,
    temperature=0,
)
_rewrite_chain = _REWRITE_PROMPT | _rewrite_llm | StrOutputParser()


async def rewrite_query(question: str) -> str:
    """
    用 LCEL 链（ChatPromptTemplate | ChatOpenAI | StrOutputParser）
    将口语化问题改写为检索友好的简洁短句。失败时降级返回原始问题。
    """
    try:
        rewritten = await _rewrite_chain.ainvoke({"question": question})
        rewritten = rewritten.strip()
        return rewritten if rewritten else question
    except Exception as e:
        print(f"[RAG] Query Rewrite 失败，使用原始问题: {e}")
        return question


# ══════════════════════════════════════════════════════
# Rerank
# ══════════════════════════════════════════════════════

_RERANK_ENDPOINT = "https://dashscope.aliyuncs.com/api/v1/services/rerank/text-rerank/text-rerank"
_RERANK_MODEL = "qwen3-vl-rerank"


async def rerank_documents(query: str, documents: list[str], top_n: int = 4) -> list[str]:
    """用 qwen3-vl-rerank 对候选 chunk 重排序，返回最相关的 top_n 个。失败时按原顺序截取。"""
    if not documents:
        return []
    top_n = min(top_n, len(documents))
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                _RERANK_ENDPOINT,
                headers={
                    "Authorization": f"Bearer {settings.DASHSCOPE_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": _RERANK_MODEL,
                    "input": {
                        "query": query,
                        "documents": documents,
                    },
                    "parameters": {
                        "top_n": top_n,
                        "return_documents": True,
                    },
                },
            )
            resp.raise_for_status()
        results = resp.json()["output"]["results"]
        return [r["document"]["text"] for r in results]
    except Exception as e:
        print(f"[RAG] Rerank 失败，按原顺序返回: {e}")
        return documents[:top_n]


# ══════════════════════════════════════════════════════
# 构建索引
# ══════════════════════════════════════════════════════

def build_and_save_index(
    kb_id: str,
    file_content: str,
    file_name: str,
    strategy: Optional[RAGStrategy] = None,
) -> None:
    """
    对文件内容分块、向量化，将 FAISS 索引和 strategy.json 持久化到磁盘。
    在知识库文件上传成功后调用一次，后续查询直接加载磁盘索引。

    Args:
        kb_id:        MongoDB 知识库记录的 _id 字符串
        file_content: 文件全文（已解码的纯文本）
        file_name:    文件名（用于日志和策略自动推断）
        strategy:     RAG 策略；None 表示自动推断

    Raises:
        ValueError: 文件内容为空
        Exception:  Embedding API 或磁盘写入失败时向上抛出
    """
    if strategy is None:
        strategy = auto_detect_strategy(file_content, file_name)

    # Markdown 文件优先按标题切分
    ext = os.path.splitext(file_name)[1].lower()
    if ext in (".md", ".markdown"):
        separators = ["## ", "# ", "\n\n", "\n", "。", "！", "？", ".", " ", ""]
    else:
        separators = ["\n\n", "\n", "。", "！", "？", ".", " ", ""]

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=strategy.chunk_size,
        chunk_overlap=strategy.chunk_overlap,
        separators=separators,
    )
    chunks = splitter.split_text(file_content)

    if not chunks:
        raise ValueError(f"文件 [{file_name}] 内容为空，无法构建向量索引")

    print(
        f"[RAG] [{file_name}] 分块完成，共 {len(chunks)} 个片段"
        f"（chunk_size={strategy.chunk_size}, overlap={strategy.chunk_overlap}）"
    )

    embeddings = _get_embeddings()
    vectorstore = FAISS.from_texts(chunks, embeddings)
    print(f"[RAG] [{file_name}] 向量化完成")

    index_dir = _index_dir(kb_id)
    os.makedirs(index_dir, exist_ok=True)
    vectorstore.save_local(index_dir)
    _save_strategy(kb_id, strategy)
    print(f"[RAG] [{file_name}] 索引已保存至: {index_dir}")


# ══════════════════════════════════════════════════════
# 检索
# ══════════════════════════════════════════════════════

async def retrieve_context_by_ids(kb_ids: list[str], question: str) -> str:
    """
    从磁盘加载 FAISS 索引，依次执行：
      1. Query Rewrite  — LCEL 链改写问题，提升召回率
      2. LangChain Retriever 检索 — as_retriever().ainvoke() 取候选 chunk
      3. Rerank         — qwen3-vl-rerank 精选 top_k 个

    Returns:
        拼接后的上下文字符串；若无相关结果则返回空串（调用方据此判断是否短路）

    Raises:
        Exception: 索引文件损坏或 API 调用失败
    """
    if not kb_ids:
        return ""

    # ── 加载所有 kb 的索引 + 合并策略参数 ───────────────────────
    embeddings = _get_embeddings()
    merged_store: FAISS | None = None
    max_retrieve_k = 10
    max_top_k = 4
    enable_rewrite = False
    enable_rerank = False

    for kb_id in kb_ids:
        if not os.path.isdir(_index_dir(kb_id)):
            print(f"[RAG] 索引目录不存在，跳过: {kb_id}")
            continue

        strategy = _load_strategy(kb_id)
        max_retrieve_k = max(max_retrieve_k, strategy.retrieve_k)
        max_top_k = max(max_top_k, strategy.top_k)
        enable_rewrite = enable_rewrite or strategy.enable_rewrite
        enable_rerank = enable_rerank or strategy.enable_rerank

        store = _load_store_cached(kb_id, embeddings)
        if store is None:
            continue
        if merged_store is None:
            merged_store = store
        else:
            merged_store.merge_from(store)

    if merged_store is None:
        print("[RAG] 没有可用的向量索引，返回空上下文")
        return ""

    # ── Step 1: Query Rewrite（LCEL 链）──────────────────────────
    search_question = question
    if enable_rewrite:
        search_question = await rewrite_query(question)
        print(f"[RAG] 改写问题: {question!r} → {search_question!r}")

    # ── Step 2: LangChain Retriever 接口异步检索 ─────────────────
    # as_retriever() 将 FAISS VectorStore 转换为 LangChain BaseRetriever，
    # 支持 Runnable 接口（invoke / ainvoke / astream），可直接嵌入 LCEL 链
    retriever = merged_store.as_retriever(
        search_type="similarity",
        search_kwargs={"k": max_retrieve_k},
    )
    retrieved_docs = await retriever.ainvoke(search_question)

    if not retrieved_docs:
        print("[RAG] 检索结果为空，返回空上下文")
        return ""

    candidate_texts = [doc.page_content for doc in retrieved_docs]
    print(f"[RAG] 检索到候选 chunk 数: {len(candidate_texts)}")

    # ── Step 3: Rerank ────────────────────────────────────────
    if enable_rerank:
        reranked = await rerank_documents(question, candidate_texts, top_n=max_top_k)
    else:
        reranked = candidate_texts[:max_top_k]

    context = "\n\n".join(reranked)
    print(f"[RAG] 最终返回 {len(reranked)} 个相关片段")
    return context


# ══════════════════════════════════════════════════════
# 删除索引
# ══════════════════════════════════════════════════════

def delete_index(kb_id: str) -> None:
    """删除指定知识库的向量索引目录（含 strategy.json），并清除内存缓存。"""
    _invalidate_cache(kb_id)
    index_dir = _index_dir(kb_id)
    if os.path.isdir(index_dir):
        shutil.rmtree(index_dir)
        print(f"[RAG] 已删除向量索引: {index_dir}")