# CrewHub Deployment Plan

> **Goal:** Deploy `crewhub.dev` (marketing site) and `docs.crewhub.dev` (Starlight docs) via Coolify  
> **Date:** 2026-02-05  
> **Status:** Plan - ready to execute

---

## Overview

| Site | Repo | Domain | Stack |
|------|------|--------|-------|
| Marketing website | `ekinsolbot/crewhub-web` | `crewhub.dev` | Astro 5 + Tailwind CSS 4 |
| Documentation | `ekinsolbot/crewhub-docs` | `docs.crewhub.dev` | Astro 5 + Starlight |

Both sites are **static sites** (no SSR). Astro generates HTML/CSS/JS to a `/dist` folder.

---

## 1. Recommended Deployment Approach

### Option A: Nixpacks (✅ RECOMMENDED)

Coolify's Nixpacks automatically detects a Node.js project, runs `npm ci` + `npm run build`, and serves the `/dist` folder via Nginx. This is the simplest and best supported method.

**Why Nixpacks:**
- Zero config needed — Coolify reads `package.json` and does the rest
- Automatic Node.js version detection
- Static site checkbox → serves `/dist` via Nginx on port 80
- No Dockerfile maintenance needed
- Well documented by Coolify

**Why NOT Dockerfile:**
- `crewhub-docs` already has a Dockerfile, but it listens on port 4321 (custom) — that works fine but is more maintenance
- Nixpacks does exactly the same with less configuration
- With Nixpacks you automatically get the "Static" optimizations from Coolify

### Option B: Dockerfile (alternative)

`crewhub-docs` already has a working Dockerfile + nginx.conf. This can also be used, but requires that you:
- Set port correctly (4321 instead of 80)
- Maintain Nginx config yourself
- Set build pack to "Dockerfile" instead of Nixpacks

**Verdict:** Use **Nixpacks + Static** for both sites. Simpler, less maintenance, native Coolify support.

---

## 2. DNS Configuration

### What you need

Assuming: your Coolify server has IP `<SERVER_IP>` (this is the IP of the VPS where Coolify is running).

| Type | Name | Value | TTL |
|------|------|--------|-----|
| A | `crewhub.dev` | `<SERVER_IP>` | 300 (or 3600) |
| A | `docs.crewhub.dev` | `<SERVER_IP>` | 300 (or 3600) |

**Optional (wildcard):**

| Type | Name | Value | TTL |
|------|------|--------|-----|
| A | `*.crewhub.dev` | `<SERVER_IP>` | 300 |

> A wildcard record is useful if you want more subdomains later (`api.crewhub.dev`, `app.crewhub.dev`, etc.). But for now 2 A records are sufficient.

### Where to set up

At your domain registrar (where you purchased `crewhub.dev`). Go to DNS management and add the A records.

> **Tip:** Set TTL to 300 seconds (5 min) first so changes propagate quickly. Later you can increase this to 3600.

### SSL/TLS Certificates

Coolify handles this **automatically** via Let's Encrypt:
- Use `https://crewhub.dev` as domain in Coolify (with `https://` prefix)
- Coolify's reverse proxy (Traefik or Caddy) automatically requests a Let's Encrypt certificate
- Certificates are automatically renewed (every 90 days)
- **You don't need to configure ANYTHING for SSL** — it works out of the box

---

## 3. Step-by-Step: Coolify Setup

### Pre-requisites

- [ ] DNS records created (see section 2)
- [ ] GitHub repos exist and are up-to-date:
  - `ekinsolbot/crewhub-web` ✅ (already exists)
  - `ekinsolbot/crewhub-docs` ⚠️ (still needs to add remote + push)
- [ ] Coolify is running and you are logged in

### Step 0: Prepare crewhub-docs repo

The docs repo doesn't have a GitHub remote yet. First create one:

```bash
# On GitHub: create repo ekinsolbot/crewhub-docs (private)
# Then locally:
cd ~/ekinapps/crewhub-docs
git remote add origin https://github.com/ekinsolbot/crewhub-docs.git
git add -A
git commit -m "Initial commit: CrewHub documentation"
git push -u origin main
```

### Step 1: Configure GitHub App in Coolify (one-time)

> If you already have a GitHub App configured in Coolify, skip this step.

