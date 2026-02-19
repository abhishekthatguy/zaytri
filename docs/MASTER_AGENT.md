# Master Agent — Architecture & Features

## Identity

**Zaytri** is an AI automation system built by **Abhishek Singh (Avii)**, an AI enthusiast and automation architect.

- **Never** claims to be a human or OpenAI
- **Always** identifies as Zaytri built by Avii
- Responds in the **same language** the user writes in

---

## Architecture

```
User (Text/Voice)
     │
     ▼
POST /chat API
     │
     ▼
┌────────────────────────────────────────────┐
│              MasterAgent                    │
│                                            │
│  1. Identity Fast-Path                     │
│     "who are you?" → instant offline reply │
│                                            │
│  2. LLM Call with Fallback Chain           │
│     Primary LLM → Fallback providers →     │
│     DEFAULT_INTRO_MESSAGE                  │
│                                            │
│  3. Intent Classification (18 intents)     │
│     JSON: {intent, params, response}       │
│                                            │
│  4. ActionExecutor                         │
│     Routes intent → system handler         │
│                                            │
│  5. User Memory                            │
│     Tracks patterns per user               │
└────────────────────────────────────────────┘
     │
     ▼
Natural Language Response
```

---

## Multi-Layer Fallback Protection

The Master Agent **never** exposes raw errors. If all LLMs fail, it responds with a hardcoded default message.

```python
# Fallback Chain:
try:
    response = primary_llm.generate(...)        # Configured master_agent LLM
except:
    for provider in [ollama, openai, gemini, anthropic, groq]:
        try:
            response = provider.generate(...)   # Try each available provider
            break
        except:
            continue
    else:
        response = DEFAULT_INTRO_MESSAGE        # Hardcoded, always works
```

**Provider priority:** `ollama` → `openai` → `gemini` → `anthropic` → `groq`

---

## Identity Knowledge Base

### Trigger Patterns
The following patterns are detected **without any LLM call** (regex):

| Pattern | Example |
|---|---|
| `who are you` | "Who are you?" |
| `introduce yourself` | "Can you introduce yourself?" |
| `what can you do` | "What can you do for me?" |
| `who built you` | "Who built you?" / "Who created you?" |
| `what are you` | "What are you exactly?" |
| `what is zaytri` | "What is Zaytri?" |
| `tum kaun ho` | "तुम कौन हो?" (Hindi) |
| `tum kya kar sakte ho` | "तुम क्या कर सकते हो?" (Hindi) |
| `apna introduction do` | "अपना introduction दो" (Hindi) |

### Default Response Template
```
I am Zaytri, an AI automation system built by Abhishek Singh (Avii).
As of [current date], I am actively running with multi-agent orchestration
capabilities and learning day by day.

I can:
• Generate and schedule social media content
• Automate workflows across platforms
• Analyze engagement patterns
• Respond to comments automatically
• Integrate with Instagram, Facebook, Twitter, YouTube
• Coordinate multiple AI models including Ollama, ChatGPT, and Gemini

Tell me what you'd like to automate or improve today.
```

---

## User Memory & Pattern Tracking

The `UserMemory` class tracks per-user interaction patterns in-memory:

| Field | Description |
|---|---|
| `intent_counts` | Counter of how often each intent was used |
| `topics` | Last 50 workflow topics requested |
| `preferred_platform` | Most recently used platform |
| `preferred_tone` | Most recently used tone |
| `message_count` | Total messages sent |
| `first_seen` / `last_seen` | Timestamps |

**How it's used:** The memory context is injected into the system prompt so the LLM can personalize responses:

```
USER CONTEXT: User has sent 12 messages. Frequent intents: run_workflow(5), list_content(3).
Recent topics: AI trends, Marketing tips. Preferred platform: instagram.
```

---

## 18 Supported Intents

| # | Intent | Params | Description |
|---|---|---|---|
| 1 | `introduce` | — | Self-introduction with identity & capabilities |
| 2 | `assign_llm_key` | provider, api_key | Save API key |
| 3 | `delete_llm_key` | provider | Remove API key |
| 4 | `test_provider` | provider | Test LLM connectivity |
| 5 | `assign_agent_model` | agent_id, provider, model | Assign LLM to agent |
| 6 | `reset_agent_model` | agent_id | Reset to Ollama default |
| 7 | `switch_all_agents` | provider, model | Batch switch all agents |
| 8 | `run_workflow` | topic, platform, tone | Create content |
| 9 | `update_cron` | cron fields | Change schedule |
| 10 | `get_system_status` | — | System health & stats |
| 11 | `list_content` | status, platform, limit | List content |
| 12 | `approve_content` | content_id | Approve content |
| 13 | `delete_content` | content_id | Delete content |
| 14 | `list_providers` | — | Show LLM providers |
| 15 | `list_agents` | — | Show agent configs |
| 16 | `get_settings` | — | Show cron/settings |
| 17 | `help` | — | Show capabilities |
| 18 | `general_chat` | — | Freeform conversation |

---

## Scripts

| Script | Purpose |
|---|---|
| `./scripts/start.sh` | Start all services (reads ports from .env) |
| `./scripts/stop.sh` | Kill all Zaytri processes |
| `./scripts/stop.sh --flush-redis` | Kill processes + flush Redis cache |
| `./scripts/build.sh` | Run all tests, then build frontend |
| `./scripts/build.sh --tests-only` | Run tests without building |
| `./scripts/build.sh --skip-tests` | Build without running tests |

---

## Port Configuration

All ports are configurable via `.env`:

```env
BACKEND_PORT=8002
FRONTEND_PORT=3009
REDIS_PORT=6379
POSTGRES_PORT=5432
OLLAMA_PORT=11434
```

Change the ports and run `./scripts/start.sh` — everything adapts automatically.
