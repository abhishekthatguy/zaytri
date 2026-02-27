# 🚀 Deploying Zaytri on Google Cloud (Minimal Cost Guide)

This guide walks you through deploying your full Next.js/FastAPI stack via Docker on Google Cloud Compute Engine (GCE), with your domain (`zaytri.gitlime.com`) and SSL (HTTPS) enabled.

## 💰 Choosing a Server for "Minimal Cost"
Docker, PostgreSQL, Redis, Celery, and Next.js require memory to run smoothly. 
Furthermore, you are using **Ollama (Local LLM)**. An LLM alone requires **at least 4GB of RAM** to parse and generate text in real-time.

*   **Option A: The Local LLM Setup** (`e2-standard-2` / 2 vCPUs, 8GB RAM). 
    Cost: ~$48/mo. This is the **minimum required** if you intend to run Llama 3.2 via Docker locally on the server.
*   **Option B: The Ultra-Budget Setup** (`e2-medium` / 2 vCPUs, 4GB RAM).
    Cost: ~$24/mo. This will comfortably run your entire stack, **BUT** you must turn off the local `ollama` container and instead use an external API like Groq or Gemini for your AI generation.

---

## 🛠️ Step 1: Create a Google Cloud VM
1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Navigate to **Compute Engine > VM instances** and click **Create Instance**.
3. **Region**: Choose the region closest to your audience (e.g., `asia-south1` for India or `us-central1`).
4. **Machine Configuration**:
    *   Series: `E2`
    *   Machine Type: `e2-medium` or `e2-standard-2` (based on Option A/B above).
5. **Boot Disk**: Click "Change".
    *   OS: **Ubuntu**
    *   Version: **Ubuntu 22.04 LTS**
    *   Size: **30 GB** (Standard Persistent Disk). *Docker images take up space rapidly.*
6. **Firewall**: 
    *   ✅ Allow HTTP traffic
    *   ✅ Allow HTTPS traffic
7. Click **Create** and wait for the VM to spin up.

---

## 🌐 Step 2: Set up a Static IP & Point Your Domain
1. In the Google Cloud Console, search for **IP addresses** (under VPC network).
2. Click **Reserve Static Address**.
3. Name it `zaytri-ip`. Attach it to the **Region** your VM is in, and under **Attached To**, select your newly created VM instance. Click Reserve.
4. Note down the **External IP**.
5. Log into your Domains registrar (GoDaddy, Namecheap, Cloudflare, etc.).
6. Create an **A-Record**:
    *   **Name/Host**: `zaytri` (or depending on the provider, `zaytri.gitlime.com`)
    *   **Value/Points to**: Your GCP External IP.
    *   **TTL**: Auto / 1 hour.

*(Propagation takes some time, usually a few minutes to hours depending on the DNS provider).*

---

## 🔒 Step 3: Install Docker & SSL Certificates
Now SSH into your Google Cloud VM. You can do this by clicking the `SSH` button next to your VM instance in the Google Cloud Console dashboard.

### Install Docker:
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y docker.io docker-compose-v2
sudo systemctl enable docker
sudo systemctl start docker
sudo usermod -aG docker $USER
```
*(You may need to log out and log back into the SSH window for the `docker` permissions to take effect.)*

### Install Certbot for Free HTTPS / SSL:
```bash
sudo apt install -y certbot
sudo certbot certonly --standalone -d zaytri.gitlime.com --non-interactive --agree-tos -m clawtbot@gmail.com
```

---

## 📦 Step 4: Clone the Repo & Run

Inside the VM's SSH window:
1. Clone the repository containing the codebase:
```bash
git clone <YOUR-GITHUB-REPO-URL> project-zaytri
cd project-zaytri
```

2. Generate an `.env.production` file and insert all your secure secrets and API keys:
```bash
nano .env.production
# Paste your secrets here and save (Ctrl+O, Enter, Ctrl+X)
```

3. Our backend API and frontend proxy will securely route internally. The reverse proxy needs to see the newly generated certificates:
```bash
# Link the Certbot SSL directory onto the Nginx configuration path!
sudo ln -s /etc/letsencrypt/live/zaytri.gitlime.com/fullchain.pem ./nginx/ssl/fullchain.pem
sudo ln -s /etc/letsencrypt/live/zaytri.gitlime.com/privkey.pem ./nginx/ssl/privkey.pem
```

4. Bring it all online!
```bash
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
```

---

## 🤖 Automate the Deployment Through AI
If you would like **me (your AI agent)** to deploy this for you right now, there are two ways we can do this securely!

### Method 1: I Deploy directly over SSH!
1. Provision the **Ubuntu Compute Engine VM** on GCP and open ports 80/443 (HTTP/HTTPS) as mentioned in Step 1.
2. Provide me with an **SSH terminal command** containing a private key or password (or create a temporary RSA keypair on your local machine and paste me the private key) along with the server IP!
   *   *(e.g., "My IP is 34.123.45.67, username is ubuntu, and here is a temporary private key: ...")*
3. Make sure DNS is pointed to the IP, and I will connect, pull the repo, compile SSL, configure Nginx, and launch the platform!

### Method 2: You Install The `gcloud` CLI 
1. Install the Google Cloud CLI locally on your macOS: `brew install --cask google-cloud-sdk`
2. Run `gcloud auth login`
3. Tell me when you are logged in. I can then use the `gcloud` CLI directly from my environment to provision the VM, upload the code over an ephemeral SSH tunnel, and launch the deployment from scratch!
