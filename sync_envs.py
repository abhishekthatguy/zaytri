import re

template = """# =============================================================================
# Zaytri — Environment Configuration
# =============================================================================

# ─── Service Ports ───────────────────────────────────────────────────────────
BACKEND_PORT={BACKEND_PORT}
FRONTEND_PORT={FRONTEND_PORT}
REDIS_PORT={REDIS_PORT}
POSTGRES_PORT={POSTGRES_PORT}
OLLAMA_PORT={OLLAMA_PORT}

# ─── Database (PostgreSQL) ───────────────────────────────────────────────────
POSTGRES_USER={POSTGRES_USER}
POSTGRES_PASSWORD={POSTGRES_PASSWORD}
POSTGRES_DB={POSTGRES_DB}
DATABASE_URL={DATABASE_URL}
DATABASE_URL_SYNC={DATABASE_URL_SYNC}

# ─── Redis ───────────────────────────────────────────────────────────────────
REDIS_URL={REDIS_URL}
REDIS_PASSWORD={REDIS_PASSWORD}
FLUSH_REDIS_ON_START={FLUSH_REDIS_ON_START}

# ─── Ollama (Local LLM) ─────────────────────────────────────────────────────
OLLAMA_HOST={OLLAMA_HOST}
OLLAMA_MODEL={OLLAMA_MODEL}

# ─── Frontend / API URL ──────────────────────────────────────────────────────
NEXT_PUBLIC_API_URL={NEXT_PUBLIC_API_URL}

# ─── JWT Authentication ─────────────────────────────────────────────────────
JWT_SECRET_KEY={JWT_SECRET_KEY}
JWT_ALGORITHM={JWT_ALGORITHM}
JWT_ACCESS_TOKEN_EXPIRE_MINUTES={JWT_ACCESS_TOKEN_EXPIRE_MINUTES}

# ─── Default Admin (seed script credentials) ─────────────────────────────────
DEFAULT_ADMIN_EMAIL={DEFAULT_ADMIN_EMAIL}
DEFAULT_ADMIN_USERNAME={DEFAULT_ADMIN_USERNAME}
DEFAULT_ADMIN_PASSWORD={DEFAULT_ADMIN_PASSWORD}

# ─── Cron Schedule Overrides (optional) ──────────────────────────────────────
# SCHEDULER_CRON_HOUR=9
# SCHEDULER_CRON_MINUTE=0
# ENGAGEMENT_DELAY_HOURS=2
# ANALYTICS_CRON_DAY_OF_WEEK=1
# ANALYTICS_CRON_HOUR=8
# TIMEZONE=Asia/Kolkata

# ─── Instagram Graph API ────────────────────────────────────────────────────
INSTAGRAM_ACCESS_TOKEN={INSTAGRAM_ACCESS_TOKEN}
INSTAGRAM_BUSINESS_ACCOUNT_ID={INSTAGRAM_BUSINESS_ACCOUNT_ID}
INSTAGRAM_APP_SECRET={INSTAGRAM_APP_SECRET}

# ─── Facebook Graph API ─────────────────────────────────────────────────────
FACEBOOK_ACCESS_TOKEN={FACEBOOK_ACCESS_TOKEN}
FACEBOOK_PAGE_ID={FACEBOOK_PAGE_ID}
FACEBOOK_APP_SECRET={FACEBOOK_APP_SECRET}

# ─── Twitter / X API ────────────────────────────────────────────────────────
TWITTER_API_KEY={TWITTER_API_KEY}
TWITTER_API_SECRET={TWITTER_API_SECRET}
TWITTER_ACCESS_TOKEN={TWITTER_ACCESS_TOKEN}
TWITTER_ACCESS_TOKEN_SECRET={TWITTER_ACCESS_TOKEN_SECRET}
TWITTER_BEARER_TOKEN={TWITTER_BEARER_TOKEN}

# ─── YouTube Data API ───────────────────────────────────────────────────────
YOUTUBE_API_KEY={YOUTUBE_API_KEY}
YOUTUBE_CLIENT_ID={YOUTUBE_CLIENT_ID}
YOUTUBE_CLIENT_SECRET={YOUTUBE_CLIENT_SECRET}
YOUTUBE_REFRESH_TOKEN={YOUTUBE_REFRESH_TOKEN}

# ─── OAuth — User Login ─────────────────────────────────────────────────────
OAUTH_GOOGLE_CLIENT_ID={OAUTH_GOOGLE_CLIENT_ID}
OAUTH_GOOGLE_CLIENT_SECRET={OAUTH_GOOGLE_CLIENT_SECRET}
OAUTH_FACEBOOK_APP_ID={OAUTH_FACEBOOK_APP_ID}
OAUTH_FACEBOOK_APP_SECRET={OAUTH_FACEBOOK_APP_SECRET}
OAUTH_GITHUB_CLIENT_ID={OAUTH_GITHUB_CLIENT_ID}
OAUTH_GITHUB_CLIENT_SECRET={OAUTH_GITHUB_CLIENT_SECRET}
OAUTH_TWITTER_CLIENT_ID={OAUTH_TWITTER_CLIENT_ID}
OAUTH_TWITTER_CLIENT_SECRET={OAUTH_TWITTER_CLIENT_SECRET}

# ─── OAuth — Social Platforms (Connect flows) ───────────────────────────────
OAUTH_LINKEDIN_CLIENT_ID={OAUTH_LINKEDIN_CLIENT_ID}
OAUTH_LINKEDIN_CLIENT_SECRET={OAUTH_LINKEDIN_CLIENT_SECRET}
OAUTH_REDDIT_CLIENT_ID={OAUTH_REDDIT_CLIENT_ID}
OAUTH_REDDIT_CLIENT_SECRET={OAUTH_REDDIT_CLIENT_SECRET}
OAUTH_MEDIUM_CLIENT_ID={OAUTH_MEDIUM_CLIENT_ID}
OAUTH_MEDIUM_CLIENT_SECRET={OAUTH_MEDIUM_CLIENT_SECRET}

# ─── WhatsApp Business API ──────────────────────────────────────────────────
WHATSAPP_ACCESS_TOKEN={WHATSAPP_ACCESS_TOKEN}
WHATSAPP_PHONE_NUMBER_ID={WHATSAPP_PHONE_NUMBER_ID}
WHATSAPP_VERIFY_TOKEN={WHATSAPP_VERIFY_TOKEN}
WHATSAPP_APPROVAL_PHONE={WHATSAPP_APPROVAL_PHONE}

# ─── Application ─────────────────────────────────────────────────────────────
APP_NAME={APP_NAME}
APP_ENV={APP_ENV}
APP_DEBUG={APP_DEBUG}
LOG_LEVEL={LOG_LEVEL}
CORS_ORIGINS={CORS_ORIGINS}
"""

