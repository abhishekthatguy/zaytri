# Auth Module — Implementation Plan

## Overview
Complete authentication system for Zaytri with login, signup, forgot/reset password,
change password, OTP verification, OAuth (Google/Facebook/GitHub/Twitter), and TOTP 2FA.

## Architecture

### Backend Files (all in `auth/` directory)
1. `auth/models.py` — Extended User model + OTP, PasswordReset, OAuthAccount, LoginAttempt tables
2. `auth/schemas.py` — All Pydantic request/response schemas
3. `auth/router.py` — All auth API endpoints
4. `auth/dependencies.py` — JWT middleware (existing, enhanced)
5. `auth/utils.py` — Password hashing, OTP generation, rate limiting, TOTP
6. `auth/oauth.py` — OAuth flow handlers (Google, Facebook, GitHub, Twitter)
7. `auth/seed.py` — Default admin user seeder

### Frontend Files
1. `frontend/src/app/(auth)/login/page.tsx` — Login (email/phone + password + OTP)
2. `frontend/src/app/(auth)/signup/page.tsx` — Signup (email, phone, social)
3. `frontend/src/app/(auth)/forgot-password/page.tsx` — Forgot password
4. `frontend/src/app/(auth)/reset-password/page.tsx` — Reset password via link/OTP
5. `frontend/src/app/(auth)/verify/page.tsx` — OTP verification screen
6. `frontend/src/app/(auth)/layout.tsx` — Auth layout (no sidebar)
7. `frontend/src/lib/auth.ts` — Auth API functions

### Config
- `.env` — Add OAuth app keys, 2FA secret, rate limit settings
- `config.py` — Add OAuth settings to Settings class

### Tests
- `tests/test_auth.py` — Comprehensive test suite

## Security Features
- bcrypt password hashing (never stored/returned in plain text)
- JWT tokens with expiry
- Rate limiting on login/OTP (anti-scraping)
- OTP with expiry (10 min) + max attempts (5)
- TOTP 2FA via pyotp (Google/Microsoft Authenticator compatible)
- Login attempt tracking
- Account lockout after 5 failed attempts (15 min cooldown)

## Default User
- Email: zaytri@gmail.com
- Username: admin
- Password: avii1994 (bcrypt hashed)
