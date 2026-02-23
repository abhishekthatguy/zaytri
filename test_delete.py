
import asyncio
from sqlalchemy import select
from db.database import async_session
from db.models import Content
from api.content import delete_content
from uuid import UUID

async def test():
    async with async_session() as db:
        content_id = UUID('f17a1969-3f4d-499a-80f1-293b44a73d87')
        try:
             # Simulate the router logic
             result = await db.execute(select(Content).where(Content.id == content_id))
             content = result.scalar_one_or_none()
             if content:
                 print(f"Found content: {content.topic}")
                 from db.models import ContentStatus
                 from datetime import datetime
                 content.status = ContentStatus.DELETED
                 content.deleted_at = datetime.utcnow()
                 await db.commit()
                 print("Success")
             else:
                 print("Not found")
        except Exception as e:
            print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(test())
