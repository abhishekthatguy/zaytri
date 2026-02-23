# Zaytri RAG Architecture & Usage

The Zaytri system employs a **Multi-Layer RAG (Retrieval-Augmented Generation)** strategy designed to prevent LLM hallucinations, enforce brand voice, and provide context-aware automation.

The implementation is divided into two distinct sub-systems working in tandem:

## 1. Semantic Knowledge RAG (`RAGEngine`)
This is the primary Semantic RAG service responsible for injecting unstructured brand knowledge (brand guidelines, audience profiles, and custom uploaded documents) into the global conversational context.

**Implementation Details:**
- **Location:** `brain/rag_engine.py`
- **Primary Mechanism:** Vector embeddings stored in PostgreSQL using `pgvector`, queried via fast cosine similarity (`1 - (embedding <=> query_vec)`).
- **Fallback Mechanism:** A custom text-based similarity scoring system (term frequency overlap) ensuring resilience if vectors are uninitialized or unavailable.
- **Knowledge Ingestion (`embed_brand_knowledge`):** Chunks text from database `KnowledgeSource` tables and core `BrandSettings`, hashes them to prevent duplication across runs, and stores vectors using the active embedding provider.

**Where it is used:**
- **Master Orchestrator (`orchestration/master_orchestrator.py`):**
  - **Context Injection:** On every incoming chat message (if auth'd), the orchestrator fetches relevant semantic chunks via `build_rag_context()`. These chunks are seamlessly prepended to the LLM's system prompt.
  - **Hallucination Guard (`force_rag`):** If forced RAG is enabled for a task and no chunk passes the similarity threshold, the orchestrator actively blocks the LLM from attempting to answer, guaranteeing no hallucinated data escapes.
- **Observability CLI (`cli/rag_commands.py`):**
  - Exposes powerful pipeline visibility through commands like `rag-check` (database health checks), `rag-test` (evaluating retrieval accuracy), `rag-debug` (simulating the full prompt), and `embed` (manual ingestion trigger).

## 2. Structured Memory RAG (`BrandResolverRAG`)
This specialized layer acts as a Deterministic/Memory RAG. Instead of vector similarity, it rigorously pulls structured historical performance and state data from the database.

**Implementation Details:**
- **Location:** `brain/rag.py`
- **Mechanism:** Direct asynchronous SQLAlchemy queries across relational tables.
- **Context Pulled:**
  - **Content Memory:** Fetches the last 3 *Approved/Published* posts to maintain style continuity.
  - **Analytics Memory:** Fetches recent engagement metrics (likes, comments, reach) for the requested platform to inform the LLM of what performs well.
  - **Calendar Memory:** Retreives upcoming scheduled topics to maintain awareness and prevent repetitive topics.
  - **Explicit Guardrails:** Hard enforces tone and target audience definitions from settings.

**Where it is used:**
- **Content Drafting (`agents/content_creator.py`):**
  - Before generating any payload, the Agent calls `build_context(topic, platform, tone, brand)`.
  - It compiles the structured historical elements into an absolute `"=== BRAND & RAG MEMORY CONTEXT ==="` block, allowing the LLM to write highly accurate, historically-aligned content.

## Summary of Request Lifecycles
When a user asks "Write a tweet about our new launch":
1. The **Master Orchestrator** leverages **Semantic RAG** to inject high-level, semantic knowledge about the brand's identity into the intent parsing step.
2. The orchestrator delegates the task to the **Content Creator Agent**.
3. The **Content Creator Agent** leverages **Structured Memory RAG** to fetch the brand's exact past successful tweets, the current analytics, and the marketing calendar, injecting this concrete history into the generation prompt.