1. In Coolify dashboard → **Sources** (sidebar) → **+ Add**
2. Choose "GitHub App"
3. Fill in a name (e.g., "CrewHub GitHub")
4. Leave organization empty (personal account)
5. Click **Continue**
6. Select Webhook Endpoint (your Coolify dashboard URL)
7. Click **Register Now** → you will be redirected to GitHub
8. Create the GitHub App on GitHub
9. Give access to `crewhub-web` and `crewhub-docs` repos
10. Click **Install** → you will be redirected back to Coolify

### Step 2: Create Project in Coolify

1. In Coolify dashboard → **Projects** → **+ Add**
2. Name: **CrewHub**
3. Project opens automatically → you see "Production" environment

### Step 3: Deploy crewhub.dev (marketing site)

1. In the CrewHub project → Production → **+ New Resource**
2. Choose **Private Repository (with Github App)** (or Public Repository if the repo is public)
3. Select your server
4. Select the GitHub App from step 1
5. Choose repository: **crewhub-web**
6. Branch: **main**
7. Build pack: click on dropdown → choose **Nixpacks**
8. **Check: "Is it a static site?"** ✅
   - This automatically sets:
     - Port → 80
     - Publish directory → `/dist`
9. Click **Continue**

**On the configuration screen:**

| Setting | Value |
|-----------|--------|
| **Domain** | `https://crewhub.dev` |
| **Branch** | `main` |
| **Build command** | `npm run build` (auto-detected) |
| **Install command** | `npm ci` (auto-detected) |
| **Publish directory** | `/dist` |
| **Port** | `80` |

10. Click **Deploy**

### Step 4: Deploy docs.crewhub.dev (documentation)

Repeat step 3 but with these settings:

1. In the CrewHub project → Production → **+ New Resource**
2. Repository: **crewhub-docs**
3. Build pack: **Nixpacks** + **"Is it a static site?"** ✅

| Setting | Value |
|-----------|--------|
| **Domain** | `https://docs.crewhub.dev` |
| **Branch** | `main` |
| **Build command** | `npm run build` |
| **Install command** | `npm ci` |
| **Publish directory** | `/dist` |
| **Port** | `80` |

4. Click **Deploy**

### Step 5: Verify

1. Wait until both deployments are green (check Deployment Logs)
2. Visit `https://crewhub.dev` → marketing site
3. Visit `https://docs.crewhub.dev` → documentation
4. Check SSL: lock icon should be green in the browser

---

## 4. CI/CD: Auto-Deploy on Git Push

### Method A: GitHub App (✅ RECOMMENDED)

If you have configured the GitHub App (step 1), auto-deploy is **enabled by default**. Every push to `main` automatically triggers a new deployment.

Verify:
1. Open your app in Coolify → **Advanced** tab
2. Ensure **"Auto Deploy"** is on

### Method B: Webhooks (alternative, if you don't use GitHub App)

1. In Coolify → your app → **Advanced** → enable **Auto Deploy**
2. Fill in a **GitHub Webhook Secret** (random string)
3. Copy the webhook URL that Coolify generates
4. In GitHub → repo → **Settings** → **Webhooks** → **Add webhook**
   - Payload URL: the Coolify webhook URL
   - Secret: the webhook secret from Coolify
   - Events: "Just the push event"
   - Active: ✅

### Method C: GitHub Actions (for more control)

If you want more control (e.g., run tests before deploy):

```yaml
# .github/workflows/deploy.yml
name: Deploy to Coolify

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger Coolify deployment
        uses: fjogeleit/http-request-action@v1
        with:
          url: ${{ secrets.COOLIFY_URL }}/api/v1/deploy?uuid=${{ secrets.COOLIFY_RESOURCE_ID }}&force=false
          method: GET
          bearerToken: ${{ secrets.COOLIFY_API_TOKEN }}
```

> For now **Method A (GitHub App)** is the simplest and sufficient.

### Preview Deployments

Coolify supports preview deployments for pull requests:
- Automatically activated if you use the GitHub App
- Each PR gets a temporary URL (e.g., `pr-123.crewhub.dev`)
- Requires wildcard DNS (`*.crewhub.dev`)
- Configurable in the app → **Preview Deployments** tab

---

## 5. Astro Config Adjustments

### crewhub-web/astro.config.mjs

Add `site` property (important for SEO/sitemap):

```javascript
// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: 'https://crewhub.dev',
  vite: {
    plugins: [tailwindcss()],
  }
});
```

> Remove the `server.allowedHosts` — that's only for local dev.

### crewhub-docs/astro.config.mjs

Already looks good. `site: 'https://docs.crewhub.dev'` is already configured. Remove the `allowedHosts` here too:

