"""
Zaytri — Default Admin Seeder
Creates the default admin user on first startup if it doesn't exist.
"""

import logging
from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession

from auth.models import User
from config import settings
from auth.utils import hash_password

logger = logging.getLogger(__name__)

# ─── Default Admin Config ────────────────────────────────────────────────────
DEFAULT_ADMIN_EMAIL = settings.default_admin_email
DEFAULT_ADMIN_USERNAME = settings.default_admin_username
DEFAULT_ADMIN_PASSWORD = settings.default_admin_password


async def seed_default_user(db: AsyncSession) -> None:
    """Create the default admin user if it doesn't exist."""
    # Check both email and username to avoid unique constraint violations
    result = await db.execute(
        select(User).where(
            or_(
                User.email == DEFAULT_ADMIN_EMAIL,
                User.username == DEFAULT_ADMIN_USERNAME,
            )
        )
    )
    existing = result.scalar_one_or_none()

    if existing:
        if existing.email != DEFAULT_ADMIN_EMAIL:
            existing.email = DEFAULT_ADMIN_EMAIL
            existing.hashed_password = hash_password(DEFAULT_ADMIN_PASSWORD)
            await db.commit()
            logger.info(f"✅ Updated existing admin to use {DEFAULT_ADMIN_EMAIL}")
        else:
            logger.info(f"✅ Default admin already exists: {existing.email} / {existing.username}")
        return

    user = User(
        username=DEFAULT_ADMIN_USERNAME,
        email=DEFAULT_ADMIN_EMAIL,
        hashed_password=hash_password(DEFAULT_ADMIN_PASSWORD),
        is_active=True,
        is_admin=True,
        is_email_verified=True,
    )
    db.add(user)
    await db.commit()
    logger.info(f"✅ Default admin created: {DEFAULT_ADMIN_EMAIL} / {DEFAULT_ADMIN_USERNAME}")
