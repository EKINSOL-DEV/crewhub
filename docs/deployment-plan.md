# CrewHub Deployment Plan

> **Doel:** `crewhub.dev` (marketing site) en `docs.crewhub.dev` (Starlight docs) deployen via Coolify  
> **Datum:** 2026-02-05  
> **Status:** Plan - klaar om uit te voeren

---

## Overzicht

| Site | Repo | Domein | Stack |
|------|------|--------|-------|
| Marketing website | `ekinsolbot/crewhub-web` | `crewhub.dev` | Astro 5 + Tailwind CSS 4 |
| Documentatie | `ekinsolbot/crewhub-docs` | `docs.crewhub.dev` | Astro 5 + Starlight |

Beide sites zijn **statische sites** (geen SSR). Astro genereert HTML/CSS/JS naar een `/dist` folder.

---

## 1. Aanbevolen Deployment Approach

### Optie A: Nixpacks (✅ AANBEVOLEN)

Coolify's Nixpacks detecteert automatisch een Node.js project, runt `npm ci` + `npm run build`, en serveert de `/dist` folder via Nginx. Dit is de simpelste en best ondersteunde methode.

**Waarom Nixpacks:**
- Zero config nodig — Coolify leest `package.json` en doet de rest
- Automatische Node.js versie detectie
- Static site checkbox → serveert `/dist` via Nginx op port 80
- Geen Dockerfile onderhoud nodig
- Goed gedocumenteerd door Coolify

**Waarom NIET Dockerfile:**
- `crewhub-docs` heeft al een Dockerfile, maar die luistert op port 4321 (custom) — dat werkt prima maar is meer onderhoud
- Nixpacks doet exact hetzelfde met minder configuratie
- Bij Nixpacks krijg je automatisch de "Static" optimalisaties van Coolify

### Optie B: Dockerfile (alternatief)

`crewhub-docs` heeft al een werkende Dockerfile + nginx.conf. Dit kan ook, maar vereist dat je:
- Port correct instelt (4321 i.p.v. 80)
- Nginx config zelf onderhoudt
- Build pack op "Dockerfile" zet i.p.v. Nixpacks

**Verdict:** Gebruik **Nixpacks + Static** voor beide sites. Simpeler, minder onderhoud, native Coolify support.

---

## 2. DNS Configuratie

### Wat je nodig hebt

Stel: je Coolify server heeft IP `<SERVER_IP>` (dit is het IP van de VPS waar Coolify op draait).

| Type | Naam | Waarde | TTL |
|------|------|--------|-----|
| A | `crewhub.dev` | `<SERVER_IP>` | 300 (of 3600) |
| A | `docs.crewhub.dev` | `<SERVER_IP>` | 300 (of 3600) |

**Optioneel (wildcard):**

| Type | Naam | Waarde | TTL |
|------|------|--------|-----|
| A | `*.crewhub.dev` | `<SERVER_IP>` | 300 |

> Een wildcard record is handig als je later meer subdomeinen wilt (`api.crewhub.dev`, `app.crewhub.dev`, etc.). Maar voor nu zijn 2 A records voldoende.

### Waar in te stellen

Bij je domain registrar (waar je `crewhub.dev` hebt gekocht). Ga naar DNS management en voeg de A records toe.

> **Tip:** Zet TTL eerst op 300 seconden (5 min) zodat changes snel propageren. Later kun je dit verhogen naar 3600.

### SSL/TLS Certificaten

Coolify regelt dit **automatisch** via Let's Encrypt:
- Gebruik `https://crewhub.dev` als domein in Coolify (met `https://` prefix)
- Coolify's reverse proxy (Traefik of Caddy) vraagt automatisch een Let's Encrypt certificaat aan
- Certificaten worden automatisch vernieuwd (elke 90 dagen)
- **Je hoeft NIETS te configureren voor SSL** — het werkt out of the box

---

## 3. Stap-voor-Stap: Coolify Setup

### Pre-requisites

- [ ] DNS records aangemaakt (zie sectie 2)
- [ ] GitHub repos bestaan en zijn up-to-date:
  - `ekinsolbot/crewhub-web` ✅ (bestaat al)
  - `ekinsolbot/crewhub-docs` ⚠️ (moet nog remote toevoegen + pushen)
- [ ] Coolify draait en je bent ingelogd

### Stap 0: crewhub-docs repo klaarzetten

De docs repo heeft nog geen GitHub remote. Eerst aanmaken:

```bash
# Op GitHub: maak repo ekinsolbot/crewhub-docs (private)
# Dan lokaal:
cd ~/ekinapps/crewhub-docs
git remote add origin https://github.com/ekinsolbot/crewhub-docs.git
git add -A
git commit -m "Initial commit: CrewHub documentation"
git push -u origin main
```

### Stap 1: GitHub App configureren in Coolify (eenmalig)

> Als je al een GitHub App hebt geconfigureerd in Coolify, sla deze stap over.

