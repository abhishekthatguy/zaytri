import asyncio
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine
from config import settings

async def main():
    engine = create_async_engine(settings.database_url)
    async with engine.begin() as conn:
        try:
            await conn.execute(text("ALTER TABLE social_connections ADD COLUMN brand_id UUID REFERENCES brand_settings(id) ON DELETE SET NULL"))
            print("Added brand_id column to social_connections.")
        except Exception as e:
            print("brand_id already exists or error:", e)

if __name__ == "__main__":
    asyncio.run(main())