all_keys = [
    "BACKEND_PORT", "FRONTEND_PORT", "REDIS_PORT", "POSTGRES_PORT", "OLLAMA_PORT",
    "POSTGRES_USER", "POSTGRES_PASSWORD", "POSTGRES_DB", "DATABASE_URL", "DATABASE_URL_SYNC",
    "REDIS_URL", "REDIS_PASSWORD", "FLUSH_REDIS_ON_START",
    "OLLAMA_HOST", "OLLAMA_MODEL", "NEXT_PUBLIC_API_URL",
    "JWT_SECRET_KEY", "JWT_ALGORITHM", "JWT_ACCESS_TOKEN_EXPIRE_MINUTES",
    "DEFAULT_ADMIN_EMAIL", "DEFAULT_ADMIN_USERNAME", "DEFAULT_ADMIN_PASSWORD",
    "INSTAGRAM_ACCESS_TOKEN", "INSTAGRAM_BUSINESS_ACCOUNT_ID", "INSTAGRAM_APP_SECRET",
    "FACEBOOK_ACCESS_TOKEN", "FACEBOOK_PAGE_ID", "FACEBOOK_APP_SECRET",
    "TWITTER_API_KEY", "TWITTER_API_SECRET", "TWITTER_ACCESS_TOKEN", "TWITTER_ACCESS_TOKEN_SECRET", "TWITTER_BEARER_TOKEN",
    "YOUTUBE_API_KEY", "YOUTUBE_CLIENT_ID", "YOUTUBE_CLIENT_SECRET", "YOUTUBE_REFRESH_TOKEN",
    "OAUTH_GOOGLE_CLIENT_ID", "OAUTH_GOOGLE_CLIENT_SECRET", "OAUTH_FACEBOOK_APP_ID", "OAUTH_FACEBOOK_APP_SECRET",
    "OAUTH_GITHUB_CLIENT_ID", "OAUTH_GITHUB_CLIENT_SECRET", "OAUTH_TWITTER_CLIENT_ID", "OAUTH_TWITTER_CLIENT_SECRET",
    "OAUTH_LINKEDIN_CLIENT_ID", "OAUTH_LINKEDIN_CLIENT_SECRET", "OAUTH_REDDIT_CLIENT_ID", "OAUTH_REDDIT_CLIENT_SECRET",
    "OAUTH_MEDIUM_CLIENT_ID", "OAUTH_MEDIUM_CLIENT_SECRET",
    "WHATSAPP_ACCESS_TOKEN", "WHATSAPP_PHONE_NUMBER_ID", "WHATSAPP_VERIFY_TOKEN", "WHATSAPP_APPROVAL_PHONE",
    "APP_NAME", "APP_ENV", "APP_DEBUG", "LOG_LEVEL", "CORS_ORIGINS"
]