1. In Coolify dashboard → **Sources** (sidebar) → **+ Add**
2. Kies "GitHub App"
3. Vul een naam in (bijv. "CrewHub GitHub")
4. Laat organization leeg (persoonlijk account)
5. Klik **Continue**
6. Selecteer Webhook Endpoint (je Coolify dashboard URL)
7. Klik **Register Now** → je wordt naar GitHub gestuurd
8. Maak de GitHub App aan op GitHub
9. Geef toegang tot `crewhub-web` en `crewhub-docs` repos
10. Klik **Install** → je wordt teruggestuurd naar Coolify

### Stap 2: Project aanmaken in Coolify

1. In Coolify dashboard → **Projects** → **+ Add**
2. Naam: **CrewHub**
3. Project opent automatisch → je ziet "Production" environment

### Stap 3: crewhub.dev deployen (marketing site)

1. In het CrewHub project → Production → **+ New Resource**
2. Kies **Private Repository (with Github App)** (of Public Repository als de repo public is)
3. Selecteer je server
4. Selecteer de GitHub App uit stap 1
5. Kies repository: **crewhub-web**
6. Branch: **main**
7. Build pack: klik op dropdown → kies **Nixpacks**
8. **Vink aan: "Is it a static site?"** ✅
   - Dit zet automatisch:
     - Port → 80
     - Publish directory → `/dist`
9. Klik **Continue**

**Op het configuratiescherm:**

| Instelling | Waarde |
|-----------|--------|
| **Domain** | `https://crewhub.dev` |
| **Branch** | `main` |
| **Build command** | `npm run build` (auto-detected) |
| **Install command** | `npm ci` (auto-detected) |
| **Publish directory** | `/dist` |
| **Port** | `80` |

10. Klik **Deploy**

### Stap 4: docs.crewhub.dev deployen (documentatie)

Herhaal stap 3 maar met deze instellingen:

1. In het CrewHub project → Production → **+ New Resource**
2. Repository: **crewhub-docs**
3. Build pack: **Nixpacks** + **"Is it a static site?"** ✅

| Instelling | Waarde |
|-----------|--------|
| **Domain** | `https://docs.crewhub.dev` |
| **Branch** | `main` |
| **Build command** | `npm run build` |
| **Install command** | `npm ci` |
| **Publish directory** | `/dist` |
| **Port** | `80` |

4. Klik **Deploy**

### Stap 5: Verifiëren

1. Wacht tot beide deployments groen zijn (check Deployment Logs)
2. Bezoek `https://crewhub.dev` → marketing site
3. Bezoek `https://docs.crewhub.dev` → documentatie
4. Check SSL: slotje moet groen zijn in de browser

---

## 4. CI/CD: Auto-Deploy bij Git Push

### Methode A: GitHub App (✅ AANBEVOLEN)

Als je de GitHub App hebt geconfigureerd (stap 1), is auto-deploy **standaard ingeschakeld**. Elke push naar `main` triggert automatisch een nieuwe deployment.

Controleer:
1. Open je app in Coolify → **Advanced** tab
2. Zorg dat **"Auto Deploy"** aan staat

### Methode B: Webhooks (alternatief, als je geen GitHub App gebruikt)

1. In Coolify → je app → **Advanced** → zet **Auto Deploy** aan
2. Vul een **GitHub Webhook Secret** in (random string)
3. Kopieer de webhook URL die Coolify genereert
4. In GitHub → repo → **Settings** → **Webhooks** → **Add webhook**
   - Payload URL: de Coolify webhook URL
   - Secret: de webhook secret uit Coolify
   - Events: "Just the push event"
   - Active: ✅

### Methode C: GitHub Actions (voor meer controle)

Als je meer controle wilt (bijv. tests runnen vóór deploy):

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

> Voor nu is **Methode A (GitHub App)** het simpelst en voldoende.

### Preview Deployments

Coolify ondersteunt preview deployments voor pull requests:
- Wordt automatisch geactiveerd als je de GitHub App gebruikt
- Elke PR krijgt een tijdelijke URL (bijv. `pr-123.crewhub.dev`)
- Vereist wildcard DNS (`*.crewhub.dev`)
- Configureerbaar in de app → **Preview Deployments** tab

---

## 5. Astro Config Aanpassingen

### crewhub-web/astro.config.mjs

Voeg `site` property toe (belangrijk voor SEO/sitemap):

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

> Verwijder de `server.allowedHosts` — die is alleen voor lokale dev.

### crewhub-docs/astro.config.mjs

Ziet er al goed uit. `site: 'https://docs.crewhub.dev'` is al geconfigureerd. Verwijder ook hier de `allowedHosts`:

```javascript
export default defineConfig({
  site: 'https://docs.crewhub.dev',
  // vite.server.allowedHosts niet nodig in productie
  integrations: [
    starlight({ /* ... */ }),
  ],
});
```

