# Zaytri Authentication Module

> Complete authentication system with session management, toast notifications, and multi-method login.

---

## Overview

The auth module provides a full-featured authentication system across both backend (FastAPI) and frontend (Next.js). It supports:

- **Password login** with bcrypt hashing
- **OTP-based login** (email/SMS)
- **Two-Factor Authentication (2FA/TOTP)** via authenticator apps
- **OAuth social login** (Google, Facebook, GitHub, Twitter)
- **Password recovery** via reset link or OTP
- **Session management** with JWT tokens and expiry detection
- **Toast notifications** for user feedback
- **Rate limiting & account lockout** for brute-force protection

---

## Architecture

```
auth/
├── models.py          # SQLAlchemy models (User, OTPCode, OAuthAccount, etc.)
├── schemas.py         # Pydantic schemas for request/response validation
├── router.py          # FastAPI endpoints (/auth/login, /auth/register, etc.)
├── dependencies.py    # get_current_user dependency (JWT verification)
├── utils.py           # Password hashing, JWT, OTP, TOTP, rate limiter
├── oauth.py           # OAuth provider configurations
├── seed.py            # Default admin user seeding
└── AUTH.md            # This file

frontend/src/
├── lib/
│   ├── auth.ts        # Auth API client (login, register, OTP, 2FA, OAuth)
│   └── api.ts         # Generic fetch wrapper with 401/403 → session-expired event
├── components/
│   ├── Toast.tsx       # Toast notification system (success/error/warning/info)
│   ├── SessionProvider.tsx  # Session guard with expiry popup
│   └── Sidebar.tsx     # Nav with user display & logout
└── app/
    ├── providers.tsx   # Client-side providers wrapper
    ├── (auth)/
    │   ├── login/page.tsx
    │   ├── signup/page.tsx
    │   ├── forgot-password/page.tsx
    │   ├── reset-password/page.tsx
    │   └── verify/page.tsx
    └── layout.tsx      # Root layout with Providers
```

---

## Session Management

### How It Works

1. **JWT Tokens** — Backend issues JWT access tokens (+ optional refresh tokens) at login.
2. **SessionProvider** — A React context provider wrapping the entire app. It:
   - Checks the JWT on mount and every 60 seconds.
   - Decodes the token to check `exp` (with 30s buffer).
   - Listens for cross-tab logout via `StorageEvent`.
   - Listens for API-triggered expiry via `zaytri-session-expired` custom event.
   - Shows a glassmorphism **"Session Expired" popup** on protected routes.
   - Auth routes (`/login`, `/signup`, `/forgot-password`, `/reset-password`, `/verify`) are excluded.
3. **API Client** — The `apiFetch` wrapper dispatches `zaytri-session-expired` on 401/403 responses instead of hard-redirecting, letting the SessionProvider handle it gracefully.

### Session Expired Popup

When the token is missing or expired on a protected route, a full-screen overlay appears with:
- 🔒 Lock icon
- "Session Expired" title
- Descriptive message
- "Sign In to Continue" button → redirects to `/login`
- Background blur and glassmorphism styling

---

## Toast Notification System

### Usage

```tsx
import { useToast } from "@/components/Toast";

function MyComponent() {
    const toast = useToast();
    
    toast.success("Title", "Description");
    toast.error("Title", "Description");
    toast.warning("Title", "Description");
    toast.info("Title", "Description");
}
```

### Features
- 4 types: success (green), error (red), warning (amber), info (blue)
- Auto-dismiss after 5 seconds
- Stacking with smooth slide-in/out animations
- Close button on each toast
- Matching Zaytri dark glassmorphism theme
- Global singleton via `ToastProvider` and `useToast()` hook

### Currently Integrated In
- **Login page** — login success, 2FA required, OTP sent, errors
- **Signup page** — OTP sent/verified, account created, validation warnings, errors
- **Forgot password** — reset link sent, errors
- **Reset password** — password reset success, password mismatch, errors
- **Sidebar** — logout confirmation
- **API client** — session expired events

---

## Backend Endpoints

| Endpoint | Method | Description | Auth |
|---|---|---|---|
| `/auth/register` | POST | Create new user | No |
| `/auth/login` | POST | Email/password login | No |
| `/auth/login/otp` | POST | Login with OTP | No |
| `/auth/send-otp` | POST | Send OTP code | No |
| `/auth/verify-otp` | POST | Verify OTP code | No |
| `/auth/forgot-password` | POST | Request password reset | No |
| `/auth/reset-password` | POST | Reset with token | No |
| `/auth/reset-password/otp` | POST | Reset with OTP | No |
| `/auth/change-password` | POST | Change password | Yes |
| `/auth/2fa/setup` | POST | Setup TOTP 2FA | Yes |
| `/auth/2fa/verify-setup` | POST | Confirm TOTP setup | Yes |
| `/auth/2fa/verify` | POST | Verify 2FA code at login | No |
| `/auth/2fa/disable` | POST | Disable 2FA | Yes |
| `/auth/refresh` | POST | Refresh access token | No |
| `/auth/me` | GET | Get current user | Yes |
| `/auth/oauth/{provider}/url` | GET | Get OAuth redirect URL | No |
| `/auth/oauth/{provider}/callback` | GET | OAuth callback | No |

---

## Security Features

1. **Password hashing** — bcrypt with salt rounds
2. **JWT tokens** — Short-lived access tokens with `exp` claim
3. **Rate limiting** — In-memory tracker per IP/identifier, configurable max attempts + window
4. **Account lockout** — Temporary lockout after repeated failed login attempts
5. **Input sanitization** — Email, username, and phone validation
6. **CORS** — Configured in `main.py`
7. **HTTPBearer** — `auto_error=False` returns 401 (not 403) for missing tokens

---

## Models

- **User** — Username, email, phone, hashed password, 2FA settings, role, lockout fields
- **OTPCode** — One-time codes with purpose (login/signup/reset), expiry, used flag
- **OAuthAccount** — Linked social accounts (provider, provider_user_id)
- **PasswordResetToken** — Token-based password reset with expiry
- **LoginAttempt** — Audit log of login attempts (IP, success/fail, timestamp)

---

## Environment Variables

| Variable | Description | Required |
|---|---|---|
| `SECRET_KEY` | JWT signing secret | Yes |
| `DATABASE_URL` | PostgreSQL connection string | Yes |
| `REDIS_URL` | Redis for Celery/caching | Yes |
| `GOOGLE_CLIENT_ID` | Google OAuth | Optional |
| `GOOGLE_CLIENT_SECRET` | Google OAuth | Optional |
| `FACEBOOK_CLIENT_ID` | Facebook OAuth | Optional |
| `FACEBOOK_CLIENT_SECRET` | Facebook OAuth | Optional |
| `GITHUB_CLIENT_ID` | GitHub OAuth | Optional |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth | Optional |
| `TWITTER_CLIENT_ID` | Twitter OAuth | Optional |
| `TWITTER_CLIENT_SECRET` | Twitter OAuth | Optional |
