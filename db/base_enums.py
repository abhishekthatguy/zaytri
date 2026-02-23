"""
Zaytri — Base Enums
Core enum definitions shared across models and services.
"""

import enum

class ContentStatus(str, enum.Enum):
    DRAFT = "draft"
    REVIEWED = "reviewed"
    APPROVED = "approved"
    SCHEDULED = "scheduled"
    PUBLISHED = "published"
    FAILED = "failed"
    DELETED = "deleted"

class Platform(str, enum.Enum):
    INSTAGRAM = "instagram"
    FACEBOOK = "facebook"
    TWITTER = "twitter"
    YOUTUBE = "youtube"
    LINKEDIN = "linkedin"
    REDDIT = "reddit"
    MEDIUM = "medium"
    BLOGGER = "blogger"
    GMAIL = "gmail"

class PublishMode(str, enum.Enum):
    MANUAL = "manual"
    SCHEDULED = "scheduled"
    AI_AGENT = "ai_agent"