---

## 6. Vercel vs. Coolify Vergelijking

| Aspect | Coolify (self-hosted) | Vercel |
|--------|----------------------|--------|
| **Kosten** | Gratis (je betaalt alleen je VPS) | Gratis tier beschikbaar, Pro = $20/maand |
| **Setup** | Meer werk, maar eenmalig | Zero-config, 2 minuten |
| **Performance** | Afhankelijk van je server + locatie | Global CDN, edge network |
| **SSL** | Automatisch (Let's Encrypt) | Automatisch |
| **CI/CD** | GitHub App of webhooks | Native GitHub integratie |
| **Preview deploys** | Ja, via GitHub App | Ja, automatisch per PR |
| **Custom domain** | Ja, onbeperkt | Ja, maar beperkt op free tier |
| **Analytics** | Zelf opzetten (Plausible, etc.) | Ingebouwd (Pro) |
| **Controle** | Vol: je server, je data | Beperkt: hun platform |
| **Vendor lock-in** | Geen | Enige (Vercel-specifieke features) |
| **Bandwidth** | Onbeperkt (je VPS) | 100GB/maand (free), daarna betalen |
| **Complexiteit** | Medium | Laag |

### Verdict

**Coolify is de betere keuze voor jullie use case omdat:**

1. ✅ Je hebt Coolify al draaien met andere projecten
2. ✅ Geen extra kosten (VPS draait al)
3. ✅ Volledige controle over je infrastructure
4. ✅ Geen vendor lock-in
5. ✅ Onbeperkte bandwidth/builds
6. ✅ Alle CrewHub services (web, docs, en later API/app) op één plek

**Vercel zou beter zijn als:**
- Je geen Coolify had en snel iets online wilt
- Je global CDN nodig hebt (kan ook met Cloudflare proxy)
- Je niet zelf servers wilt beheren

---

## 7. Post-Deploy Checklist

- [ ] `crewhub.dev` laadt correct met HTTPS
- [ ] `docs.crewhub.dev` laadt correct met HTTPS
- [ ] SSL certificaten zijn geldig (check via browser)
- [ ] Auto-deploy werkt: push een kleine change en verifieer
- [ ] 404 pagina werkt correct
- [ ] Alle links tussen sites werken (docs verwijst naar crewhub.dev en vice versa)
- [ ] Favicon/meta tags kloppen
- [ ] Google Search Console instellen voor beide domeinen
- [ ] robots.txt en sitemap.xml checken

---

## 8. Optioneel: Cloudflare als DNS Proxy

Als je Cloudflare wilt gebruiken voor extra performance (CDN + DDoS protection):

1. Verplaats nameservers van `crewhub.dev` naar Cloudflare
2. Maak dezelfde A records aan in Cloudflare
3. Zet Proxy status op **"Proxied"** (oranje wolk)
4. **Belangrijk:** In Cloudflare SSL/TLS → zet op **"Full (strict)"**
5. Coolify blijft de origin server, Cloudflare zit ervoor als CDN

> Dit is optioneel maar aanbevolen voor productie. Cloudflare free tier is gratis.

---

## 9. Troubleshooting

### Build faalt
- Check Deployment Logs in Coolify
- Meest voorkomend: Node versie mismatch → stel in via `.node-version` file of Nixpacks config
- `sharp` package (in crewhub-docs) kan build issues geven op Linux → Nixpacks handelt dit normaal goed af

### SSL certificaat werkt niet
- DNS moet correct wijzen naar je server (check met `dig crewhub.dev`)
- Poort 80 en 443 moeten open zijn op je server
- Wacht 5-10 minuten na DNS change voor Let's Encrypt validatie

### Site laadt niet
- Check of de container draait in Coolify
- Check Traefik/Caddy logs
- Verifieer dat domein correct is ingevuld (met `https://` prefix)

---

## Samenvatting: Actieplan

| # | Actie | Wie | Geschatte tijd |
|---|-------|-----|---------------|
| 1 | DNS records aanmaken bij registrar | Nicky | 5 min |
| 2 | `crewhub-docs` repo aanmaken op GitHub + pushen | Ekinbot | 5 min |
| 3 | GitHub App configureren in Coolify (als nog niet gedaan) | Nicky | 10 min |
| 4 | CrewHub project aanmaken in Coolify | Nicky | 2 min |
| 5 | `crewhub-web` deployen (Nixpacks + Static) | Nicky | 5 min |
| 6 | `docs.crewhub.dev` deployen (Nixpacks + Static) | Nicky | 5 min |
| 7 | Verifiëren: sites, SSL, auto-deploy | Nicky | 10 min |
| 8 | Astro configs updaten (`site` property) | Ekinbot | 5 min |
| **Totaal** | | | **~45 min** |

---

*Dit plan is gebaseerd op Coolify v4 documentatie (feb 2026) en de bestaande project configuraties.*
