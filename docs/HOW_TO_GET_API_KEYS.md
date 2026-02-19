# 🔑 Zaytri — How to Get All Your API Keys

> **This guide is written for beginners.** Follow each section step-by-step.
> You only need keys for the platforms you actually want to use.
> If you don't use YouTube, skip that section entirely!

---

## Table of Contents

1. [Database & Redis (No signup needed)](#1--database--redis-no-signup-needed)
2. [Ollama — Local AI Brain (Free)](#2--ollama--local-ai-brain-free)
3. [JWT Secret Key (Generate yourself)](#3--jwt-secret-key-generate-yourself)
4. [Instagram API Keys](#4--instagram-api-keys)
5. [Facebook API Keys](#5--facebook-api-keys)
6. [Twitter / X API Keys](#6--twitter--x-api-keys)
7. [YouTube API Keys](#7--youtube-api-keys)

---

## 1. 🗄️ Database & Redis (No signup needed)

These run **locally on your computer** via Docker. You don't need to sign up anywhere.

**What to do:** Just leave the default values as they are, or change the password to something you prefer.

```env
DATABASE_URL=postgresql+asyncpg://zaytri_user:pick_a_password@postgres:5432/zaytri_db
POSTGRES_USER=zaytri_user
POSTGRES_PASSWORD=pick_a_password
POSTGRES_DB=zaytri_db
REDIS_URL=redis://redis:6379/0
```

> [!TIP]
> Replace `pick_a_password` with **any** password you want. It stays on your machine — nobody else sees it.

---

## 2. 🧠 Ollama — Local AI Brain (Free)

Ollama runs AI models **locally on your Mac** — completely free, no signup, no API key.

### Steps:

1. **Download Ollama** — go to [ollama.com](https://ollama.com) and click **"Download"**
2. **Install it** — open the downloaded file and drag to Applications (like any Mac app)
3. **Open Ollama** — launch it from your Applications folder. You'll see a small llama icon in your menu bar (top-right of screen)
4. **Download the AI model** — open **Terminal** (search "Terminal" in Spotlight) and type:
   ```bash
   ollama pull llama3
   ```
   ⏳ This will download ~4GB. Wait for it to finish.
5. **Verify it works** — type this in Terminal:
   ```bash
   ollama run llama3 "Say hello"
   ```
   If the AI responds, you're all set! Press `Ctrl+D` to exit.

**What to put in .env:**
```env
OLLAMA_HOST=http://ollama:11434
OLLAMA_MODEL=llama3
```

> [!NOTE]
> If running **without Docker** (local dev), change the host to:
> `OLLAMA_HOST=http://localhost:11434`

---

## 3. 🔐 JWT Secret Key (Generate yourself)

This is a secret password that Zaytri uses internally to keep user login sessions safe. Nobody else needs to see it.

### Steps:

1. Open **Terminal**
2. Run this command:
   ```bash
   openssl rand -hex 32
   ```
3. It will print a long random string like: `a4f8e2c91b3d7f0e6a5c8b2d4f1e3a7c9b0d2e4f6a8c1b3d5e7f9a2c4b6d8e`
4. **Copy that entire string** and paste it into your `.env`:
   ```env
   JWT_SECRET_KEY=a4f8e2c91b3d7f0e6a5c8b2d4f1e3a7c9b0d2e4f6a8c1b3d5e7f9a2c4b6d8e
   ```

> [!CAUTION]
> **Never share this key with anyone.** If someone gets this key, they can pretend to be any user on your system.

---

## 4. 📸 Instagram API Keys

You need a **Business or Creator Instagram account** connected to a **Facebook Page**.

### Step 1: Switch to a Business Account

1. Open **Instagram app** on your phone
2. Go to **Settings** → **Account** → **Switch to Professional Account**
3. Choose **Business**
4. Connect it to a **Facebook Page** (create one if you don't have one)

### Step 2: Create a Facebook Developer App

1. Go to [developers.facebook.com](https://developers.facebook.com)
2. Click **"My Apps"** (top-right) → **"Create App"**
3. Choose **"Business"** as the app type → **Next**
4. Give your app a name (e.g., "Zaytri") → **Create App**
5. You're now on your app dashboard!

### Step 3: Get Your Access Token

1. Go to [Graph API Explorer](https://developers.facebook.com/tools/explorer/)
2. At the top-right, select **your app** from the dropdown
3. Click **"Generate Access Token"** → **Login with Facebook** → **Allow all permissions**
4. You'll see a long token. **Copy it** — this is your `INSTAGRAM_ACCESS_TOKEN`

### Step 4: Get Your Business Account ID

1. In the same Graph API Explorer, type this in the query box:
   ```
   me/accounts?fields=instagram_business_account
   ```
2. Click **Submit**
3. Look for `"instagram_business_account" → "id"`. **Copy that number** — this is your `INSTAGRAM_BUSINESS_ACCOUNT_ID`

### Step 5: Get App Secret

1. Go to your app's dashboard → **Settings** → **Basic**
2. Next to **App Secret**, click **"Show"** → enter your password
3. **Copy it** — this is your `INSTAGRAM_APP_SECRET`

**What to put in .env:**
```env
INSTAGRAM_ACCESS_TOKEN=<paste your token here>
INSTAGRAM_BUSINESS_ACCOUNT_ID=<paste the number here>
INSTAGRAM_APP_SECRET=<paste the secret here>
```

> [!WARNING]
> The access token **expires after ~60 days**. To get a long-lived token, follow [this guide](https://developers.facebook.com/docs/facebook-login/guides/access-tokens/get-long-lived/).

---

## 5. 👤 Facebook API Keys

Good news — if you already did the Instagram steps above, you already have most of what you need!

### Get Your Page ID

1. Go to your **Facebook Page**
2. Click **"About"** (left menu)
3. Scroll down to find **"Page ID"** — it's a number like `100000000000000`

**What to put in .env:**
```env
FACEBOOK_ACCESS_TOKEN=<same token from Instagram step above>
FACEBOOK_PAGE_ID=<your Page ID number>
FACEBOOK_APP_SECRET=<same App Secret from Instagram step above>
```

> [!TIP]
> If you're using both Instagram and Facebook, the **access token** and **app secret** are the same for both! They both come from the same Facebook Developer App.

---

## 6. 🐦 Twitter / X API Keys

### Step 1: Apply for Developer Access

1. Go to [developer.x.com](https://developer.x.com)
2. Click **"Sign Up"** → log in with your Twitter/X account
3. Choose the **"Free"** plan (allows 1,500 tweets/month) or **"Basic"** ($100/month for more access)
4. Fill out the application form:
   - **What will you use it for?** → say something like: *"Automated social media posting for my business"*
5. **Agree** to the developer agreement → **Submit**
6. You should get approved immediately for the Free plan

### Step 2: Create a Project & App

1. In the [Developer Portal](https://developer.x.com/en/portal/dashboard), click **"+ Add App"** or **"Create Project"**
2. Name your project (e.g., "Zaytri")
3. Name your app (e.g., "Zaytri App")
4. You'll be shown your keys — **SAVE THEM NOW**, you won't see them again!

### Step 3: Get Your Keys

After creating your app, you'll see:
- **API Key** → put in `TWITTER_API_KEY`
- **API Key Secret** → put in `TWITTER_API_SECRET`
- **Bearer Token** → put in `TWITTER_BEARER_TOKEN`

### Step 4: Generate Access Tokens

1. In your app settings, go to **"Keys and Tokens"** tab
2. Under **"Access Token and Secret"**, click **"Generate"**
3. Copy both values:
   - **Access Token** → `TWITTER_ACCESS_TOKEN`
   - **Access Token Secret** → `TWITTER_ACCESS_TOKEN_SECRET`

### Step 5: Set App Permissions

1. Go to your app → **Settings** → **"User authentication settings"** → **Edit**
2. Set **App permissions** to **"Read and Write"**
3. Save

**What to put in .env:**
```env
TWITTER_API_KEY=<your API Key>
TWITTER_API_SECRET=<your API Key Secret>
TWITTER_ACCESS_TOKEN=<your Access Token>
TWITTER_ACCESS_TOKEN_SECRET=<your Access Token Secret>
TWITTER_BEARER_TOKEN=<your Bearer Token>
```

> [!IMPORTANT]
> The **Free plan** allows posting only. To read tweets and analytics, you need the **Basic plan** ($100/month).

---

## 7. ▶️ YouTube API Keys

### Step 1: Create a Google Cloud Project

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Sign in with your **Google account**
3. Click the project dropdown (top-left, next to "Google Cloud") → **"New Project"**
4. Name it "Zaytri" → **Create**
5. Make sure your new project is selected in the dropdown

### Step 2: Enable the YouTube API

1. In the left menu, click **"APIs & Services"** → **"Library"**
2. Search for **"YouTube Data API v3"**
3. Click on it → click **"Enable"**

### Step 3: Get Your API Key

1. Go to **"APIs & Services"** → **"Credentials"**
2. Click **"+ Create Credentials"** → **"API Key"**
3. A key will appear. **Copy it** — this is your `YOUTUBE_API_KEY`
4. (Optional but recommended) Click **"Edit API key"** → under **"API restrictions"**, select **"YouTube Data API v3"** → Save

### Step 4: Create OAuth Credentials (for posting & replying)

1. Still in **"Credentials"**, click **"+ Create Credentials"** → **"OAuth Client ID"**
2. If asked, configure the **OAuth consent screen** first:
   - Choose **"External"** → Create
   - Fill in app name ("Zaytri"), your email → Save
   - Add scopes: search for **"YouTube"** and check all YouTube-related ones → Save
   - Add yourself as a **test user** → Save
3. Now create the OAuth Client ID:
   - Application type: **"Web application"**
   - Name: "Zaytri"
   - Authorized redirect URIs: add `http://localhost:8000/auth/callback`
   - Click **Create**
4. You'll see:
   - **Client ID** → `YOUTUBE_CLIENT_ID`
   - **Client Secret** → `YOUTUBE_CLIENT_SECRET`

### Step 5: Get a Refresh Token

This step is a bit more involved. You'll use Google's OAuth Playground:

1. Go to [OAuth 2.0 Playground](https://developers.google.com/oauthplayground)
2. Click the ⚙️ gear icon (top-right) → check **"Use your own OAuth credentials"**
3. Enter your **Client ID** and **Client Secret** from Step 4
4. In the left panel, scroll to **"YouTube Data API v3"** → select all scopes
5. Click **"Authorize APIs"** → sign in → allow access
6. Click **"Exchange authorization code for tokens"**
7. Copy the **"Refresh token"** → `YOUTUBE_REFRESH_TOKEN`

**What to put in .env:**
```env
YOUTUBE_API_KEY=<your API Key>
YOUTUBE_CLIENT_ID=<your Client ID>
YOUTUBE_CLIENT_SECRET=<your Client Secret>
YOUTUBE_REFRESH_TOKEN=<your Refresh Token>
```

---

## ✅ Quick Checklist

| Service | Required? | Cost | Difficulty |
|---------|-----------|------|-----------|
| Database & Redis | ✅ Yes | Free (local) | Easy — no signup |
| Ollama (AI) | ✅ Yes | Free (local) | Easy — just install |
| JWT Secret | ✅ Yes | Free | Easy — one command |
| Instagram | Optional | Free | Medium |
| Facebook | Optional | Free | Medium |
| Twitter/X | Optional | Free / $100/mo | Easy |
| YouTube | Optional | Free | Hard |

> [!TIP]
> **Start simple!** Set up Database, Redis, Ollama, and JWT first. Those are enough to run the content creation pipeline. Add social media platforms later when you're ready to publish.

---

## 🆘 Need Help?

- **Ollama issues:** Check [ollama.com/docs](https://ollama.com) 
- **Facebook/Instagram API:** Check [developers.facebook.com/docs](https://developers.facebook.com/docs/)
- **Twitter/X API:** Check [developer.x.com/docs](https://developer.x.com/en/docs)
- **YouTube API:** Check [developers.google.com/youtube](https://developers.google.com/youtube/v3)
