<div align="center">

<img src="../docs/assets/logo.png" alt="Zaytri Logo" width="80">

# Zaytri — Frontend

**Next.js 16 Web UI (Landing + Dashboard) with Dark Glassmorphism Design**

<img src="../docs/assets/badges/nextjs-16.1.6.svg" alt="next.js 16.1.6">
<img src="../docs/assets/badges/typescript-5.x.svg" alt="typescript 5.x">
<img src="../docs/assets/badges/tailwind-4.svg" alt="tailwind 4">

</div>

---

## 📑 Pages

| Route | Description |
|:------|:------------|
| `/` | **Landing** — Marketing home page |
| `/about` | **About** — Product overview |
| `/resources` | **Resources** — Docs & links |
| `/privacy` | **Privacy** — Privacy policy |
| `/terms` | **Terms** — Terms of service |
| `/dashboard` | **Dashboard** — System overview, agent health, content stats |
| `/chat` | **Master Agent Chat** — Full-screen AI chat with voice + image upload (drag/drop/paste) |
| `/content` | **Content Manager** — Create, review, approve, schedule posts |
| `/content/new` | **New Content** — Run the content pipeline |
| `/workflows` | **Workflows** — Run and monitor workflows |
| `/llm-settings` | **LLM Configuration** — API keys, provider testing, agent model assignment |
| `/llm-settings/agents` | **Agent Models** — Per-agent LLM assignment |
| `/analytics` | **Analytics** — Engagement metrics and performance |
| `/settings` | **Settings** — Cron schedules, platform credentials |
| `/login` | **Login** — Password + OTP login, 2FA, social login (Google/Facebook/GitHub/Twitter) |
| `/signup` | **Signup** — Email/Phone/Social registration with OTP verification |
| `/forgot-password` | **Forgot Password** — Request reset link + OTP |
| `/reset-password` | **Reset Password** — Reset via token or OTP code |
| `/verify` | **OAuth Callback** — Handles social login redirect |

---

## 🚀 Quick Start

```bash
# From the project root
cd frontend

# Install dependencies
npm ci

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

> **Note:** The frontend needs the backend running to function. Start everything with `zaytri start` from the project root.

---

## 🛠️ Development

```bash
# Development server (with hot reload)
npm run dev

# Type check
npx tsc --noEmit

# Lint
npx eslint src/

# Production build
npm run build

# Start production server
npm start
```

---

## ⚙️ Environment Variables

The frontend uses one key environment variable:

| Variable | Default | Description |
|:---------|:--------|:------------|
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000` | Backend API URL |
| `PORT` | `3000` | Development server port |

These are automatically set by `zaytri start` based on `.env` port configuration.

---

## 🎨 Design System

- **Theme:** Dark mode with glassmorphism cards
- **Colors:** Cyan (`#00d4ff`) + Purple (`#7c3aed`) gradient accents on `#0d1117` background
- **Typography:** Inter (Google Fonts)
- **Animations:** Smooth micro-transitions, hover effects, loading states
- **Layout:** Sidebar navigation + main content area, fully responsive

---

## 📁 Structure

```
frontend/
├── src/
│   ├── app/                   # Next.js App Router pages
│   │   ├── layout.tsx         # Root layout with sidebar
│   │   ├── (landing)/         # Landing pages (no sidebar)
│   │   │   ├── page.tsx       # Landing (/)
│   │   │   ├── about/         # About (/about)
│   │   │   ├── resources/     # Resources (/resources)
│   │   │   ├── privacy/       # Privacy (/privacy)
│   │   │   └── terms/         # Terms (/terms)
│   │   ├── dashboard/page.tsx # Dashboard (/dashboard)
│   │   ├── chat/page.tsx      # Master Agent chat
│   │   ├── content/           # Content management
│   │   ├── llm-settings/      # LLM configuration
│   │   ├── analytics/         # Analytics dashboard
│   │   ├── settings/          # System settings
│   │   └── (auth)/            # 🔐 Auth route group (no sidebar)
│   │       ├── layout.tsx     # Full-screen centered layout
│   │       ├── login/         # Password + OTP + 2FA login
│   │       ├── signup/        # Email/Phone/Social signup
│   │       ├── forgot-password/ # Password recovery
│   │       ├── reset-password/  # Reset via token or OTP
│   │       └── verify/        # OAuth callback handler
│   ├── components/
│   │   ├── Sidebar.tsx        # Navigation sidebar (hidden on auth)
│   │   └── ...                # Shared components
│   └── lib/
│       ├── api.ts             # Main API client
│       └── auth.ts            # Auth API client (login, register, OTP, 2FA, OAuth)
├── public/                    # Static assets
├── Dockerfile                 # Production Docker image
├── package.json
├── tsconfig.json
├── tailwind.config.ts
└── next.config.ts
```

---

<div align="center">

Part of [**Zaytri**](../README.md) — Built by **Abhishek Singh (Avii)**

</div>
