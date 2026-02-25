---
description: How to update knowledge sources and test RAG after modifying brand documents
---

# RAG Knowledge Update & Testing Workflow

// turbo-all

## How It Works (Automatic)

When you run `./zaytri embed --brand "clawtbot"`, the system **automatically**:

1. ✅ **Fetches latest content** from each knowledge source URL (Google Docs, etc.)
2. ✅ **Detects changes** by comparing content hashes
3. ✅ **Updates DB** with fresh content_summary
4. ✅ **Chunks** the new content
5. ✅ **Embeds** via Ollama nomic-embed-text
6. ✅ **Updates vector_count** on each knowledge source

**No manual SQL required.** Just edit your Google Doc and run embed.

---

## Step-by-Step

### Step 1: Edit your Google Doc
Make changes directly in Google Docs. The doc must be publicly shared (Anyone with the link → Viewer).

### Step 2: Re-embed (auto-syncs from Google Docs)
```bash
./zaytri embed --brand "clawtbot"
```

### Step 3: Verify retrieval
```bash
./zaytri rag-test --brand "clawtbot" --query "YOUR TEST QUESTION"
```

Check:
- Sufficient Context: **Yes**
- At least one score ≥ 0.6
- The relevant chunk appears in results

### Step 4: Health check (optional)
```bash
./zaytri rag-check --brand "clawtbot"
```

### Step 5: Test in Master Agent Chat
1. Open http://localhost:3000/chat
2. Select brand "clawtbot"
3. Ensure **Brand Memory** toggle is ON
4. Ask your question

---

## Force Full Re-embed (if needed)

If embeddings seem stale or corrupted:

```bash
# Clear all embeddings for brand
psql -d zaytri_db -c "DELETE FROM document_embeddings WHERE brand_id = '019584b4-48c5-467d-8f1e-baafafe7e77a'; UPDATE knowledge_sources SET vector_count = 0 WHERE brand_id = '019584b4-48c5-467d-8f1e-baafafe7e77a';"

# Re-embed fresh
./zaytri embed --brand "clawtbot"
```

---

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| Embed says "Skipped: N" | Content hash unchanged | Content hasn't changed in the Google Doc |
| Scores < 0.6 | Query doesn't match content | Rephrase query, or content may not cover this topic |
| All vectors are `[0.0, ...]` | Ollama model missing | `ollama pull nomic-embed-text` |
| Master Agent ignores RAG | Brand Memory OFF | Toggle Brand Memory ON in chat sidebar |
| `gkpj` error | Model registration | Ensure `import db.register_models` is first DB import |
| HTTP 403 fetching doc | Doc not public | Share Google Doc as "Anyone with the link → Viewer" |