def load_env(path):
    env_dict = {}
    try:
        with open(path, "r") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#"):
                    if "=" in line:
                        k, v = line.split("=", 1)
                        env_dict[k.strip()] = v.strip()
    except FileNotFoundError:
        pass
    return env_dict

env_example = load_env(".env.example")
env = load_env(".env")
env_prod = load_env(".env.production")

def get_filled_template(env_dict, is_example=False):
    fill_dict = {}
    for key in all_keys:
        val = env_dict.get(key, "")
        if is_example:
            # Mask or provide generic defaults for example
            if "PASSWORD" in key and not val:
                val = "your_secure_password"
            elif "SECRET" in key and not val:
                val = "your_secret_key"
            elif "TOKEN" in key and not val and key != "WHATSAPP_VERIFY_TOKEN":
                val = "your_token"
            elif "KEY" in key and not val:
                val = "your_api_key"
            # Overwrite even if exist in example to assure no sensitive data
            if key == "POSTGRES_PASSWORD" or key == "JWT_SECRET_KEY" or key == "DEFAULT_ADMIN_PASSWORD" or key == "REDIS_PASSWORD":
                val = "your_secure_password"
            if key == "DATABASE_URL":
                val = "postgresql+asyncpg://zaytri_user:your_secure_password@localhost:5432/zaytri_db"
            if key == "DATABASE_URL_SYNC":
                val = "postgresql://zaytri_user:your_secure_password@localhost:5432/zaytri_db"
            if key == "REDIS_URL":
                val = "redis://localhost:6379/0"
            if key == "JWT_SECRET_KEY":
                val = "your-super-secret-jwt-key"
            if "ACCESS_TOKEN" in key and key != "JWT_ACCESS_TOKEN_EXPIRE_MINUTES":
                val = ""
            if "APP_SECRET" in key:
                val = ""
            if "CLIENT_SECRET" in key:
                val = ""
        fill_dict[key] = val
    return template.format(**fill_dict)

with open(".env.example", "w") as f:
    f.write(get_filled_template(env_example, is_example=True))

with open(".env", "w") as f:
    f.write(get_filled_template(env))

with open(".env.production", "w") as f:
    f.write(get_filled_template(env_prod))

print("Sync complete.")
