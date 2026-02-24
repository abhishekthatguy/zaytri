"""
Zaytri — Document Ingestion Script (Smart Upsert, Hybrid V2)
Fetches Google Docs, detects content changes via content_hash,
and only re-embeds when content has actually changed.

Hybrid Architecture V2:
  - Free tier: Ollama nomic-embed-text (768D → padded to 1536D)
  - Pro tier:  OpenAI text-embedding-3-small (native 1536D)
  - Provider auto-selected based on OPENAI_API_KEY availability

Flow:
  IF content_hash changed:
      DELETE old embeddings for that source
      INSERT new embeddings via current embedding route
  ELSE:
      skip (no re-embed needed)
"""

import asyncio
import hashlib
import re
import requests
from datetime import datetime
from sqlalchemy import select, delete, func
from db.database import async_session
from db.settings_models import KnowledgeSource, DocumentEmbedding
import auth.models  # noqa: F401 — Register User model first
import db.models  # noqa: F401 — Register Content/ContentStatus models
import db.social_connections  # noqa: F401 — Register SocialConnection model
from brain.rag_engine import get_rag_engine


def compute_doc_hash(text: str) -> str:
    """Compute a stable hash for the entire document content."""
    return hashlib.sha256(text.encode("utf-8")).hexdigest()[:32]


async def main():
    async with async_session() as session:
        # Get all knowledge sources with URLs
        result = await session.execute(
            select(KnowledgeSource).where(KnowledgeSource.url.isnot(None))
        )
        sources = result.scalars().all()

        brands_to_reindex = {}  # brand_id -> list of source_ids that changed

        for source in sources:
            if "docs.google.com/document/d/" not in (source.url or ""):
                continue

            # Extract Document ID from Google Docs URL
            match = re.search(r"d/([a-zA-Z0-9_-]+)/", source.url)
            if not match:
                print(f"⚠️  Could not extract doc ID from: {source.url}")
                continue

            doc_id = match.group(1)
            export_url = f"https://docs.google.com/document/export?format=txt&id={doc_id}"
            print(f"📥 Fetching: {source.name} ({export_url[:60]}...)")

            try:
                resp = requests.get(export_url, timeout=30)
                resp.raise_for_status()
                text_content = resp.text.strip()
            except Exception as e:
                print(f"   ❌ Failed to fetch: {e}")
                continue

            if len(text_content) <= 10:
                print(f"   ⚠️  Content too short ({len(text_content)} chars), skipping")
                continue

            # Compute hash of new content
            new_hash = compute_doc_hash(text_content)

            # Compare with existing content hash
            old_hash = compute_doc_hash(source.content_summary or "")

            if new_hash == old_hash:
                print(f"   ✅ No changes detected for '{source.name}' — skipping")
                continue

            # Content changed! Update the source
            print(f"   🔄 Content changed for '{source.name}' (len: {len(text_content)})")
            source.content_summary = text_content
            source.last_indexed_at = datetime.utcnow()

            brand_id = str(source.brand_id)
            if brand_id not in brands_to_reindex:
                brands_to_reindex[brand_id] = []
            brands_to_reindex[brand_id].append(str(source.id))

        await session.commit()

        if not brands_to_reindex:
            print("\n✅ All documents up-to-date. No re-embedding needed.")
            return

        # Re-embed only brands with changed sources
        engine = get_rag_engine()

        # Log which embedding route is active
        from brain.embeddings import get_embedding_provider
        provider = get_embedding_provider()
        print(f"\n📡 Embedding Route: {provider.provider_name} / {provider.model_name} → {provider.dimension}D")

        for brand_id, changed_source_ids in brands_to_reindex.items():
            print(f"\n🔁 Re-indexing brand {brand_id}...")

            # DELETE old embeddings only for sources that changed
            for source_id in changed_source_ids:
                # Delete embeddings matching the source name of this knowledge source
                # (since knowledge_source_id might not always be set)
                source_obj = await session.get(KnowledgeSource, source_id)
                if source_obj:
                    deleted = await session.execute(
                        delete(DocumentEmbedding).where(
                            DocumentEmbedding.brand_id == brand_id,
                            DocumentEmbedding.source_name == source_obj.name,
                        )
                    )
                    print(f"   🗑  Deleted {deleted.rowcount} old embeddings for '{source_obj.name}'")

            await session.commit()

            # INSERT new embeddings
            res = await engine.embed_brand_knowledge(brand_id)
            print(f"   📊 Embedding results: {res}")

        print("\n🎉 Ingestion complete!")


if __name__ == "__main__":
    asyncio.run(main())
