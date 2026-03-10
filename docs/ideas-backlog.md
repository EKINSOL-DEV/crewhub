
---

## Agent World Vision — Screenshot vanuit camera standpunt

**Idee (2026-03-05):**
Agents de mogelijkheid geven om een screenshot te nemen vanuit hun eigen camera-perspectief in de 3D wereld. De agent "ziet" letterlijk wat er voor hem staat in The Instance.

### Technische aanpak
- Three.js renderer heeft al een `gl.domElement` — daarvan kan je `.toDataURL()` of `.toBlob()` aanroepen
- Bij een "vision request" van een agent: tijdelijk de camera naar het bot-perspectief bewegen (of een off-screen render doen vanuit de positie van de bot), screenshot nemen, als base64 image terugsturen naar de agent
- Off-screen render = cleaner: gebruik een aparte `WebGLRenderTarget`, render de scene vanuit bot POV zonder de hoofdcamera te verstoren
- API endpoint: `POST /api/agents/{key}/vision` → geeft PNG terug (of base64 in JSON)
- Agent kan dit aanroepen als tool call: `take_screenshot()`

### Toepassingen

1. **Situational awareness** — Agent ziet welke andere bots er in zijn kamer zijn, welke projecten er actief zijn, wie er bezig is
2. **Debuggen van de 3D wereld** — Agent kan melden "ik zie een bot die al 2u in dezelfde positie staat" → kan escaleren naar Nicky
3. **Visuele taakbevestiging** — Na het voltooien van een taak screenshot nemen en bevestigen "kamer X ziet er nu zo uit"
4. **Sociale interactie** — Agents die naar elkaar "kijken" voor context, bijv. Flowy die naar Creator kijkt voor status
5. **Watch Agent (Are the Bots Okay?)** — Automatisch screenshots nemen bij errors/anomalieën en in het WhatsApp-rapport steken
6. **Toegankelijkheid** — Vision-capable LLMs kunnen de screenshot analyseren en beschrijven wat er in de wereld gebeurt
7. **Show presenter** — The Announcer kan de 3D wereld "zien" en levendig commentaar geven op wat The Judge aan het doen is

### Fases
1. **Proof of concept:** canvas screenshot van hoofdcamera (simpelste)
2. **Bot POV render:** off-screen WebGLRenderTarget vanuit bot-positie
3. **Tool call integratie:** agent kan `vision()` aanroepen als tool
4. **Vision LLM koppeling:** screenshot automatisch naar Claude/GPT-4V sturen voor analyse
