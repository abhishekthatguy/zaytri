import asyncio
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine
from config import settings

async def main():
    engine = create_async_engine(settings.database_url)
    async with engine.begin() as conn:
        try:
            await conn.execute(text("ALTER TABLE chat_messages ADD COLUMN model_used VARCHAR(100)"))
            print("Added model_used column.")
        except Exception as e:
            print("model_used already exists or error:", e)
        try:
            await conn.execute(text("ALTER TABLE chat_messages ADD COLUMN token_cost INTEGER"))
            print("Added token_cost column.")
        except Exception as e:
            print("token_cost already exists or error:", e)

if __name__ == "__main__":
    asyncio.run(main())
