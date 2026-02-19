<div align="center">

# 🔐 Zaytri Authentication Module

**Secure, multi-method authentication with social logins, OTP, and 2FA**

</div>

---

## Overview

The Zaytri auth module provides a complete authentication system with:

- **Multiple registration methods** — email, phone, social OAuth
- **Multiple login methods** — password, OTP, social
- **Two-factor authentication** — TOTP (Google/Microsoft Authenticator)
- **Password recovery** — via email link or OTP code
- **Security hardening** — rate limiting, account lockout, bcrypt hashing

---

## Architecture

```
┌──────────────────── Frontend (Next.js) ────────────────────┐
│                                                             │
│  ┌─────────┐ ┌─────────┐ ┌───────────────┐ ┌────────────┐ │
│  │  Login   │ │ Signup  │ │Forgot Password│ │   Reset    │ │
│  │ /login   │ │ /signup │ │/forgot-password│ │/reset-pwd  │ │
│  └────┬─────┘ └────┬────┘ └───────┬───────┘ └─────┬──────┘ │
│       │             │              │                │        │
│       └──────┬──────┴──────────────┴────────────────┘        │
│              │  lib/auth.ts (API Client)                     │
└──────────────┼──────────────────────────────────────────────┘
               │
               ▼
┌──────────────────── Backend (FastAPI) ─────────────────────┐
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │             auth/router.py (20 endpoints)            │   │
│  │  register │ login │ otp │ reset │ 2fa │ oauth       │   │
│  └──────────────────────┬──────────────────────────────┘   │
│                          │                                   │
│  ┌──────────┐  ┌────────▼────────┐  ┌──────────────────┐   │
│  │ models.py│  │   utils.py      │  │    oauth.py      │   │
│  │ User     │  │ bcrypt, JWT,    │  │ Google, Facebook │   │
│  │ OAuth    │  │ OTP, TOTP,      │  │ GitHub, Twitter  │   │
│  │ OTPCode  │  │ rate limiter    │  │ (raw httpx)      │   │
│  │ Login    │  └─────────────────┘  └──────────────────┘   │
│  └──────────┘                                               │
│                                                              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              PostgreSQL (via SQLAlchemy)               │  │
│  │  users │ oauth_accounts │ otp_codes │ login_attempts  │  │
│  └───────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

---

## Database Models

### User (extended)

| Field | Type | Description |
|:------|:-----|:------------|
| `id` | UUID | Primary key |
| `username` | String(100) | Unique, indexed |
| `email` | String(255) | Unique, indexed |
| `hashed_password` | String(255) | Bcrypt hash |
| `phone` | String(20) | Optional, unique |
| `totp_secret` | String(32) | TOTP secret for 2FA |
| `is_2fa_enabled` | Boolean | 2FA toggle |
| `is_email_verified` | Boolean | Email verification status |
| `is_phone_verified` | Boolean | Phone verification status |
| `failed_login_attempts` | Integer | Counter (resets on success) |
| `locked_until` | DateTime | Account lockout expiry |
| `last_login_at` | DateTime | Last successful login |
| `last_login_ip` | String(45) | IPv4/IPv6 |

### OAuthAccount

| Field | Type | Description |
|:------|:-----|:------------|
| `provider` | String(20) | google, facebook, github, twitter |
| `provider_user_id` | String(255) | External user ID |
| `provider_email` | String(255) | Email from provider |
| `access_token` | Text | Provider access token |
| `refresh_token` | Text | Provider refresh token |

### OTPCode

| Field | Type | Description |
|:------|:-----|:------------|
| `email` | String(255) | Recipient email |
| `phone` | String(20) | Recipient phone |
| `code` | String(6) | 6-digit OTP |
| `purpose` | String(20) | signup, login, reset, verify |
| `expires_at` | DateTime | Expiry (5 minutes) |
| `is_used` | Boolean | One-time use flag |

### LoginAttempt

| Field | Type | Description |
|:------|:-----|:------------|
| `identifier` | String(255) | Email/phone/username used |
| `ip_address` | String(45) | Client IP |
| `user_agent` | String(500) | Browser/device info |
| `success` | Boolean | Login result |
| `failure_reason` | String(50) | Why it failed |

---

## API Endpoints

### Registration

| Method | Path | Body | Description |
|:-------|:-----|:-----|:------------|
| `POST` | `/auth/register` | `{username, email, password, phone?, otp_code?}` | Register new user |
| `POST` | `/auth/otp/send` | `{email?, phone?, purpose}` | Send OTP for signup verification |
| `POST` | `/auth/otp/verify` | `{email?, phone?, code, purpose}` | Verify OTP |

**Flow:**
1. User enters email/phone → `POST /auth/otp/send` (purpose: "signup")
2. User enters OTP → `POST /auth/otp/verify`
3. User enters username + password → `POST /auth/register` (with otp_code)

### Login

| Method | Path | Body | Description |
|:-------|:-----|:-----|:------------|
| `POST` | `/auth/login` | `{identifier, password}` | Password login (email/phone/username) |
| `POST` | `/auth/login/otp` | `{identifier, otp_code}` | OTP login (passwordless) |
| `POST` | `/auth/2fa/verify` | `{temp_token, code}` | Complete 2FA step |

**Password login flow:**
1. `POST /auth/login` → returns `{access_token, user, requires_2fa}`
2. If `requires_2fa: true`, the `access_token` is temporary (5 min, has `needs_2fa` claim)
3. `POST /auth/2fa/verify` with temp token + TOTP code → returns final tokens

### Password Recovery

| Method | Path | Body | Description |
|:-------|:-----|:-----|:------------|
| `POST` | `/auth/forgot-password` | `{email}` | Send reset link + OTP |
| `POST` | `/auth/reset-password` | `{token, new_password}` | Reset via email link token |
| `POST` | `/auth/reset-password/otp` | `{email, otp_code, new_password}` | Reset via OTP |
| `POST` | `/auth/change-password` | `{current_password, new_password}` | Authenticated change |

### Two-Factor Authentication

| Method | Path | Body | Description |
|:-------|:-----|:-----|:------------|
| `POST` | `/auth/2fa/setup` | — | Generate TOTP secret + QR code |
| `POST` | `/auth/2fa/enable` | `{code}` | Enable 2FA (verify first code) |
| `POST` | `/auth/2fa/disable` | `{code}` | Disable 2FA |
| `POST` | `/auth/2fa/verify` | `{temp_token, code}` | Verify during login |

### Social OAuth

| Method | Path | Description |
|:-------|:-----|:------------|
| `GET` | `/auth/oauth/{provider}/url?redirect_uri=...` | Get OAuth redirect URL |
| `POST` | `/auth/oauth/callback` | Exchange code for tokens |

Supported providers: `google`, `facebook`, `github`, `twitter`

---

## Security Features

### Password Hashing (Bcrypt)

```python
# Irreversible — cannot be converted back to plaintext
hashed = bcrypt.hashpw(password.encode(), bcrypt.gensalt())
```

- Salt automatically generated per password
- Work factor: 12 rounds (default bcrypt)
- Constant-time comparison for verification

### JWT Tokens

| Token | Lifetime | Purpose |
|:------|:---------|:--------|
| Access token | 60 minutes | API authentication |
| Refresh token | 7 days | Get new access token |
| Temp 2FA token | 5 minutes | Complete 2FA verification |

### Rate Limiting

In-memory sliding window per IP/identifier:

| Context | Max Attempts | Window |
|:--------|:-------------|:-------|
| Login | 10 | 15 minutes |
| OTP send | 5 | 5 minutes |
| Signup | 5 | 15 minutes |

### Account Lockout

- **Trigger:** 5 consecutive failed password attempts
- **Duration:** 15 minutes
- **Reset:** Counters reset on successful login

### Input Sanitization

All user inputs are sanitized via `bleach.clean()` to prevent XSS and injection attacks.

---

## OAuth Setup

To enable social logins, add credentials to `.env`:

```env
# Google — https://console.cloud.google.com/apis/credentials
OAUTH_GOOGLE_CLIENT_ID=your-google-client-id
OAUTH_GOOGLE_CLIENT_SECRET=your-google-client-secret