```javascript
export default defineConfig({
  site: 'https://docs.crewhub.dev',
  // vite.server.allowedHosts not needed in production
  integrations: [
    starlight({ /* ... */ }),
  ],
});
```

---

## 6. Vercel vs. Coolify Comparison

| Aspect | Coolify (self-hosted) | Vercel |
|--------|----------------------|--------|
| **Cost** | Free (you only pay for your VPS) | Free tier available, Pro = $20/month |
| **Setup** | More work, but one-time | Zero-config, 2 minutes |
| **Performance** | Depends on your server + location | Global CDN, edge network |
| **SSL** | Automatic (Let's Encrypt) | Automatic |
| **CI/CD** | GitHub App or webhooks | Native GitHub integration |
| **Preview deploys** | Yes, via GitHub App | Yes, automatic per PR |
| **Custom domain** | Yes, unlimited | Yes, but limited on free tier |
| **Analytics** | Set up yourself (Plausible, etc.) | Built-in (Pro) |
| **Control** | Full: your server, your data | Limited: their platform |
| **Vendor lock-in** | None | Some (Vercel-specific features) |
| **Bandwidth** | Unlimited (your VPS) | 100GB/month (free), then pay |
| **Complexity** | Medium | Low |

### Verdict

**Coolify is the better choice for your use case because:**

1. ✅ You already have Coolify running with other projects
2. ✅ No extra costs (VPS is already running)
3. ✅ Full control over your infrastructure
4. ✅ No vendor lock-in
5. ✅ Unlimited bandwidth/builds
6. ✅ All CrewHub services (web, docs, and later API/app) in one place

**Vercel would be better if:**
- You didn't have Coolify and want something online quickly
- You need global CDN (can also do with Cloudflare proxy)
- You don't want to manage servers yourself

---

## 7. Post-Deploy Checklist

- [ ] `crewhub.dev` loads correctly with HTTPS
- [ ] `docs.crewhub.dev` loads correctly with HTTPS
- [ ] SSL certificates are valid (check via browser)
- [ ] Auto-deploy works: push a small change and verify
- [ ] 404 page works correctly
- [ ] All links between sites work (docs refers to crewhub.dev and vice versa)
- [ ] Favicon/meta tags are correct
- [ ] Set up Google Search Console for both domains
- [ ] Check robots.txt and sitemap.xml

---

## 8. Optional: Cloudflare as DNS Proxy

If you want to use Cloudflare for extra performance (CDN + DDoS protection):

1. Move nameservers of `crewhub.dev` to Cloudflare
2. Create the same A records in Cloudflare
3. Set Proxy status to **"Proxied"** (orange cloud)
4. **Important:** In Cloudflare SSL/TLS → set to **"Full (strict)"**
5. Coolify remains the origin server, Cloudflare sits in front as CDN

> This is optional but recommended for production. Cloudflare free tier is free.

---

## 9. Troubleshooting

### Build fails
- Check Deployment Logs in Coolify
- Most common: Node version mismatch → set via `.node-version` file or Nixpacks config
- `sharp` package (in crewhub-docs) can cause build issues on Linux → Nixpacks normally handles this well

### SSL certificate doesn't work
- DNS must correctly point to your server (check with `dig crewhub.dev`)
- Port 80 and 443 must be open on your server
- Wait 5-10 minutes after DNS change for Let's Encrypt validation

### Site doesn't load
- Check if the container is running in Coolify
- Check Traefik/Caddy logs
- Verify that domain is correctly filled in (with `https://` prefix)

---

## Summary: Action Plan

| # | Action | Who | Estimated time |
|---|-------|-----|---------------|
| 1 | Create DNS records at registrar | Nicky | 5 min |
| 2 | Create `crewhub-docs` repo on GitHub + push | Ekinbot | 5 min |
| 3 | Configure GitHub App in Coolify (if not done yet) | Nicky | 10 min |
| 4 | Create CrewHub project in Coolify | Nicky | 2 min |
| 5 | Deploy `crewhub-web` (Nixpacks + Static) | Nicky | 5 min |
| 6 | Deploy `docs.crewhub.dev` (Nixpacks + Static) | Nicky | 5 min |
| 7 | Verify: sites, SSL, auto-deploy | Nicky | 10 min |
| 8 | Update Astro configs (`site` property) | Ekinbot | 5 min |
| **Total** | | | **~45 min** |

---

*This plan is based on Coolify v4 documentation (Feb 2026) and the existing project configurations.*
