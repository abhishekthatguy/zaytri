import asyncio
import os
import sys

# Add the project directory to sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from db.database import engine, Base
from auth.models import User
from db.settings_models import BrandSettings

async def main():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("Created brand_settings table.")

if __name__ == "__main__":
    asyncio.run(main())