# Facebook — https://developers.facebook.com/apps
OAUTH_FACEBOOK_APP_ID=your-facebook-app-id
OAUTH_FACEBOOK_APP_SECRET=your-facebook-app-secret

# GitHub — https://github.com/settings/developers
OAUTH_GITHUB_CLIENT_ID=your-github-client-id
OAUTH_GITHUB_CLIENT_SECRET=your-github-client-secret

# Twitter/X — https://developer.twitter.com/en/portal
OAUTH_TWITTER_CLIENT_ID=your-twitter-client-id
OAUTH_TWITTER_CLIENT_SECRET=your-twitter-client-secret
```

**OAuth redirect URI:** `http://localhost:3000/verify?provider={provider}`

> Leave any credential empty to disable that provider. The system gracefully skips unconfigured providers.

---

## Frontend Pages

| Page | Route | Description |
|:-----|:------|:------------|
| Login | `/login` | Password + OTP toggle, 2FA step, social buttons |
| Signup | `/signup` | Email/Phone/Social tabs, OTP verification, username+password setup |
| Forgot Password | `/forgot-password` | Enter email, receive reset link + OTP |
| Reset Password | `/reset-password` | Reset via token (from link) or OTP code |
| Verify | `/verify` | OAuth callback handler |

All auth pages use the `(auth)` route group layout — **no sidebar**, full-screen centered, dark glassmorphism design.

---

## Default Admin User

On first startup, the system seeds a default admin:

| Field | Value |
|:------|:------|
| Email | `zaytri@gmail.com` |
| Password | `avii1994` |
| Username | `admin` |
| Role | Admin |

> Change the password immediately in production.

---

## Testing

The auth module has a comprehensive test suite (40+ test cases):

```bash
# Run auth tests
cd /path/to/zaytri
python -m pytest tests/test_auth.py -v
```

**Test coverage:**
- Password hashing (bcrypt, irreversibility)
- JWT creation and decoding
- OTP generation and expiry
- TOTP 2FA (setup, verify, URI format)
- Rate limiter (sliding window, reset)
- Account lockout logic
- Input validation (email, username, password strength)
- Schema validation (Pydantic models)
- OAuth provider configuration
- Model structure and relationships
- Default user seeding

---

<div align="center">

**Zaytri Auth Module v1.1.0**

*Secure by default, extensible by design.*

</div>
