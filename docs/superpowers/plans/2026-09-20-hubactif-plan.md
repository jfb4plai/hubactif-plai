# HubActif Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construire HubActif, l'app qui centralise les assignations de tâches issues de plusieurs apps PLAI et donne à l'enseignant une vue transversale du suivi, avec un espace élève sans compte (codes, liens courts, QR).

**Architecture:** App React/Vite + fonctions serverless Vercel + tables Supabase préfixées `hub_`. Le hub génère des liens courts (`/a/<id>`) qui redirigent vers l'app d'origine avec un jeton ES256 signé (120 h). Les apps renvoient des événements à `POST /api/events` via un relais serveur qui porte la clé d'app. Toute la logique testable (jetons, schémas, dates, handlers) est extraite en modules purs avec injection de dépendances.

**Tech Stack:** React 18, Vite 5, react-router-dom 6, @supabase/supabase-js 2, qrcode, WebCrypto (ES256), `node:test`, Vercel Serverless Functions (ESM), Supabase (auth + PostgreSQL + RLS).

**Spec de référence :** `docs/superpowers/specs/2026-09-20-hubactif-design.md`

---

## Périmètre de ce plan

Inclus : l'app HubActif complète (dépôt `jfb4plai/hubactif-plai`) et le SDK à copier dans les apps (`sdk/`).

Exclus, à traiter dans des plans séparés (dépôts et déploiements distincts) :
1. Migration des trois apps pilotes (Dictée interactive, LexiActif, FlashPLAI) : bouton « Assigner via le hub », relais `api/hub-event.js`, lecture du jeton.
2. Vignette dans `portail-plai/src/data/apps.ts` avec lien « Mes tâches ».

## Précisions par rapport à la spec (à reporter dans la spec, Task 25)

- **Pas de Tailwind** : `plai-style.css` + `src/hub.css` suffisent (YAGNI). Les surcharges de `hub.css` portent toutes les tailles à 16 px minimum.
- **La clé d'app ne peut pas vivre dans un navigateur.** Les événements passent par un relais serveur dans l'app (`api/hub-event.js`, modèle dans `sdk/relay-event.js`), qui ajoute `x-app-key` depuis une variable d'environnement.
- **Limite de confiance** : un statut est déclaré par le client de l'app. La clé et le jeton empêchent les tiers de forger des événements, pas un élève technique qui rejoue son propre jeton. Enjeu faible (pas de note), à dire clairement dans la doc du contrat.
- **Le SDK décode le jeton** (code élève, expiration) mais ne vérifie pas la signature. La signature est vérifiée par le hub à chaque événement.
- `hub_events` référence `target_id` (qui implique assignation et élève). `hub_assignments` porte un `class_id`.
- Jeton signé en **ES256** (ECDSA P-256), pris en charge par WebCrypto partout.

## Conventions (valables pour toutes les tâches)

- Dossier de travail : `C:\Users\jfbeg\OneDrive\claude-workspace\hubactif` (dépôt déjà initialisé, branche `main`, remote `origin`). Node 24 et npm 11 sont installés.
- Tests : `npm test` (= `node --test`, découvre `tests/*.test.mjs`). Les modules partagés sont en ESM pur.
- Chaque commit se termine par `-m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"`.
- **Avant tout `git push` : `npx vite build` doit passer.** Chaque push déclenche un déploiement Vercel. Branche : `main`.
- Aucune clé côté frontend. Aucun `console.log` de données utilisateur (`console.warn` sans donnée personnelle autorisé côté serveur).
- Tables Supabase : préfixe `hub_` uniquement.
- Vouvoiement dans l'espace enseignant, tutoiement dans l'espace élève. Exemples et placeholders en contexte FWB. Pas d'emojis.
- Guidage contextuel obligatoire sur chaque champ : label, placeholder concret, texte d'aide (`Field`).

## Structure des fichiers

```
hubactif/
  package.json  vite.config.js  index.html  vercel.json  .gitignore  .env.example
  public/plai-logo.jpg
  shared/            modules purs, utilisés par le frontend, l'API et les scripts
    codes.js  token.js  eventSchema.js  assignmentSchema.js  dates.js  hash.js
  api/
    events.js  go.js  student.js  assignments.js  cron/purge.js
    _lib/            admin.js  rate.js  requireUser.js
                     eventsHandler.js  goHandler.js  studentHandler.js
                     assignmentsHandler.js  purgeHandler.js
  supabase/migrations/20260920000000_hub_init.sql
  scripts/           gen-keys.mjs  register-app.mjs  e2e-smoke.mjs
  sdk/               hub-client.js  relay-event.js
  src/
    main.jsx  App.jsx  plai-style.css  hub.css
    lib/             supabase.js  api.js  db.js  students.js  matrix.js
    context/         AuthContext.jsx
    components/      Layout.jsx  ProtectedRoute.jsx  Field.jsx  QrImage.jsx
                     NoScoreBanner.jsx  ResetBanner.jsx  StudentsPanel.jsx  ClassGrid.jsx
    pages/           StudentHome.jsx  LoginPage.jsx  ClassesPage.jsx  ClassPage.jsx
                     AssignPage.jsx  SheetPage.jsx  StudentFilePage.jsx
  tests/             helpers.mjs  *.test.mjs  db.integration.mjs
  docs/              CONTRAT-API.md
```

---

### Task 1: Échafaudage du projet

**Files:**
- Create: `package.json`, `vite.config.js`, `index.html`, `vercel.json`, `.gitignore`, `.env.example`, `src/main.jsx`, `src/App.jsx`, `src/hub.css`
- Copy: `src/plai-style.css`, `public/plai-logo.jpg`

- [ ] **Step 1: Écrire `package.json`**

```json
{
  "name": "hubactif-plai",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "engines": { "node": ">=20.6" },
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "node --test",
    "test:db": "node --env-file=.env.local tests/db.integration.mjs",
    "test:e2e": "node --env-file=.env.local scripts/e2e-smoke.mjs",
    "keys": "node scripts/gen-keys.mjs"
  }
}
```

- [ ] **Step 2: Installer les dépendances**

Run (dans `hubactif/`) :
```bash
npm install react@18 react-dom@18 react-router-dom@6 @supabase/supabase-js@2 qrcode
npm install -D vite@5 @vitejs/plugin-react@4
```
Expected : `added N packages`, aucune erreur.

- [ ] **Step 3: Copier la charte et le logo PLAI**

```bash
mkdir -p src public
cp ../shared/css/plai-style.css src/plai-style.css
cp ../projets/portail-plai/public/plai-logo.jpg public/plai-logo.jpg
ls -l src/plai-style.css public/plai-logo.jpg
```
Expected : les deux fichiers listés (non vides).

- [ ] **Step 4: Écrire `vite.config.js`**

```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: { port: 5180 },
})
```

- [ ] **Step 5: Écrire `index.html`**

```html
<!doctype html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>HubActif — vos tâches PLAI au même endroit</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=DM+Serif+Display&display=swap" rel="stylesheet" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

- [ ] **Step 6: Écrire `src/hub.css`** (surcharges : 16 px minimum, grille, feuille imprimable)

```css
/* HubActif : la charte PLAI descend à 13-15 px par endroits ; la règle PLAI impose 16 px minimum. */
body { font-size: 16px; }
.plai-container { max-width: 1000px; }
.plai-label, .plai-input, .plai-btn, .plai-btn-ghost, .plai-nav-link,
.plai-error, .plai-success, .plai-banner, .plai-footer { font-size: 16px; }
.plai-btn, .plai-btn-ghost { min-height: 44px; }
.plai-nav-logo { font-size: 20px; }
.hub-help { font-size: 16px; color: var(--text2); margin-top: 4px; }
.hub-row { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
.hub-stack > * + * { margin-top: 1rem; }
.hub-code { font-family: 'Courier New', monospace; font-size: 18px; letter-spacing: 1px; font-weight: 700; }
.hub-status { display: inline-flex; gap: 6px; align-items: center; font-weight: 600; }
.hub-grid-wrap { overflow-x: auto; }
.hub-grid { border-collapse: collapse; width: 100%; }
.hub-grid th, .hub-grid td { border: 1px solid var(--border2); padding: 8px 10px; text-align: left; vertical-align: top; }
.hub-student { font-family: Arial, Helvetica, sans-serif; font-size: 18px; line-height: 1.6; }
.hub-student .plai-btn, .hub-student .plai-btn-ghost, .hub-student .plai-input { font-family: Arial, Helvetica, sans-serif; font-size: 18px; }
.hub-sheet { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
.hub-sheet-card { border: 1px dashed #666; padding: 12px; break-inside: avoid; text-align: center; }
@media print {
  .plai-nav, .plai-footer, .hub-noprint { display: none !important; }
  body { background: #fff; }
}
```

- [ ] **Step 7: Écrire `src/main.jsx` et un `src/App.jsx` provisoire**

`src/main.jsx` :
```jsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import './plai-style.css'
import './hub.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
)
```
`src/App.jsx` (remplacé à la Task 17) :
```jsx
export default function App() {
  return <p>HubActif</p>
}
```

- [ ] **Step 8: Écrire `vercel.json`, `.gitignore`, `.env.example`**

`vercel.json` :
```json
{
  "rewrites": [
    { "source": "/a/:id", "destination": "/api/go?id=:id" },
    { "source": "/api/(.*)", "destination": "/api/$1" },
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```
`.gitignore` :
```
node_modules
dist
.env
.env.local
.vercel
```
`.env.example` :
```
# Frontend (public, préfixe VITE_)
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=

# Serveur uniquement (variables Vercel, jamais VITE_*)
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
HUB_SIGNING_PRIVATE_KEY=
HUB_SIGNING_PUBLIC_KEY=
CRON_SECRET=
```

- [ ] **Step 9: Vérifier le build**

Run : `npx vite build`
Expected : `built in Xs`, dossier `dist/` créé, aucune erreur.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "chore: échafaudage Vite + charte PLAI" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: Codes (génération, normalisation, collage de liste)

**Files:**
- Create: `shared/codes.js`
- Test: `tests/codes.test.mjs`

- [ ] **Step 1: Écrire le test qui échoue**

`tests/codes.test.mjs` :
```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { CODE_ALPHABET, generateCode, normalizeCode, parseCodeList, isValidCode } from '../shared/codes.js'

test('generateCode : 8 caractères, alphabet sans ambiguïté', () => {
  const code = generateCode()
  assert.equal(code.length, 8)
  for (const ch of code) assert.ok(CODE_ALPHABET.includes(ch))
  assert.ok(!/[01ILO]/.test(CODE_ALPHABET))
})

test('generateCode utilise le générateur injecté', () => {
  assert.equal(generateCode(4, () => 0), CODE_ALPHABET[0].repeat(4))
})

test('normalizeCode : majuscules, espaces retirés', () => {
  assert.equal(normalizeCode('  ab-12 '), 'AB-12')
  assert.equal(normalizeCode(null), '')
})

test('parseCodeList : sépare, normalise, dédoublonne', () => {
  assert.deepEqual(
    parseCodeList('eleve01\nELEVE02, eleve01; eleve03  \n\n'),
    ['ELEVE01', 'ELEVE02', 'ELEVE03']
  )
})

test('isValidCode', () => {
  assert.ok(isValidCode('ELEVE01'))
  assert.ok(isValidCode('AB-12'))
  assert.ok(!isValidCode('AB'))
  assert.ok(!isValidCode('A B C'))
})
```

- [ ] **Step 2: Lancer le test, vérifier l'échec**

Run : `npm test`
Expected : FAIL, `Cannot find module '../shared/codes.js'`.

- [ ] **Step 3: Implémenter `shared/codes.js`**

```js
// Alphabet sans caractères ambigus (0/O, 1/I/L) : 31 symboles, 8 caractères ≈ 40 bits.
export const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
export const CODE_LENGTH = 8
export const CLASS_CODE_LENGTH = 6

// Tirage sans biais de modulo (rejet des valeurs au-delà du plus grand multiple de max).
function secureRandom(max) {
  const limit = Math.floor(256 / max) * max
  const buf = new Uint8Array(1)
  for (;;) {
    crypto.getRandomValues(buf)
    if (buf[0] < limit) return buf[0] % max
  }
}

export function generateCode(length = CODE_LENGTH, random = secureRandom) {
  let out = ''
  for (let i = 0; i < length; i++) out += CODE_ALPHABET[random(CODE_ALPHABET.length)]
  return out
}

export function normalizeCode(raw) {
  return String(raw ?? '').trim().toUpperCase()
}

// Liste collée par l'enseignant : un code par ligne ou séparés par virgule, point-virgule, espace.
export function parseCodeList(text) {
  const seen = new Set()
  const codes = []
  for (const part of String(text ?? '').split(/[\s,;]+/)) {
    const code = normalizeCode(part)
    if (!code || seen.has(code)) continue
    seen.add(code)
    codes.push(code)
  }
  return codes
}

// Même contrainte que le check SQL de hub_students.code.
export const isValidCode = (code) => /^[A-Z0-9_-]{3,32}$/.test(code)
```

- [ ] **Step 4: Relancer les tests**

Run : `npm test`
Expected : PASS, 5 tests, 0 fail.

- [ ] **Step 5: Commit**

```bash
git add shared/codes.js tests/codes.test.mjs
git commit -m "feat: génération et normalisation des codes" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: Jetons signés ES256 et script de clés

**Files:**
- Create: `shared/token.js`, `scripts/gen-keys.mjs`
- Test: `tests/token.test.mjs`

- [ ] **Step 1: Écrire le test qui échoue**

`tests/token.test.mjs` :
```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { generateKeyPair, signToken, verifyToken, TokenError, TOKEN_TTL_SECONDS } from '../shared/token.js'

const NOW = 1_800_000_000
const payload = { tid: 't1', aid: 'a1', code: 'ABCD2345', app: 'dictee', exp: NOW + 3600 }

async function expectCode(promise, code) {
  await assert.rejects(promise, (e) => e instanceof TokenError && e.code === code)
}

test('TTL = 120 h', () => assert.equal(TOKEN_TTL_SECONDS, 120 * 3600))

test('jeton valide : aller-retour', async () => {
  const { privateKey, publicKey } = await generateKeyPair()
  const token = await signToken(payload, privateKey)
  assert.deepEqual(await verifyToken(token, publicKey, NOW), payload)
})

test('jeton expiré', async () => {
  const { privateKey, publicKey } = await generateKeyPair()
  const token = await signToken({ ...payload, exp: NOW - 1 }, privateKey)
  await expectCode(verifyToken(token, publicKey, NOW), 'expired')
})

test('signature d’une autre clé refusée', async () => {
  const a = await generateKeyPair()
  const b = await generateKeyPair()
  const token = await signToken(payload, a.privateKey)
  await expectCode(verifyToken(token, b.publicKey, NOW), 'bad_signature')
})

test('corps altéré (signature d’un autre jeton) refusé', async () => {
  const { privateKey, publicKey } = await generateKeyPair()
  const t1 = await signToken(payload, privateKey)
  const t2 = await signToken({ ...payload, code: 'ZZZZ9999' }, privateKey)
  const forged = `${t2.split('.')[0]}.${t1.split('.')[1]}`
  await expectCode(verifyToken(forged, publicKey, NOW), 'bad_signature')
})

test('jeton mal formé', async () => {
  const { publicKey } = await generateKeyPair()
  await expectCode(verifyToken('nimporte-quoi', publicKey, NOW), 'malformed')
  await expectCode(verifyToken(undefined, publicKey, NOW), 'malformed')
})
```

- [ ] **Step 2: Vérifier l'échec**

Run : `npm test`
Expected : FAIL, `Cannot find module '../shared/token.js'`.

- [ ] **Step 3: Implémenter `shared/token.js`**

```js
// Jeton compact : base64url(JSON).base64url(signature ECDSA P-256 / SHA-256, format IEEE P1363).
// Fonctionne à l'identique dans Node ≥ 20 et dans les navigateurs (WebCrypto).
const encoder = new TextEncoder()
const decoder = new TextDecoder()

export const TOKEN_TTL_SECONDS = 120 * 3600 // 5 jours : couvre un week-end

const KEY_ALGO = { name: 'ECDSA', namedCurve: 'P-256' }
const SIGN_ALGO = { name: 'ECDSA', hash: 'SHA-256' }

export class TokenError extends Error {
  constructor(code) {
    super(code)
    this.code = code // 'malformed' | 'bad_signature' | 'expired'
  }
}

export function b64uEncode(bytes) {
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function b64uDecode(str) {
  const s = str.replace(/-/g, '+').replace(/_/g, '/')
  const padded = s + '='.repeat((4 - (s.length % 4)) % 4)
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0))
}

// Retourne { privateKey, publicKey } en base64url (PKCS8 / SPKI), prêtes pour les variables d'environnement.
export async function generateKeyPair() {
  const pair = await crypto.subtle.generateKey(KEY_ALGO, true, ['sign', 'verify'])
  const privateKey = b64uEncode(new Uint8Array(await crypto.subtle.exportKey('pkcs8', pair.privateKey)))
  const publicKey = b64uEncode(new Uint8Array(await crypto.subtle.exportKey('spki', pair.publicKey)))
  return { privateKey, publicKey }
}

export async function signToken(payload, privateKeyB64) {
  const key = await crypto.subtle.importKey('pkcs8', b64uDecode(privateKeyB64), KEY_ALGO, false, ['sign'])
  const body = b64uEncode(encoder.encode(JSON.stringify(payload)))
  const sig = await crypto.subtle.sign(SIGN_ALGO, key, encoder.encode(body))
  return `${body}.${b64uEncode(new Uint8Array(sig))}`
}

export async function verifyToken(token, publicKeyB64, nowSec = Math.floor(Date.now() / 1000)) {
  const parts = String(token ?? '').split('.')
  if (parts.length !== 2) throw new TokenError('malformed')
  const [body, sigB64] = parts
  let sig, payload
  try {
    sig = b64uDecode(sigB64)
    payload = JSON.parse(decoder.decode(b64uDecode(body)))
  } catch {
    throw new TokenError('malformed')
  }
  const key = await crypto.subtle.importKey('spki', b64uDecode(publicKeyB64), KEY_ALGO, false, ['verify'])
  const ok = await crypto.subtle.verify(SIGN_ALGO, key, sig, encoder.encode(body))
  if (!ok) throw new TokenError('bad_signature')
  if (typeof payload.exp !== 'number' || payload.exp <= nowSec) throw new TokenError('expired')
  return payload
}
```

- [ ] **Step 4: Relancer les tests**

Run : `npm test`
Expected : PASS (tests codes + token), 0 fail.

- [ ] **Step 5: Écrire `scripts/gen-keys.mjs`**

```js
import { generateKeyPair } from '../shared/token.js'

const { privateKey, publicKey } = await generateKeyPair()
console.log('# À coller dans les variables d\'environnement Vercel (et .env.local). Ne jamais commiter la clé privée.')
console.log(`HUB_SIGNING_PRIVATE_KEY=${privateKey}`)
console.log(`HUB_SIGNING_PUBLIC_KEY=${publicKey}`)
```

- [ ] **Step 6: Générer les clés et les ranger dans `.env.local`**

Run : `npm run keys`
Expected : deux lignes `HUB_SIGNING_...=`. Copier ces lignes dans `.env.local` (fichier ignoré par git). Ne rien commiter.

- [ ] **Step 7: Commit**

```bash
git add shared/token.js scripts/gen-keys.mjs tests/token.test.mjs
git commit -m "feat: jetons ES256 (signature, vérification, génération de clés)" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: Schéma strict des événements

**Files:**
- Create: `shared/eventSchema.js`
- Test: `tests/eventSchema.test.mjs`

- [ ] **Step 1: Écrire le test qui échoue**

`tests/eventSchema.test.mjs` :
```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { validateEvent } from '../shared/eventSchema.js'

const app = { base_url: 'https://dictee.example.org', indicator_labels: ['mots réussis', 'essais'] }
const EID = '11111111-1111-4111-8111-111111111111'
const base = { event_id: EID, status: 'completed' }

test('événement minimal valide', () => {
  const r = validateEvent(base, app)
  assert.equal(r.ok, true)
  assert.deepEqual(r.value.indicators, [])
  assert.equal(r.value.duration_s, null)
})

test('événement complet valide, valeurs normalisées', () => {
  const r = validateEvent({
    ...base, occurred_at: '2026-09-21T10:00:00Z', duration_s: 300, attempts: 2,
    indicators: [{ label: 'mots réussis', value: 14 }, { label: 'essais', value: 'trois' }],
    detail_url: 'https://dictee.example.org/eleve/42',
  }, app)
  assert.equal(r.ok, true)
  assert.equal(r.value.occurred_at, '2026-09-21T10:00:00.000Z')
  assert.equal(r.value.indicators.length, 2)
})

test('refus : event_id, status', () => {
  assert.equal(validateEvent({ ...base, event_id: 'abc' }, app).ok, false)
  assert.equal(validateEvent({ ...base, status: 'done' }, app).ok, false)
  assert.equal(validateEvent(null, app).ok, false)
})

test('refus : libellé non déclaré, trop long, valeur libre trop longue', () => {
  assert.equal(validateEvent({ ...base, indicators: [{ label: 'inconnu', value: 1 }] }, app).ok, false)
  assert.equal(validateEvent({ ...base, indicators: [{ label: 'essais', value: 'x'.repeat(21) }] }, app).ok, false)
  assert.equal(validateEvent({ ...base, indicators: [{ label: 'essais', value: { a: 1 } }] }, app).ok, false)
  assert.equal(validateEvent({ ...base, indicators: Array(11).fill({ label: 'essais', value: 1 }) }, app).ok, false)
})

test('refus : nombres hors bornes', () => {
  assert.equal(validateEvent({ ...base, duration_s: -1 }, app).ok, false)
  assert.equal(validateEvent({ ...base, duration_s: 90000 }, app).ok, false)
  assert.equal(validateEvent({ ...base, attempts: 1.5 }, app).ok, false)
})

test('refus : detail_url hors domaine de l’app ou invalide', () => {
  assert.equal(validateEvent({ ...base, detail_url: 'https://evil.example.com/x' }, app).ok, false)
  assert.equal(validateEvent({ ...base, detail_url: 'pas une url' }, app).ok, false)
})

test('refus : occurred_at invalide', () => {
  assert.equal(validateEvent({ ...base, occurred_at: 'hier' }, app).ok, false)
})
```

- [ ] **Step 2: Vérifier l'échec**

Run : `npm test`
Expected : FAIL, `Cannot find module '../shared/eventSchema.js'`.

- [ ] **Step 3: Implémenter `shared/eventSchema.js`**

```js
export const STATUSES = ['started', 'completed']
const MAX_INDICATORS = 10
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Schéma strict : aucun texte libre produit par l'élève ne doit entrer dans le hub.
// `app` = { base_url, indicator_labels } (ligne hub_apps).
export function validateEvent(body, app) {
  const err = (error) => ({ ok: false, error })
  if (!body || typeof body !== 'object') return err('Corps invalide.')
  const { event_id, status, occurred_at, duration_s, attempts, indicators = [], detail_url } = body

  if (typeof event_id !== 'string' || !UUID.test(event_id)) return err('event_id invalide.')
  if (!STATUSES.includes(status)) return err('status invalide.')

  let occurredAt = null
  if (occurred_at != null) {
    const d = new Date(occurred_at)
    if (Number.isNaN(d.getTime())) return err('occurred_at invalide.')
    occurredAt = d.toISOString()
  }

  for (const [name, value, max] of [['duration_s', duration_s, 86400], ['attempts', attempts, 1000]]) {
    if (value != null && (!Number.isInteger(value) || value < 0 || value > max)) return err(`${name} invalide.`)
  }

  if (!Array.isArray(indicators) || indicators.length > MAX_INDICATORS) return err('indicators invalide.')
  const allowed = app.indicator_labels ?? []
  const clean = []
  for (const ind of indicators) {
    if (!ind || typeof ind.label !== 'string' || ind.label.length > 40 || !allowed.includes(ind.label)) {
      return err('Libellé d’indicateur non déclaré.')
    }
    const v = ind.value
    const ok = (typeof v === 'number' && Number.isFinite(v)) || (typeof v === 'string' && v.length <= 20)
    if (!ok) return err('Valeur d’indicateur invalide.')
    clean.push({ label: ind.label, value: v })
  }

  let detailUrl = null
  if (detail_url != null) {
    try {
      const u = new URL(detail_url)
      if (u.origin !== new URL(app.base_url).origin) return err('detail_url hors domaine de l’app.')
      detailUrl = u.toString()
    } catch {
      return err('detail_url invalide.')
    }
  }

  return {
    ok: true,
    value: {
      event_id, status, occurred_at: occurredAt,
      duration_s: duration_s ?? null, attempts: attempts ?? null,
      indicators: clean, detail_url: detailUrl,
    },
  }
}
```

- [ ] **Step 4: Relancer les tests**

Run : `npm test`
Expected : PASS, 0 fail.

- [ ] **Step 5: Commit**

```bash
git add shared/eventSchema.js tests/eventSchema.test.mjs
git commit -m "feat: schéma strict des événements (anti données personnelles)" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 5: Validation d'une assignation

**Files:**
- Create: `shared/assignmentSchema.js`
- Test: `tests/assignmentSchema.test.mjs`

- [ ] **Step 1: Écrire le test qui échoue**

`tests/assignmentSchema.test.mjs` :
```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { validateAssignmentInput, isUuid } from '../shared/assignmentSchema.js'

const app = { base_url: 'https://dictee.example.org' }
const CLASS_ID = '22222222-2222-4222-8222-222222222222'
const STUDENT = '33333333-3333-4333-8333-333333333333'
const base = { class_id: CLASS_ID, title: '  Dictée n°3  ', deep_link: 'https://dictee.example.org/dictee/3?lang=fr' }

test('isUuid', () => {
  assert.ok(isUuid(CLASS_ID))
  assert.ok(!isUuid('x'))
})

test('assignation minimale valide : classe entière, titre nettoyé', () => {
  const r = validateAssignmentInput(base, app)
  assert.equal(r.ok, true)
  assert.equal(r.value.title, 'Dictée n°3')
  assert.equal(r.value.student_ids, null)
  assert.equal(r.value.due_at, null)
})

test('élèves choisis, échéance, domaine, type', () => {
  const r = validateAssignmentInput({
    ...base, student_ids: [STUDENT], due_at: '2026-10-01T12:00:00Z', domain_id: CLASS_ID, task_type: 'dictée',
  }, app)
  assert.equal(r.ok, true)
  assert.deepEqual(r.value.student_ids, [STUDENT])
  assert.equal(r.value.due_at, '2026-10-01T12:00:00.000Z')
})

test('student_ids "all" = classe entière', () => {
  assert.equal(validateAssignmentInput({ ...base, student_ids: 'all' }, app).value.student_ids, null)
})

test('refus : lien hors domaine de l’app (open redirect)', () => {
  assert.equal(validateAssignmentInput({ ...base, deep_link: 'https://evil.example.com/x' }, app).ok, false)
})

test('refus : titre vide ou trop long, classe invalide, élèves invalides, échéance invalide', () => {
  assert.equal(validateAssignmentInput({ ...base, title: '   ' }, app).ok, false)
  assert.equal(validateAssignmentInput({ ...base, title: 'x'.repeat(121) }, app).ok, false)
  assert.equal(validateAssignmentInput({ ...base, class_id: 'nope' }, app).ok, false)
  assert.equal(validateAssignmentInput({ ...base, student_ids: [] }, app).ok, false)
  assert.equal(validateAssignmentInput({ ...base, student_ids: ['x'] }, app).ok, false)
  assert.equal(validateAssignmentInput({ ...base, due_at: 'demain' }, app).ok, false)
  assert.equal(validateAssignmentInput({ ...base, task_type: 'x'.repeat(41) }, app).ok, false)
})
```

- [ ] **Step 2: Vérifier l'échec**

Run : `npm test`
Expected : FAIL, `Cannot find module '../shared/assignmentSchema.js'`.

- [ ] **Step 3: Implémenter `shared/assignmentSchema.js`**

```js
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const isUuid = (v) => typeof v === 'string' && UUID.test(v)

// `app` = { base_url }. Le lien profond doit rester sur le domaine de l'app choisie
// (empêche le hub de servir de redirection ouverte).
export function validateAssignmentInput(body, app) {
  const err = (error) => ({ ok: false, error })
  if (!body || typeof body !== 'object') return err('Corps invalide.')

  const title = String(body.title ?? '').trim()
  if (title.length < 1 || title.length > 120) return err('Titre : 1 à 120 caractères.')
  if (!isUuid(body.class_id)) return err('Classe invalide.')

  let link
  try {
    link = new URL(body.deep_link)
  } catch {
    return err('Lien de la tâche invalide.')
  }
  if (link.origin !== new URL(app.base_url).origin) return err('Le lien ne correspond pas au domaine de l’app choisie.')

  const taskType = body.task_type ? String(body.task_type).trim() : null
  if (taskType && taskType.length > 40) return err('Type de tâche trop long.')

  if (body.domain_id != null && !isUuid(body.domain_id)) return err('Domaine invalide.')

  let due = null
  if (body.due_at != null) {
    const d = new Date(body.due_at)
    if (Number.isNaN(d.getTime())) return err('Échéance invalide.')
    due = d.toISOString()
  }

  let studentIds = null
  if (body.student_ids != null && body.student_ids !== 'all') {
    const ids = body.student_ids
    if (!Array.isArray(ids) || ids.length === 0 || ids.length > 200 || !ids.every(isUuid)) return err('Élèves invalides.')
    studentIds = ids
  }

  return {
    ok: true,
    value: {
      class_id: body.class_id, title, deep_link: link.toString(), task_type: taskType,
      domain_id: body.domain_id ?? null, due_at: due, student_ids: studentIds,
    },
  }
}
```

- [ ] **Step 4: Relancer les tests**

Run : `npm test`
Expected : PASS, 0 fail.

- [ ] **Step 5: Commit**

```bash
git add shared/assignmentSchema.js tests/assignmentSchema.test.mjs
git commit -m "feat: validation des assignations (domaine du lien, bornes)" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 6: Dates (remise à zéro annuelle, validité des liens) et hachage

**Files:**
- Create: `shared/dates.js`, `shared/hash.js`
- Test: `tests/dates.test.mjs`

- [ ] **Step 1: Écrire le test qui échoue**

`tests/dates.test.mjs` :
```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { needsReset, linkExpiry, LINK_GRACE_DAYS } from '../shared/dates.js'
import { sha256Hex } from '../shared/hash.js'

const d = (s) => new Date(s)

test('needsReset : avant le 15 juillet, jamais', () => {
  assert.equal(needsReset(d('2027-06-01T00:00:00Z'), { createdAt: '2026-09-01T00:00:00Z', lastResetAt: null }), false)
  assert.equal(needsReset(d('2027-07-14T23:59:00Z'), { createdAt: '2026-09-01T00:00:00Z', lastResetAt: null }), false)
})

test('needsReset : dès le 15 juillet pour une classe de l’année écoulée', () => {
  assert.equal(needsReset(d('2027-07-15T00:00:00Z'), { createdAt: '2026-09-01T00:00:00Z', lastResetAt: null }), true)
  assert.equal(needsReset(d('2027-07-20T00:00:00Z'), { createdAt: '2026-09-01T00:00:00Z', lastResetAt: '2026-10-01T00:00:00Z' }), true)
})

test('needsReset : plus rien à faire une fois remise à zéro cette année', () => {
  assert.equal(needsReset(d('2027-07-20T00:00:00Z'), { createdAt: '2026-09-01T00:00:00Z', lastResetAt: '2027-07-16T00:00:00Z' }), false)
})

test('needsReset : une classe créée après le 15 juillet n’est pas concernée cette année', () => {
  assert.equal(needsReset(d('2026-09-20T00:00:00Z'), { createdAt: '2026-09-05T00:00:00Z', lastResetAt: null }), false)
})

test('linkExpiry : échéance + 30 jours, ou null', () => {
  assert.equal(LINK_GRACE_DAYS, 30)
  assert.equal(linkExpiry('2026-10-01T12:00:00Z'), '2026-10-31T12:00:00.000Z')
  assert.equal(linkExpiry(null), null)
})

test('sha256Hex', () => {
  assert.equal(sha256Hex('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
})
```

- [ ] **Step 2: Vérifier l'échec**

Run : `npm test`
Expected : FAIL, `Cannot find module '../shared/dates.js'`.

- [ ] **Step 3: Implémenter `shared/dates.js` et `shared/hash.js`**

`shared/dates.js` :
```js
// Doit rester cohérent avec la purge SQL (hub_purge_stale) : seuil = 15 juillet UTC de l'année courante.
const julyStart = (year) => Date.UTC(year, 6, 15)

// Bandeau « remise à zéro » : visible dès le 15 juillet pour les classes antérieures à cette date
// qui n'ont pas été remises à zéro depuis.
export function needsReset(now, { createdAt, lastResetAt }) {
  const start = julyStart(now.getUTCFullYear())
  if (now.getTime() < start) return false
  const created = new Date(createdAt).getTime()
  const last = lastResetAt ? new Date(lastResetAt).getTime() : -Infinity
  return created < start && last < start
}

// Doit rester cohérent avec les intervalles '30 days' du SQL (hub_create_assignment, hub_regenerate_link).
export const LINK_GRACE_DAYS = 30

export function linkExpiry(dueAt) {
  if (!dueAt) return null
  const d = new Date(dueAt)
  d.setUTCDate(d.getUTCDate() + LINK_GRACE_DAYS)
  return d.toISOString()
}
```
`shared/hash.js` (serveur et scripts uniquement, jamais importé par le frontend) :
```js
import { createHash } from 'node:crypto'

export const sha256Hex = (text) => createHash('sha256').update(text).digest('hex')
```

- [ ] **Step 4: Relancer les tests**

Run : `npm test`
Expected : PASS, 0 fail.

- [ ] **Step 5: Commit et push (build vérifié)**

```bash
npx vite build
git add shared/dates.js shared/hash.js tests/dates.test.mjs
git commit -m "feat: règles de dates (remise à zéro, validité des liens) et hachage" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
git push
```
Expected : build OK, push sur `main`.

---

### Task 7: Schéma Supabase (tables, RLS, fonctions)

**Files:**
- Create: `supabase/migrations/20260920000000_hub_init.sql`

Le projet Supabase est **partagé** (`dfoaumjleqtxjeaplnna`) : toutes les tables sont préfixées `hub_`.

- [ ] **Step 1: Vérifier l'absence de conflit de noms**

Dans l'éditeur SQL du tableau de bord Supabase (projet `dfoaumjleqtxjeaplnna`), exécuter :
```sql
select table_name from information_schema.tables
where table_schema = 'public' and table_name like 'hub\_%';
select proname from pg_proc where proname like 'hub\_%';
```
Expected : 0 ligne dans les deux résultats. Sinon, s'arrêter et renommer.

- [ ] **Step 2: Écrire la migration**

`supabase/migrations/20260920000000_hub_init.sql` :
```sql
-- HubActif : schéma initial. Projet Supabase partagé : toutes les tables et fonctions sont préfixées hub_.

-- ============ Tables ============
create table hub_classes (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  class_code text not null unique check (class_code ~ '^[A-Z0-9]{4,12}$'),
  last_reset_at timestamptz,
  created_at timestamptz not null default now()
);
create index on hub_classes (teacher_id);

create table hub_students (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references hub_classes(id) on delete cascade,
  code text not null unique check (code ~ '^[A-Z0-9_-]{3,32}$'),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index on hub_students (class_id);

create table hub_apps (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]{2,40}$'),
  name text not null,
  base_url text not null check (base_url ~ '^https://' or base_url ~ '^http://localhost'),
  key_hash text not null unique,
  indicator_labels text[] not null default '{}',
  revoked boolean not null default false,
  created_at timestamptz not null default now()
);

create table hub_domains (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid references auth.users(id) on delete cascade, -- null = liste commune
  label text not null check (char_length(label) between 1 and 60),
  created_at timestamptz not null default now()
);
create unique index hub_domains_common_label on hub_domains (label) where teacher_id is null;
create unique index hub_domains_teacher_label on hub_domains (teacher_id, label) where teacher_id is not null;

create table hub_assignments (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references auth.users(id) on delete cascade,
  class_id uuid not null references hub_classes(id) on delete cascade,
  app_id uuid not null references hub_apps(id),
  title text not null check (char_length(title) between 1 and 120),
  deep_link text not null,
  task_type text check (char_length(task_type) <= 40),
  domain_id uuid references hub_domains(id) on delete set null,
  due_at timestamptz,
  created_at timestamptz not null default now()
);
create index on hub_assignments (class_id);
create index on hub_assignments (teacher_id);

create table hub_targets (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references hub_assignments(id) on delete cascade,
  student_id uuid not null references hub_students(id) on delete cascade,
  status text not null default 'assigned' check (status in ('assigned', 'started', 'completed')),
  updated_at timestamptz not null default now(),
  unique (assignment_id, student_id)
);
create index on hub_targets (student_id);

create table hub_links (
  id text primary key check (id ~ '^[a-f0-9]{16}$'),
  target_id uuid not null references hub_targets(id) on delete cascade,
  revoked boolean not null default false,
  expires_at timestamptz, -- échéance + 30 jours, null si pas d'échéance
  first_opened_at timestamptz,
  created_at timestamptz not null default now()
);
create index on hub_links (target_id);

create table hub_events (
  event_id uuid primary key,
  target_id uuid not null references hub_targets(id) on delete cascade,
  status text not null check (status in ('started', 'completed')),
  occurred_at timestamptz not null default now(),
  duration_s int,
  attempts int,
  indicators jsonb not null default '[]',
  detail_url text,
  created_at timestamptz not null default now()
);
create index on hub_events (target_id, occurred_at);

create table hub_notes (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references auth.users(id) on delete cascade,
  student_id uuid not null references hub_students(id) on delete cascade,
  body text not null check (char_length(body) <= 2000),
  updated_at timestamptz not null default now(),
  unique (teacher_id, student_id)
);

create table hub_rate_limits (
  key text primary key,
  count int not null,
  window_start timestamptz not null
);

-- ============ Domaines de départ ============
insert into hub_domains (teacher_id, label) values
  (null, 'Orthographe'), (null, 'Vocabulaire'), (null, 'Lecture'),
  (null, 'Grammaire'), (null, 'Mémorisation et révision');

-- ============ RLS ============
alter table hub_classes enable row level security;
alter table hub_students enable row level security;
alter table hub_apps enable row level security;
alter table hub_domains enable row level security;
alter table hub_assignments enable row level security;
alter table hub_targets enable row level security;
alter table hub_links enable row level security;
alter table hub_events enable row level security;
alter table hub_notes enable row level security;
alter table hub_rate_limits enable row level security;

create policy "classes : propriétaire" on hub_classes for all
  using (teacher_id = auth.uid()) with check (teacher_id = auth.uid());

create policy "élèves : propriétaire de la classe" on hub_students for all
  using (exists (select 1 from hub_classes c where c.id = class_id and c.teacher_id = auth.uid()))
  with check (exists (select 1 from hub_classes c where c.id = class_id and c.teacher_id = auth.uid()));

create policy "assignations : lecture propriétaire" on hub_assignments for select
  using (teacher_id = auth.uid());

create policy "cibles : lecture propriétaire" on hub_targets for select
  using (exists (select 1 from hub_assignments a where a.id = assignment_id and a.teacher_id = auth.uid()));

create policy "liens : lecture propriétaire" on hub_links for select
  using (exists (select 1 from hub_targets t join hub_assignments a on a.id = t.assignment_id
                 where t.id = target_id and a.teacher_id = auth.uid()));

create policy "événements : lecture propriétaire" on hub_events for select
  using (exists (select 1 from hub_targets t join hub_assignments a on a.id = t.assignment_id
                 where t.id = target_id and a.teacher_id = auth.uid()));

create policy "notes : propriétaire" on hub_notes for all
  using (teacher_id = auth.uid())
  with check (teacher_id = auth.uid() and exists (
    select 1 from hub_students s join hub_classes c on c.id = s.class_id
    where s.id = student_id and c.teacher_id = auth.uid()));

create policy "domaines : lecture" on hub_domains for select
  using (teacher_id is null or teacher_id = auth.uid());
create policy "domaines : ajout perso" on hub_domains for insert
  with check (teacher_id = auth.uid());
create policy "domaines : suppression perso" on hub_domains for delete
  using (teacher_id = auth.uid());

-- hub_apps et hub_rate_limits : RLS active, aucune policy => aucun accès client.
revoke all on hub_apps, hub_rate_limits from anon, authenticated;
revoke all on hub_classes, hub_students, hub_domains, hub_assignments, hub_targets, hub_links, hub_events, hub_notes from anon;
revoke insert, update, delete on hub_assignments, hub_targets, hub_links, hub_events from authenticated;

-- Vue publique des apps (sans key_hash ni libellés) : le client affiche les noms d'apps.
create view hub_apps_public as select id, slug, name, base_url from hub_apps where not revoked;
grant select on hub_apps_public to authenticated;

-- ============ Fonctions ============
create or replace function hub_is_service() returns boolean
language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', '') = 'service_role'
$$;

-- Limitation de débit : true = autorisé.
create or replace function hub_rate_check(p_key text, p_max int, p_window_seconds int)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_count int;
begin
  insert into hub_rate_limits as r (key, count, window_start) values (p_key, 1, now())
  on conflict (key) do update set
    count = case when r.window_start < now() - make_interval(secs => p_window_seconds) then 1 else r.count + 1 end,
    window_start = case when r.window_start < now() - make_interval(secs => p_window_seconds) then now() else r.window_start end
  returning r.count into v_count;
  return v_count <= p_max;
end $$;

-- Création atomique d'une assignation : cibles + liens courts.
create or replace function hub_create_assignment(
  p_teacher uuid, p_app uuid, p_class uuid, p_title text, p_deep_link text,
  p_task_type text, p_domain uuid, p_due timestamptz, p_student_ids uuid[]
) returns table (out_assignment_id uuid, out_student_code text, out_link_id text)
language plpgsql security definer set search_path = public as $$
declare v_assignment uuid; v_n int;
begin
  if not exists (select 1 from hub_classes where id = p_class and teacher_id = p_teacher) then
    raise exception 'class_not_owned';
  end if;
  if p_domain is not null and not exists (
    select 1 from hub_domains where id = p_domain and (teacher_id is null or teacher_id = p_teacher)) then
    raise exception 'domain_not_allowed';
  end if;

  insert into hub_assignments (teacher_id, class_id, app_id, title, deep_link, task_type, domain_id, due_at)
  values (p_teacher, p_class, p_app, p_title, p_deep_link, p_task_type, p_domain, p_due)
  returning id into v_assignment;

  insert into hub_targets (assignment_id, student_id)
  select v_assignment, s.id from hub_students s
  where s.class_id = p_class and s.active and (p_student_ids is null or s.id = any(p_student_ids));
  get diagnostics v_n = row_count;
  if v_n = 0 then raise exception 'no_students'; end if;

  insert into hub_links (id, target_id, expires_at)
  select substr(replace(gen_random_uuid()::text, '-', ''), 1, 16), t.id,
         case when p_due is null then null else p_due + interval '30 days' end
  from hub_targets t where t.assignment_id = v_assignment;

  return query
    select v_assignment, s.code, l.id
    from hub_targets t
    join hub_students s on s.id = t.student_id
    join hub_links l on l.target_id = t.id
    where t.assignment_id = v_assignment
    order by s.code;
end $$;

-- Ouverture d'un lien court : vérifie, marque « commencé », renvoie de quoi fabriquer le jeton.
create or replace function hub_open_link(p_link text)
returns table (out_target uuid, out_assignment uuid, out_code text, out_app_slug text, out_deep_link text)
language plpgsql security definer set search_path = public as $$
declare v_target uuid;
begin
  select l.target_id into v_target
  from hub_links l
  join hub_targets t on t.id = l.target_id
  join hub_students s on s.id = t.student_id
  join hub_assignments a on a.id = t.assignment_id
  join hub_apps ap on ap.id = a.app_id
  where l.id = p_link and not l.revoked and (l.expires_at is null or l.expires_at > now())
    and s.active and not ap.revoked;
  if v_target is null then return; end if;

  update hub_links set first_opened_at = coalesce(first_opened_at, now()) where id = p_link;
  update hub_targets set status = 'started', updated_at = now() where id = v_target and status = 'assigned';

  return query
    select t.id, a.id, s.code, ap.slug, a.deep_link
    from hub_targets t
    join hub_assignments a on a.id = t.assignment_id
    join hub_students s on s.id = t.student_id
    join hub_apps ap on ap.id = a.app_id
    where t.id = v_target;
end $$;

-- Enregistrement idempotent d'un événement. Retourne 'recorded' | 'duplicate' | 'unknown_target'.
create or replace function hub_record_event(
  p_target uuid, p_assignment uuid, p_app_slug text, p_event_id uuid, p_status text,
  p_occurred timestamptz, p_duration int, p_attempts int, p_indicators jsonb, p_detail_url text
) returns text language plpgsql security definer set search_path = public as $$
declare v_n int;
begin
  if not exists (
    select 1 from hub_targets t
    join hub_assignments a on a.id = t.assignment_id
    join hub_apps ap on ap.id = a.app_id
    where t.id = p_target and a.id = p_assignment and ap.slug = p_app_slug) then
    return 'unknown_target';
  end if;

  insert into hub_events (event_id, target_id, status, occurred_at, duration_s, attempts, indicators, detail_url)
  values (p_event_id, p_target, p_status, least(coalesce(p_occurred, now()), now()),
          p_duration, p_attempts, coalesce(p_indicators, '[]'::jsonb), p_detail_url)
  on conflict (event_id) do nothing;
  get diagnostics v_n = row_count;
  if v_n = 0 then return 'duplicate'; end if;

  update hub_targets set
    status = case when p_status = 'completed' then 'completed'
                  when status = 'assigned' then 'started'
                  else status end,
    updated_at = now()
  where id = p_target;
  return 'recorded';
end $$;

-- Espace élève : null si les codes ne correspondent pas, sinon la liste (éventuellement vide) des tâches.
create or replace function hub_student_tasks(p_class_code text, p_student_code text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_student uuid; v_tasks jsonb;
begin
  select s.id into v_student
  from hub_classes c join hub_students s on s.class_id = c.id
  where c.class_code = p_class_code and s.code = p_student_code and s.active;
  if v_student is null then return null; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
      'title', q.title, 'app', q.app_name, 'due_at', q.due_at,
      'status', q.status, 'link_id', q.link_id, 'domain', q.domain
    ) order by q.due_at nulls last, q.created_at desc), '[]'::jsonb)
  into v_tasks
  from (
    select a.title, ap.name as app_name, a.due_at, a.created_at, t.status, l.id as link_id, d.label as domain
    from hub_targets t
    join hub_assignments a on a.id = t.assignment_id
    join hub_apps ap on ap.id = a.app_id
    join lateral (
      select id from hub_links
      where target_id = t.id and not revoked and (expires_at is null or expires_at > now())
      order by created_at desc limit 1
    ) l on true
    left join hub_domains d on d.id = a.domain_id
    where t.student_id = v_student
  ) q;
  return v_tasks;
end $$;

-- Régénération d'un lien (propriétaire) : révoque les anciens, en crée un nouveau.
create or replace function hub_regenerate_link(p_target uuid)
returns text language plpgsql security definer set search_path = public as $$
declare v_due timestamptz; v_id text;
begin
  select a.due_at into v_due
  from hub_targets t join hub_assignments a on a.id = t.assignment_id
  where t.id = p_target and a.teacher_id = auth.uid();
  if not found then raise exception 'not_owned'; end if;

  update hub_links set revoked = true where target_id = p_target;
  v_id := substr(replace(gen_random_uuid()::text, '-', ''), 1, 16);
  insert into hub_links (id, target_id, expires_at)
  values (v_id, p_target, case when v_due is null then null else v_due + interval '30 days' end);
  return v_id;
end $$;

-- Remise à zéro d'une classe (propriétaire ou service) : élèves, assignations (cibles, liens,
-- événements) et notes disparaissent ; la classe et son code restent.
create or replace function hub_reset_class(p_class uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not hub_is_service() and not exists (
    select 1 from hub_classes where id = p_class and teacher_id = auth.uid()) then
    raise exception 'not_owned';
  end if;
  delete from hub_assignments where class_id = p_class;
  delete from hub_students where class_id = p_class;
  update hub_classes set last_reset_at = now() where id = p_class;
end $$;

-- Purge annuelle (service uniquement) : classes antérieures au 15 juillet non remises à zéro depuis.
create or replace function hub_purge_stale()
returns int language plpgsql security definer set search_path = public as $$
declare
  v_cutoff timestamptz := make_timestamptz(extract(year from now())::int, 7, 15, 0, 0, 0, 'UTC');
  r record; n int := 0;
begin
  if not hub_is_service() then raise exception 'service_only'; end if;
  for r in select id from hub_classes
           where created_at < v_cutoff and coalesce(last_reset_at, '-infinity') < v_cutoff loop
    perform hub_reset_class(r.id);
    n := n + 1;
  end loop;
  delete from hub_rate_limits where window_start < now() - interval '1 day';
  return n;
end $$;

-- ============ Droits d'exécution ============
revoke execute on function
  hub_rate_check(text, int, int),
  hub_create_assignment(uuid, uuid, uuid, text, text, text, uuid, timestamptz, uuid[]),
  hub_open_link(text),
  hub_record_event(uuid, uuid, text, uuid, text, timestamptz, int, int, jsonb, text),
  hub_student_tasks(text, text),
  hub_purge_stale()
from public, anon, authenticated;
grant execute on function
  hub_rate_check(text, int, int),
  hub_create_assignment(uuid, uuid, uuid, text, text, text, uuid, timestamptz, uuid[]),
  hub_open_link(text),
  hub_record_event(uuid, uuid, text, uuid, text, timestamptz, int, int, jsonb, text),
  hub_student_tasks(text, text),
  hub_purge_stale()
to service_role;

revoke execute on function hub_reset_class(uuid), hub_regenerate_link(uuid) from public, anon;
grant execute on function hub_reset_class(uuid), hub_regenerate_link(uuid) to authenticated, service_role;
```

- [ ] **Step 3: Appliquer la migration**

Coller le fichier entier dans l'éditeur SQL Supabase (projet `dfoaumjleqtxjeaplnna`) et exécuter.
Expected : `Success. No rows returned`. Vérifier ensuite :
```sql
select count(*) from hub_domains;            -- 5
select tablename, rowsecurity from pg_tables where tablename like 'hub\_%';  -- rowsecurity = true partout
```

- [ ] **Step 4: Renseigner `.env.local`** (fichier non commité)

Ajouter les variables du projet Supabase (Settings > API) : `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_URL` (même valeur), `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, et un `CRON_SECRET` aléatoire (`node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"`), en plus des clés de signature de la Task 3. Ne jamais afficher ni commiter ces valeurs.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260920000000_hub_init.sql
git commit -m "feat: schéma Supabase hub_* (tables, RLS, fonctions atomiques)" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 8: Tests d'intégration base de données (RLS, idempotence, remise à zéro)

**Files:**
- Create: `tests/db.integration.mjs`

Ce script s'exécute contre le projet Supabase réel (`npm run test:db`), crée des comptes jetables `@hubactif.test` et les supprime à la fin. Il n'est pas découvert par `npm test`.

- [ ] **Step 1: Écrire le script**

`tests/db.integration.mjs` :
```js
import assert from 'node:assert/strict'
import { createClient } from '@supabase/supabase-js'
import { generateCode } from '../shared/codes.js'

const { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY } = process.env
assert.ok(SUPABASE_URL && SUPABASE_ANON_KEY && SUPABASE_SERVICE_ROLE_KEY, 'Variables Supabase manquantes (.env.local)')

const opts = { auth: { persistSession: false } }
const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, opts)
const stamp = Date.now()
const users = []
const results = []
const check = (name, ok, detail = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  ${detail}`}`) }

async function makeTeacher(label) {
  const email = `${label}-${stamp}@hubactif.test`
  const password = `Pw-${stamp}-${label}!`
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true })
  assert.ifError(error)
  users.push(data.user.id)
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, opts)
  const { error: e2 } = await client.auth.signInWithPassword({ email, password })
  assert.ifError(e2)
  return { id: data.user.id, client }
}

let appId
try {
  const A = await makeTeacher('a')
  const B = await makeTeacher('b')
  const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, opts)

  // --- RLS classes ---
  const { data: cls, error: e1 } = await A.client.from('hub_classes')
    .insert({ teacher_id: A.id, name: 'Classe test A', class_code: generateCode(6) }).select().single()
  assert.ifError(e1)
  const { data: seenByB } = await B.client.from('hub_classes').select('*')
  check('B ne lit pas les classes de A', (seenByB ?? []).length === 0)
  await B.client.from('hub_classes').update({ name: 'piraté' }).eq('id', cls.id)
  await B.client.from('hub_classes').delete().eq('id', cls.id)
  const { data: still } = await admin.from('hub_classes').select('name').eq('id', cls.id).single()
  check('B ne modifie ni ne supprime la classe de A', still?.name === 'Classe test A')
  const { error: eForge } = await B.client.from('hub_classes')
    .insert({ teacher_id: A.id, name: 'usurpation', class_code: generateCode(6) })
  check('B ne crée pas de classe au nom de A', !!eForge)
  const { data: anonRows, error: eAnon } = await anon.from('hub_classes').select('*')
  check('anonyme ne lit aucune classe', !!eAnon || (anonRows ?? []).length === 0)

  // --- RLS élèves ---
  const studentCode = generateCode(8)
  const { data: st, error: e2 } = await A.client.from('hub_students').insert({ class_id: cls.id, code: studentCode }).select().single()
  assert.ifError(e2)
  const { error: eStB } = await B.client.from('hub_students').insert({ class_id: cls.id, code: generateCode(8) })
  check('B n’ajoute pas d’élève dans la classe de A', !!eStB)
  const { error: eDup } = await A.client.from('hub_students').insert({ class_id: cls.id, code: studentCode })
  check('code élève unique globalement', eDup?.code === '23505')

  // --- Fonctions réservées au service ---
  const { error: eRecAnon } = await anon.rpc('hub_rate_check', { p_key: 'x', p_max: 1, p_window_seconds: 60 })
  check('anonyme ne peut pas appeler hub_rate_check', !!eRecAnon)
  const { error: ePurgeB } = await B.client.rpc('hub_purge_stale')
  check('enseignant ne peut pas appeler hub_purge_stale', !!ePurgeB)
  const { error: eResetB } = await B.client.rpc('hub_reset_class', { p_class: cls.id })
  check('B ne remet pas à zéro la classe de A', !!eResetB)

  // --- Assignation, lien, événements ---
  const key = `k-${stamp}`
  const { data: app, error: eApp } = await admin.from('hub_apps').insert({
    slug: `test-${stamp}`, name: 'App test', base_url: 'https://test.example.org', key_hash: `hash-${stamp}`, indicator_labels: ['essais'],
  }).select().single()
  assert.ifError(eApp)
  appId = app.id

  const { data: rows, error: eCreate } = await admin.rpc('hub_create_assignment', {
    p_teacher: A.id, p_app: app.id, p_class: cls.id, p_title: 'Tâche test', p_deep_link: 'https://test.example.org/t/1',
    p_task_type: null, p_domain: null, p_due: null, p_student_ids: null,
  })
  assert.ifError(eCreate)
  check('assignation : 1 ligne par élève avec lien court', rows.length === 1 && /^[a-f0-9]{16}$/.test(rows[0].out_link_id))

  const { error: eNoStudents } = await admin.rpc('hub_create_assignment', {
    p_teacher: A.id, p_app: app.id, p_class: cls.id, p_title: 'x', p_deep_link: 'https://test.example.org/t/1',
    p_task_type: null, p_domain: null, p_due: null, p_student_ids: ['00000000-0000-4000-8000-000000000000'],
  })
  check('assignation sans élève ciblé refusée', !!eNoStudents && /no_students/.test(eNoStudents.message))

  const { data: seenAssignB } = await B.client.from('hub_assignments').select('*')
  check('B ne lit pas les assignations de A', (seenAssignB ?? []).length === 0)
  const { data: seenAssignA } = await A.client.from('hub_assignments').select('*')
  check('A lit ses assignations', seenAssignA.length === 1)
  const { error: eWriteAssign } = await A.client.from('hub_assignments').insert({
    teacher_id: A.id, class_id: cls.id, app_id: app.id, title: 'direct', deep_link: 'https://test.example.org/x',
  })
  check('écriture directe dans hub_assignments refusée', !!eWriteAssign)

  const linkId = rows[0].out_link_id
  const { data: opened } = await admin.rpc('hub_open_link', { p_link: linkId })
  check('ouverture du lien : renvoie code et app', opened?.length === 1 && opened[0].out_code === studentCode && opened[0].out_app_slug === app.slug)
  const targetId = opened[0].out_target
  const { data: t1 } = await admin.from('hub_targets').select('status').eq('id', targetId).single()
  check('ouverture du lien : statut « commencé »', t1.status === 'started')

  const evt = {
    p_target: targetId, p_assignment: opened[0].out_assignment, p_app_slug: app.slug,
    p_event_id: '44444444-4444-4444-8444-444444444444', p_status: 'completed', p_occurred: null,
    p_duration: 60, p_attempts: 1, p_indicators: [{ label: 'essais', value: 1 }], p_detail_url: null,
  }
  const r1 = await admin.rpc('hub_record_event', evt)
  const r2 = await admin.rpc('hub_record_event', evt)
  check('événement : enregistré puis doublon', r1.data === 'recorded' && r2.data === 'duplicate')
  const { count } = await admin.from('hub_events').select('*', { count: 'exact', head: true }).eq('target_id', targetId)
  check('événement : une seule ligne après renvoi', count === 1)
  const { data: t2 } = await admin.from('hub_targets').select('status').eq('id', targetId).single()
  check('événement terminé : statut « terminé »', t2.status === 'completed')
  const r3 = await admin.rpc('hub_record_event', { ...evt, p_event_id: '55555555-5555-4555-8555-555555555555', p_app_slug: 'autre-app' })
  check('événement d’une autre app refusé', r3.data === 'unknown_target')

  const { data: tasks } = await admin.rpc('hub_student_tasks', { p_class_code: cls.class_code, p_student_code: studentCode })
  check('espace élève : tâche et statut', tasks?.length === 1 && tasks[0].status === 'completed')
  const { data: none } = await admin.rpc('hub_student_tasks', { p_class_code: cls.class_code, p_student_code: 'INCONNU1' })
  check('espace élève : code inconnu => null', none === null)

  // --- Limitation de débit ---
  const rk = `rate-${stamp}`
  const rl = []
  for (let i = 0; i < 4; i++) rl.push((await admin.rpc('hub_rate_check', { p_key: rk, p_max: 3, p_window_seconds: 60 })).data)
  check('limitation : 3 autorisés puis refus', rl.join() === 'true,true,true,false')

  // --- Régénération et remise à zéro ---
  const { data: newLink, error: eRegen } = await A.client.rpc('hub_regenerate_link', { p_target: targetId })
  assert.ifError(eRegen)
  const { data: reopenOld } = await admin.rpc('hub_open_link', { p_link: linkId })
  check('ancien lien révoqué après régénération', (reopenOld ?? []).length === 0)
  const { data: reopenNew } = await admin.rpc('hub_open_link', { p_link: newLink })
  check('nouveau lien valide', reopenNew?.length === 1)
  const { error: eRegenB } = await B.client.rpc('hub_regenerate_link', { p_target: targetId })
  check('B ne régénère pas le lien de A', !!eRegenB)

  const { error: eReset } = await A.client.rpc('hub_reset_class', { p_class: cls.id })
  assert.ifError(eReset)
  const { count: nStudents } = await admin.from('hub_students').select('*', { count: 'exact', head: true }).eq('class_id', cls.id)
  const { count: nAssign } = await admin.from('hub_assignments').select('*', { count: 'exact', head: true }).eq('class_id', cls.id)
  const { data: clsAfter } = await admin.from('hub_classes').select('last_reset_at').eq('id', cls.id).single()
  check('remise à zéro : élèves et assignations supprimés, classe conservée', nStudents === 0 && nAssign === 0 && !!clsAfter.last_reset_at)

  const { data: purged, error: ePurge } = await admin.rpc('hub_purge_stale')
  check('purge (service) s’exécute', !ePurge && Number.isInteger(purged))
} finally {
  // Comptes d'abord (la cascade supprime les assignations), puis l'app de test (hub_assignments.app_id la référence).
  for (const id of users) await admin.auth.admin.deleteUser(id)
  if (appId) await admin.from('hub_apps').delete().eq('id', appId)
}

const failed = results.filter((r) => !r).length
console.log(`\n${results.length - failed}/${results.length} vérifications réussies`)
process.exit(failed ? 1 : 0)
```
Si le script échoue avant le `finally`, nettoyer à la main depuis l'éditeur SQL : `delete from hub_apps where slug like 'test-%';`.

- [ ] **Step 2: Lancer le script**

Run : `npm run test:db`
Expected : toutes les lignes `PASS`, `N/N vérifications réussies`, code de sortie 0. Si une ligne `FAIL` apparaît, corriger la migration (nouvelle migration corrective, ne pas éditer silencieusement la précédente), la ré-appliquer, relancer.

- [ ] **Step 3: Commit**

```bash
git add tests/db.integration.mjs
git commit -m "test: intégration base (RLS, idempotence, remise à zéro, débit)" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 9: Aides serveur et outils de test des handlers

**Files:**
- Create: `api/_lib/admin.js`, `api/_lib/rate.js`, `api/_lib/requireUser.js`, `tests/helpers.mjs`

- [ ] **Step 1: Écrire `api/_lib/admin.js`**

```js
import { createClient } from '@supabase/supabase-js'

let client

// Client service role : serveur uniquement, jamais exposé au frontend.
export function admin() {
  if (!client) {
    const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) throw new Error('Supabase admin non configuré.')
    client = createClient(url, key, { auth: { persistSession: false } })
  }
  return client
}
```

- [ ] **Step 2: Écrire `api/_lib/rate.js`**

```js
import { admin } from './admin.js'

export function clientIp(req) {
  const fwd = String(req.headers?.['x-forwarded-for'] ?? '').split(',')[0].trim()
  return fwd || req.socket?.remoteAddress || 'unknown'
}

// true = autorisé. Échec de la RPC => exception (on ne laisse pas passer sans contrôle).
export async function rateCheck(key, max, windowSeconds) {
  const { data, error } = await admin().rpc('hub_rate_check', {
    p_key: key, p_max: max, p_window_seconds: windowSeconds,
  })
  if (error) throw error
  return data === true
}
```

- [ ] **Step 3: Écrire `api/_lib/requireUser.js`** (même schéma que `diffactif/api/_auth.js`)

```js
import { createClient } from '@supabase/supabase-js'

// Valide le jeton Supabase de l'enseignant (Authorization: Bearer). Retourne l'utilisateur,
// ou null après avoir répondu 401.
export async function requireUser(req, res) {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null
  if (!token) {
    res.status(401).json({ error: 'Connexion requise.' })
    return null
  }
  const supabase = createClient(
    process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY,
    { auth: { persistSession: false } }
  )
  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data?.user) {
    res.status(401).json({ error: 'Session invalide ou expirée. Reconnectez-vous.' })
    return null
  }
  return data.user
}
```

- [ ] **Step 4: Écrire `tests/helpers.mjs`**

```js
// Faux req/res compatibles avec le sous-ensemble utilisé des helpers Vercel.
export function fakeReq({ method = 'POST', headers = {}, body, query = {} } = {}) {
  return { method, headers, body, query, socket: { remoteAddress: '1.2.3.4' } }
}

export function fakeRes() {
  const res = {
    statusCode: 200, headers: {}, body: undefined,
    status(code) { res.statusCode = code; return res },
    json(payload) { res.body = payload; return res },
    send(payload) { res.body = payload; return res },
    setHeader(name, value) { res.headers[name.toLowerCase()] = value; return res },
    redirect(code, url) { res.statusCode = code; res.headers.location = url; return res },
  }
  return res
}
```

- [ ] **Step 5: Vérifier que rien n'est cassé**

Run : `npm test`
Expected : PASS (les tests précédents), 0 fail. (Ces fichiers sont couverts par les tests de handlers des tâches suivantes.)

- [ ] **Step 6: Commit**

```bash
git add api/_lib/admin.js api/_lib/rate.js api/_lib/requireUser.js tests/helpers.mjs
git commit -m "feat: aides serveur (client admin, débit, auth enseignant)" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 10: `POST /api/events`

**Files:**
- Create: `api/_lib/eventsHandler.js`, `api/events.js`
- Test: `tests/eventsHandler.test.mjs`

- [ ] **Step 1: Écrire le test qui échoue**

`tests/eventsHandler.test.mjs` :
```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { createEventsHandler } from '../api/_lib/eventsHandler.js'
import { generateKeyPair, signToken } from '../shared/token.js'
import { fakeReq, fakeRes } from './helpers.mjs'

const NOW = 1_800_000_000_000
const EID = '11111111-1111-4111-8111-111111111111'
const app = { slug: 'dictee', base_url: 'https://dictee.example.org', indicator_labels: ['mots réussis'], revoked: false }

async function setup(over = {}) {
  const keys = await generateKeyPair()
  const calls = []
  const handler = createEventsHandler({
    findAppByKeyHash: async (h) => (h === 'hash:good' ? (over.app ?? app) : null),
    recordEvent: async (e) => { calls.push(e); return over.result ?? 'recorded' },
    rateCheck: async () => over.allowed ?? true,
    publicKey: keys.publicKey,
    hash: (k) => `hash:${k}`,
    now: () => NOW,
  })
  const token = (payload = {}, key = keys.privateKey) =>
    signToken({ tid: 't1', aid: 'a1', code: 'ABCD2345', app: 'dictee', exp: NOW / 1000 + 3600, ...payload }, key)
  const call = async ({ key = 'good', method = 'POST', body }) => {
    const res = fakeRes()
    await handler(fakeReq({ method, headers: key ? { 'x-app-key': key } : {}, body }), res)
    return res
  }
  return { call, calls, token }
}

const okBody = (token, extra = {}) => ({ event_id: EID, token, status: 'completed', duration_s: 120, indicators: [{ label: 'mots réussis', value: 14 }], ...extra })

test('405 si ce n’est pas un POST', async () => {
  const { call } = await setup()
  assert.equal((await call({ method: 'GET' })).statusCode, 405)
})

test('429 si limite de débit dépassée', async () => {
  const { call, token } = await setup({ allowed: false })
  assert.equal((await call({ body: okBody(await token()) })).statusCode, 429)
})

test('401 sans clé d’app', async () => {
  const { call, token } = await setup()
  assert.equal((await call({ key: null, body: okBody(await token()) })).statusCode, 401)
})

test('401 clé inconnue', async () => {
  const { call, token } = await setup()
  assert.equal((await call({ key: 'mauvaise', body: okBody(await token()) })).statusCode, 401)
})

test('401 app révoquée', async () => {
  const { call, token } = await setup({ app: { ...app, revoked: true } })
  assert.equal((await call({ body: okBody(await token()) })).statusCode, 401)
})

test('401 jeton absent, signé par une autre clé, ou expiré', async () => {
  const { call, token } = await setup()
  const other = await generateKeyPair()
  assert.equal((await call({ body: okBody(undefined) })).statusCode, 401)
  assert.equal((await call({ body: okBody(await token({}, other.privateKey)) })).statusCode, 401)
  assert.equal((await call({ body: okBody(await token({ exp: NOW / 1000 - 10 })) })).statusCode, 401)
})

test('403 jeton émis pour une autre app', async () => {
  const { call, token } = await setup()
  assert.equal((await call({ body: okBody(await token({ app: 'lexiactif' })) })).statusCode, 403)
})

test('400 événement hors schéma (libellé non déclaré)', async () => {
  const { call, token, calls } = await setup()
  const res = await call({ body: okBody(await token(), { indicators: [{ label: 'phrase dictée', value: 'Maëlle a écrit' }] }) })
  assert.equal(res.statusCode, 400)
  assert.equal(calls.length, 0)
})

test('200 enregistré : transmet cible, assignation, app et valeurs nettoyées', async () => {
  const { call, token, calls } = await setup()
  const res = await call({ body: okBody(await token()) })
  assert.equal(res.statusCode, 200)
  assert.deepEqual(res.body, { status: 'recorded' })
  assert.equal(calls[0].target, 't1')
  assert.equal(calls[0].assignment, 'a1')
  assert.equal(calls[0].appSlug, 'dictee')
  assert.equal(calls[0].event_id, EID)
})

test('200 doublon renvoyé tel quel (idempotence)', async () => {
  const { call, token } = await setup({ result: 'duplicate' })
  const res = await call({ body: okBody(await token()) })
  assert.equal(res.statusCode, 200)
  assert.deepEqual(res.body, { status: 'duplicate' })
})

test('404 cible inconnue', async () => {
  const { call, token } = await setup({ result: 'unknown_target' })
  assert.equal((await call({ body: okBody(await token()) })).statusCode, 404)
})
```

- [ ] **Step 2: Vérifier l'échec**

Run : `npm test`
Expected : FAIL, `Cannot find module '../api/_lib/eventsHandler.js'`.

- [ ] **Step 3: Implémenter `api/_lib/eventsHandler.js`**

```js
import { verifyToken, TokenError } from '../../shared/token.js'
import { validateEvent } from '../../shared/eventSchema.js'

// Dépendances injectées (voir api/events.js pour le câblage réel) pour tester sans réseau ni base.
export function createEventsHandler({ findAppByKeyHash, recordEvent, rateCheck, publicKey, hash, now = () => Date.now() }) {
  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store')
    if (req.method !== 'POST') return res.status(405).json({ error: 'Méthode non autorisée.' })

    const appKey = req.headers['x-app-key']
    if (!appKey) return res.status(401).json({ error: 'Clé d’app requise.' })
    const app = await findAppByKeyHash(hash(String(appKey)))
    if (!app || app.revoked) return res.status(401).json({ error: 'Clé d’app invalide.' })

    // Débit par app (et non par IP) : les événements arrivent des relais serveur des apps, dont l'IP est partagée par toute une classe.
    if (!(await rateCheck(`events:${app.slug}`, 1200, 60))) return res.status(429).json({ error: 'Trop de requêtes.' })

    const body = typeof req.body === 'string' ? safeParse(req.body) : req.body
    let payload
    try {
      payload = await verifyToken(body?.token, publicKey, Math.floor(now() / 1000))
    } catch (e) {
      if (e instanceof TokenError) return res.status(401).json({ error: 'Jeton invalide ou expiré.' })
      throw e
    }
    if (payload.app !== app.slug) return res.status(403).json({ error: 'Jeton émis pour une autre app.' })

    const parsed = validateEvent(body, app)
    if (!parsed.ok) {
      // Journalisé sans donnée personnelle : app et motif seulement.
      console.warn('[events] rejeté', { app: app.slug, reason: parsed.error })
      return res.status(400).json({ error: parsed.error })
    }

    const status = await recordEvent({ target: payload.tid, assignment: payload.aid, appSlug: app.slug, ...parsed.value })
    if (status === 'unknown_target') return res.status(404).json({ error: 'Assignation introuvable.' })
    return res.status(200).json({ status })
  }
}

function safeParse(text) {
  try { return JSON.parse(text) } catch { return null }
}
```

- [ ] **Step 4: Relancer les tests**

Run : `npm test`
Expected : PASS, 0 fail.

- [ ] **Step 5: Câbler `api/events.js`**

```js
import { createEventsHandler } from './_lib/eventsHandler.js'
import { admin } from './_lib/admin.js'
import { rateCheck } from './_lib/rate.js'
import { sha256Hex } from '../shared/hash.js'

export default createEventsHandler({
  findAppByKeyHash: async (keyHash) => {
    const { data, error } = await admin().from('hub_apps')
      .select('slug, base_url, indicator_labels, revoked').eq('key_hash', keyHash).maybeSingle()
    if (error) throw error
    return data
  },
  recordEvent: async (e) => {
    const { data, error } = await admin().rpc('hub_record_event', {
      p_target: e.target, p_assignment: e.assignment, p_app_slug: e.appSlug,
      p_event_id: e.event_id, p_status: e.status, p_occurred: e.occurred_at,
      p_duration: e.duration_s, p_attempts: e.attempts,
      p_indicators: e.indicators, p_detail_url: e.detail_url,
    })
    if (error) throw error
    return data
  },
  rateCheck,
  publicKey: process.env.HUB_SIGNING_PUBLIC_KEY,
  hash: sha256Hex,
})
```

- [ ] **Step 6: Commit**

```bash
git add api/_lib/eventsHandler.js api/events.js tests/eventsHandler.test.mjs
git commit -m "feat: POST /api/events (clé d'app, jeton, schéma strict, idempotence)" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 11: Lien court `/a/:id` (redirection avec jeton)

**Files:**
- Create: `api/_lib/goHandler.js`, `api/go.js`
- Test: `tests/goHandler.test.mjs`

- [ ] **Step 1: Écrire le test qui échoue**

`tests/goHandler.test.mjs` :
```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { createGoHandler } from '../api/_lib/goHandler.js'
import { generateKeyPair, verifyToken, TOKEN_TTL_SECONDS } from '../shared/token.js'
import { fakeReq, fakeRes } from './helpers.mjs'

const NOW = 1_800_000_000_000
const ID = 'a1b2c3d4e5f60718'
const row = { out_target: 't1', out_assignment: 'a1', out_code: 'ABCD2345', out_app_slug: 'dictee', out_deep_link: 'https://dictee.example.org/dictee/3?lang=fr' }

async function setup({ found = row, allowed = true } = {}) {
  const keys = await generateKeyPair()
  const opened = []
  const handler = createGoHandler({
    openLink: async (id) => { opened.push(id); return found },
    rateCheck: async () => allowed,
    privateKey: keys.privateKey,
    now: () => NOW,
  })
  const call = async (id) => { const res = fakeRes(); await handler(fakeReq({ method: 'GET', query: { id } }), res); return res }
  return { call, opened, keys }
}

test('lien valide : 302 vers l’app avec un jeton de 120 h, requête d’origine conservée', async () => {
  const { call, keys } = await setup()
  const res = await call(ID)
  assert.equal(res.statusCode, 302)
  const url = new URL(res.headers.location)
  assert.equal(url.origin, 'https://dictee.example.org')
  assert.equal(url.searchParams.get('lang'), 'fr')
  const payload = await verifyToken(url.searchParams.get('t'), keys.publicKey, NOW / 1000)
  assert.deepEqual(payload, { tid: 't1', aid: 'a1', code: 'ABCD2345', app: 'dictee', exp: NOW / 1000 + TOKEN_TTL_SECONDS })
  assert.equal(res.headers['cache-control'], 'no-store')
})

test('lien inconnu, révoqué ou expiré : 410 avec message lisible', async () => {
  const { call } = await setup({ found: null })
  const res = await call(ID)
  assert.equal(res.statusCode, 410)
  assert.match(res.body, /Ce lien ne marche plus/)
})

test('identifiant mal formé : 410 sans interroger la base', async () => {
  const { call, opened } = await setup()
  assert.equal((await call('../../etc')).statusCode, 410)
  assert.equal(opened.length, 0)
})

test('429 si limite de débit dépassée', async () => {
  const { call } = await setup({ allowed: false })
  assert.equal((await call(ID)).statusCode, 429)
})
```

- [ ] **Step 2: Vérifier l'échec**

Run : `npm test`
Expected : FAIL, `Cannot find module '../api/_lib/goHandler.js'`.

- [ ] **Step 3: Implémenter `api/_lib/goHandler.js`**

```js
import { signToken, TOKEN_TTL_SECONDS } from '../../shared/token.js'

const page = (title, text) => `<!doctype html><html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head>
<body style="font-family:Arial,Helvetica,sans-serif;font-size:20px;line-height:1.6;max-width:32rem;margin:3rem auto;padding:0 1rem">
<h1 style="font-size:26px">${title}</h1><p>${text}</p></body></html>`

const INVALID = page('Ce lien ne marche plus', 'Demande un nouveau lien ou un nouveau QR code à ton enseignant.')
const BUSY = page('Un instant', 'Trop de demandes en même temps. Réessaie dans une minute.')

function html(res, status, body) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  return res.status(status).send(body)
}

export function createGoHandler({ openLink, rateCheck, privateKey, now = () => Date.now() }) {
  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store')
    const ip = String(req.headers['x-forwarded-for'] ?? '').split(',')[0].trim() || req.socket?.remoteAddress || 'unknown'
    // Limite large : toute une classe peut scanner en même temps derrière la même adresse IP d'école.
    if (!(await rateCheck(`go:${ip}`, 300, 60))) return html(res, 429, BUSY)

    const id = String(req.query?.id ?? '')
    if (!/^[a-f0-9]{16}$/.test(id)) return html(res, 410, INVALID)

    const row = await openLink(id)
    if (!row) return html(res, 410, INVALID)

    const token = await signToken({
      tid: row.out_target, aid: row.out_assignment, code: row.out_code, app: row.out_app_slug,
      exp: Math.floor(now() / 1000) + TOKEN_TTL_SECONDS,
    }, privateKey)
    const url = new URL(row.out_deep_link)
    url.searchParams.set('t', token)
    return res.redirect(302, url.toString())
  }
}
```

- [ ] **Step 4: Relancer les tests**

Run : `npm test`
Expected : PASS, 0 fail.

- [ ] **Step 5: Câbler `api/go.js`**

```js
import { createGoHandler } from './_lib/goHandler.js'
import { admin } from './_lib/admin.js'
import { rateCheck } from './_lib/rate.js'

export default createGoHandler({
  openLink: async (id) => {
    const { data, error } = await admin().rpc('hub_open_link', { p_link: id })
    if (error) throw error
    return data?.[0] ?? null
  },
  rateCheck,
  privateKey: process.env.HUB_SIGNING_PRIVATE_KEY,
})
```

- [ ] **Step 6: Commit**

```bash
git add api/_lib/goHandler.js api/go.js tests/goHandler.test.mjs
git commit -m "feat: lien court /a/:id (redirection avec jeton signé)" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 12: `POST /api/student` (espace élève)

**Files:**
- Create: `api/_lib/studentHandler.js`, `api/student.js`
- Test: `tests/studentHandler.test.mjs`

- [ ] **Step 1: Écrire le test qui échoue**

`tests/studentHandler.test.mjs` :
```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { createStudentHandler } from '../api/_lib/studentHandler.js'
import { fakeReq, fakeRes } from './helpers.mjs'

const tasks = [{ title: 'Dictée n°3', app: 'Dictée interactive', due_at: null, status: 'assigned', link_id: 'a1b2c3d4e5f60718', domain: 'Orthographe' }]

function setup({ result = tasks, allowed = true } = {}) {
  const asked = []
  const handler = createStudentHandler({
    studentTasks: async (c, s) => { asked.push([c, s]); return result },
    rateCheck: async () => allowed,
  })
  const call = async (body, method = 'POST') => { const res = fakeRes(); await handler(fakeReq({ method, body }), res); return res }
  return { call, asked }
}

test('405 si ce n’est pas un POST', async () => {
  assert.equal((await setup().call({}, 'GET')).statusCode, 405)
})

test('400 si un code manque', async () => {
  const res = await setup().call({ class_code: 'ABC234', student_code: '' })
  assert.equal(res.statusCode, 400)
})

test('les codes sont normalisés en majuscules avant la recherche', async () => {
  const { call, asked } = setup()
  const res = await call({ class_code: ' abc234 ', student_code: 'abcd2345' })
  assert.equal(res.statusCode, 200)
  assert.deepEqual(asked[0], ['ABC234', 'ABCD2345'])
  assert.deepEqual(res.body, { tasks })
})

test('404 neutre quand les codes ne correspondent pas (sans dire quel champ)', async () => {
  const res = await setup({ result: null }).call({ class_code: 'ABC234', student_code: 'ZZZZ9999' })
  assert.equal(res.statusCode, 404)
  assert.deepEqual(res.body, { error: 'Codes non reconnus.' })
})

test('404 sans interroger la base si les codes sont démesurés', async () => {
  const { call, asked } = setup()
  const res = await call({ class_code: 'A'.repeat(50), student_code: 'B'.repeat(50) })
  assert.equal(res.statusCode, 404)
  assert.equal(asked.length, 0)
})

test('429 si limite de débit dépassée', async () => {
  const res = await setup({ allowed: false }).call({ class_code: 'ABC234', student_code: 'ABCD2345' })
  assert.equal(res.statusCode, 429)
})
```

- [ ] **Step 2: Vérifier l'échec**

Run : `npm test`
Expected : FAIL, `Cannot find module '../api/_lib/studentHandler.js'`.

- [ ] **Step 3: Implémenter `api/_lib/studentHandler.js`**

```js
import { normalizeCode } from '../../shared/codes.js'

const NOT_FOUND = { error: 'Codes non reconnus.' }

export function createStudentHandler({ studentTasks, rateCheck }) {
  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store')
    if (req.method !== 'POST') return res.status(405).json({ error: 'Méthode non autorisée.' })

    const ip = String(req.headers['x-forwarded-for'] ?? '').split(',')[0].trim() || req.socket?.remoteAddress || 'unknown'
    // 300 essais / 5 min / IP : une classe entière derrière l'IP de l'école passe, une attaque par
    // dictionnaire sur 31^8 codes non.
    if (!(await rateCheck(`student:${ip}`, 300, 300))) {
      return res.status(429).json({ error: 'Trop d’essais. Réessaie dans quelques minutes.' })
    }

    const body = typeof req.body === 'string' ? safeParse(req.body) : req.body
    const classCode = normalizeCode(body?.class_code)
    const studentCode = normalizeCode(body?.student_code)
    if (!classCode || !studentCode) return res.status(400).json({ error: 'Renseigne les deux codes.' })
    if (classCode.length > 12 || studentCode.length > 32) return res.status(404).json(NOT_FOUND)

    const tasks = await studentTasks(classCode, studentCode)
    if (tasks === null) return res.status(404).json(NOT_FOUND)
    return res.status(200).json({ tasks })
  }
}

function safeParse(text) {
  try { return JSON.parse(text) } catch { return null }
}
```

- [ ] **Step 4: Relancer les tests**

Run : `npm test`
Expected : PASS, 0 fail.

- [ ] **Step 5: Câbler `api/student.js`**

```js
import { createStudentHandler } from './_lib/studentHandler.js'
import { admin } from './_lib/admin.js'
import { rateCheck } from './_lib/rate.js'

export default createStudentHandler({
  studentTasks: async (classCode, studentCode) => {
    const { data, error } = await admin().rpc('hub_student_tasks', { p_class_code: classCode, p_student_code: studentCode })
    if (error) throw error
    return data
  },
  rateCheck,
})
```

- [ ] **Step 6: Commit**

```bash
git add api/_lib/studentHandler.js api/student.js tests/studentHandler.test.mjs
git commit -m "feat: POST /api/student (espace élève par codes, réponse neutre)" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 13: `POST /api/assignments` (interne au hub)

**Files:**
- Create: `api/_lib/assignmentsHandler.js`, `api/assignments.js`
- Test: `tests/assignmentsHandler.test.mjs`

- [ ] **Step 1: Écrire le test qui échoue**

`tests/assignmentsHandler.test.mjs` :
```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { createAssignmentsHandler } from '../api/_lib/assignmentsHandler.js'
import { fakeReq, fakeRes } from './helpers.mjs'

const APP_ID = '11111111-1111-4111-8111-111111111111'
const CLASS_ID = '22222222-2222-4222-8222-222222222222'
const app = { id: APP_ID, base_url: 'https://dictee.example.org', revoked: false }
const good = { app_id: APP_ID, class_id: CLASS_ID, title: 'Dictée n°3', deep_link: 'https://dictee.example.org/dictee/3' }
const rows = [
  { out_assignment_id: 'as1', out_student_code: 'ABCD2345', out_link_id: 'a1b2c3d4e5f60718' },
  { out_assignment_id: 'as1', out_student_code: 'EFGH6789', out_link_id: '0123456789abcdef' },
]

function setup({ user = { id: 'u1' }, foundApp = app, create, allowed = true } = {}) {
  const created = []
  const handler = createAssignmentsHandler({
    requireUser: async (req, res) => { if (!user) { res.status(401).json({ error: 'Connexion requise.' }); return null } return user },
    findApp: async () => foundApp,
    createAssignment: create ?? (async (a) => { created.push(a); return rows }),
    rateCheck: async () => allowed,
  })
  const call = async (body, method = 'POST') => { const res = fakeRes(); await handler(fakeReq({ method, body }), res); return res }
  return { call, created }
}

test('405 si ce n’est pas un POST', async () => {
  assert.equal((await setup().call(good, 'GET')).statusCode, 405)
})

test('401 sans enseignant connecté', async () => {
  assert.equal((await setup({ user: null }).call(good)).statusCode, 401)
})

test('400 app inconnue ou révoquée', async () => {
  assert.equal((await setup({ foundApp: null }).call(good)).statusCode, 400)
  assert.equal((await setup({ foundApp: { ...app, revoked: true } }).call(good)).statusCode, 400)
  assert.equal((await setup().call({ ...good, app_id: 'pas-un-uuid' })).statusCode, 400)
})

test('400 lien hors domaine de l’app', async () => {
  const res = await setup().call({ ...good, deep_link: 'https://evil.example.com/x' })
  assert.equal(res.statusCode, 400)
})

test('200 : renvoie l’assignation et un lien par élève', async () => {
  const { call, created } = setup()
  const res = await call(good)
  assert.equal(res.statusCode, 200)
  assert.equal(res.body.assignment_id, 'as1')
  assert.deepEqual(res.body.links, [
    { student_code: 'ABCD2345', link_id: 'a1b2c3d4e5f60718' },
    { student_code: 'EFGH6789', link_id: '0123456789abcdef' },
  ])
  assert.equal(created[0].teacher, 'u1')
  assert.equal(created[0].class_id, CLASS_ID)
  assert.equal(created[0].student_ids, null)
})

test('403 classe qui n’appartient pas à l’enseignant, 400 sans élève', async () => {
  const mk = (msg) => async () => { throw { message: msg } }
  assert.equal((await setup({ create: mk('class_not_owned') }).call(good)).statusCode, 403)
  const res = await setup({ create: mk('no_students') }).call(good)
  assert.equal(res.statusCode, 400)
  assert.match(res.body.error, /Aucun élève/)
  assert.equal((await setup({ create: mk('domain_not_allowed') }).call(good)).statusCode, 400)
})

test('429 si limite de débit dépassée', async () => {
  assert.equal((await setup({ allowed: false }).call(good)).statusCode, 429)
})
```

- [ ] **Step 2: Vérifier l'échec**

Run : `npm test`
Expected : FAIL, `Cannot find module '../api/_lib/assignmentsHandler.js'`.

- [ ] **Step 3: Implémenter `api/_lib/assignmentsHandler.js`**

```js
import { validateAssignmentInput, isUuid } from '../../shared/assignmentSchema.js'

const KNOWN_ERRORS = {
  class_not_owned: [403, 'Classe introuvable.'],
  no_students: [400, 'Aucun élève actif dans la classe. Ajoutez d’abord des codes élèves.'],
  domain_not_allowed: [400, 'Domaine invalide.'],
}

export function createAssignmentsHandler({ requireUser, findApp, createAssignment, rateCheck }) {
  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store')
    if (req.method !== 'POST') return res.status(405).json({ error: 'Méthode non autorisée.' })

    const user = await requireUser(req, res)
    if (!user) return
    if (!(await rateCheck(`assign:${user.id}`, 60, 60))) return res.status(429).json({ error: 'Trop de requêtes.' })

    const body = typeof req.body === 'string' ? safeParse(req.body) : req.body
    if (!isUuid(body?.app_id)) return res.status(400).json({ error: 'App invalide.' })
    const app = await findApp(body.app_id)
    if (!app || app.revoked) return res.status(400).json({ error: 'App inconnue.' })

    const parsed = validateAssignmentInput(body, app)
    if (!parsed.ok) return res.status(400).json({ error: parsed.error })

    try {
      const rows = await createAssignment({ teacher: user.id, app: body.app_id, ...parsed.value })
      return res.status(200).json({
        assignment_id: rows[0].out_assignment_id,
        links: rows.map((r) => ({ student_code: r.out_student_code, link_id: r.out_link_id })),
      })
    } catch (e) {
      const known = Object.entries(KNOWN_ERRORS).find(([code]) => String(e?.message).includes(code))
      if (known) return res.status(known[1][0]).json({ error: known[1][1] })
      throw e
    }
  }
}

function safeParse(text) {
  try { return JSON.parse(text) } catch { return null }
}
```

- [ ] **Step 4: Relancer les tests**

Run : `npm test`
Expected : PASS, 0 fail.

- [ ] **Step 5: Câbler `api/assignments.js`**

```js
import { createAssignmentsHandler } from './_lib/assignmentsHandler.js'
import { admin } from './_lib/admin.js'
import { rateCheck } from './_lib/rate.js'
import { requireUser } from './_lib/requireUser.js'

export default createAssignmentsHandler({
  requireUser,
  findApp: async (id) => {
    const { data, error } = await admin().from('hub_apps').select('id, base_url, revoked').eq('id', id).maybeSingle()
    if (error) throw error
    return data
  },
  createAssignment: async (a) => {
    const { data, error } = await admin().rpc('hub_create_assignment', {
      p_teacher: a.teacher, p_app: a.app, p_class: a.class_id, p_title: a.title, p_deep_link: a.deep_link,
      p_task_type: a.task_type, p_domain: a.domain_id, p_due: a.due_at, p_student_ids: a.student_ids,
    })
    if (error) throw error
    return data
  },
  rateCheck,
})
```

- [ ] **Step 6: Commit**

```bash
git add api/_lib/assignmentsHandler.js api/assignments.js tests/assignmentsHandler.test.mjs
git commit -m "feat: POST /api/assignments (création atomique, liens courts)" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 14: Purge annuelle (cron du 15 août)

**Files:**
- Create: `api/_lib/purgeHandler.js`, `api/cron/purge.js`
- Modify: `vercel.json`
- Test: `tests/purgeHandler.test.mjs`

- [ ] **Step 1: Écrire le test qui échoue**

`tests/purgeHandler.test.mjs` :
```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { createPurgeHandler } from '../api/_lib/purgeHandler.js'
import { fakeReq, fakeRes } from './helpers.mjs'

function setup(secret = 's3cret') {
  let calls = 0
  const handler = createPurgeHandler({ secret, purge: async () => { calls++; return 4 } })
  const call = async (headers) => { const res = fakeRes(); await handler(fakeReq({ method: 'GET', headers }), res); return res }
  return { call, count: () => calls }
}

test('refuse sans en-tête ou avec un mauvais secret', async () => {
  const { call, count } = setup()
  assert.equal((await call({})).statusCode, 401)
  assert.equal((await call({ authorization: 'Bearer autre' })).statusCode, 401)
  assert.equal(count(), 0)
})

test('refuse tout si le secret n’est pas configuré', async () => {
  const { call, count } = setup('')
  assert.equal((await call({ authorization: 'Bearer ' })).statusCode, 401)
  assert.equal(count(), 0)
})

test('exécute la purge avec le bon secret', async () => {
  const { call, count } = setup()
  const res = await call({ authorization: 'Bearer s3cret' })
  assert.equal(res.statusCode, 200)
  assert.deepEqual(res.body, { purged: 4 })
  assert.equal(count(), 1)
})
```

- [ ] **Step 2: Vérifier l'échec**

Run : `npm test`
Expected : FAIL, `Cannot find module '../api/_lib/purgeHandler.js'`.

- [ ] **Step 3: Implémenter `api/_lib/purgeHandler.js`**

```js
export function createPurgeHandler({ purge, secret }) {
  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store')
    // Vercel Cron envoie « Authorization: Bearer <CRON_SECRET> ».
    if (!secret || req.headers.authorization !== `Bearer ${secret}`) {
      return res.status(401).json({ error: 'Non autorisé.' })
    }
    const purged = await purge()
    return res.status(200).json({ purged })
  }
}
```

- [ ] **Step 4: Relancer les tests**

Run : `npm test`
Expected : PASS, 0 fail.

- [ ] **Step 5: Câbler `api/cron/purge.js`**

```js
import { createPurgeHandler } from '../_lib/purgeHandler.js'
import { admin } from '../_lib/admin.js'

export default createPurgeHandler({
  secret: process.env.CRON_SECRET,
  purge: async () => {
    const { data, error } = await admin().rpc('hub_purge_stale')
    if (error) throw error
    return data
  },
})
```

- [ ] **Step 6: Ajouter le cron dans `vercel.json`**

`vercel.json` devient :
```json
{
  "crons": [{ "path": "/api/cron/purge", "schedule": "0 3 15 8 *" }],
  "rewrites": [
    { "source": "/a/:id", "destination": "/api/go?id=:id" },
    { "source": "/api/(.*)", "destination": "/api/$1" },
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```
Le cron s'exécute chaque 15 août à 03:00 UTC. Il purge les classes antérieures au 15 juillet et non remises à zéro depuis (`hub_purge_stale`).

- [ ] **Step 7: Commit**

```bash
git add api/_lib/purgeHandler.js api/cron/purge.js vercel.json tests/purgeHandler.test.mjs
git commit -m "feat: purge automatique annuelle le 15 août (cron Vercel)" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 15: Enregistrer une app (clé d'app, libellés déclarés)

**Files:**
- Create: `scripts/register-app.mjs`

- [ ] **Step 1: Écrire le script**

`scripts/register-app.mjs` :
```js
// Usage : node --env-file=.env.local scripts/register-app.mjs <slug> "<Nom>" <base_url> "<libellé1|libellé2|...>"
// Ex.   : node --env-file=.env.local scripts/register-app.mjs dictee "Dictée interactive" https://dictee.example.org "mots réussis|essais"
// La clé d'app est affichée UNE SEULE FOIS : la stocker dans les variables d'environnement de l'app (HUB_APP_KEY), jamais dans son frontend.
import { randomBytes } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { sha256Hex } from '../shared/hash.js'
import { b64uEncode } from '../shared/token.js'

const [slug, name, baseUrl, labels = ''] = process.argv.slice(2)
if (!slug || !name || !baseUrl) {
  console.error('Usage : register-app.mjs <slug> "<Nom>" <base_url> "<libellé1|libellé2>"')
  process.exit(1)
}

const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const key = `hubkey_${b64uEncode(randomBytes(32))}`
const indicatorLabels = labels.split('|').map((l) => l.trim()).filter(Boolean)

const { error } = await admin.from('hub_apps').insert({
  slug, name, base_url: baseUrl.replace(/\/$/, ''), key_hash: sha256Hex(key), indicator_labels: indicatorLabels,
})
if (error) {
  console.error('Échec :', error.message)
  process.exit(1)
}
console.log(`App « ${name} » enregistrée (slug ${slug}, ${indicatorLabels.length} libellé(s) d'indicateur).`)
console.log('Clé d’app (à copier maintenant, non récupérable) :')
console.log(`HUB_APP_KEY=${key}`)
```

- [ ] **Step 2: Vérifier le mode d'emploi**

Run : `node scripts/register-app.mjs`
Expected : `Usage : register-app.mjs <slug> ...`, code de sortie 1, aucune connexion à la base.

- [ ] **Step 3: Commit**

```bash
git add scripts/register-app.mjs
git commit -m "feat: script d'enregistrement d'une app (clé hachée, libellés déclarés)" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 16: SDK pour les apps (`sdk/`)

**Files:**
- Create: `sdk/hub-client.js`, `sdk/relay-event.js`
- Test: `tests/sdk.test.mjs`

Le SDK est un fichier ES module autonome (aucune dépendance) à copier dans chaque app. `relay-event.js` est un modèle de fonction serverless à copier dans `api/hub-event.js` de l'app.

- [ ] **Step 1: Écrire le test qui échoue**

`tests/sdk.test.mjs` :
```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { createHubClient } from '../sdk/hub-client.js'
import { b64uEncode } from '../shared/token.js'

const NOW = 1_800_000_000_000
const mkToken = (p) => `${b64uEncode(new TextEncoder().encode(JSON.stringify(p)))}.sig`
const payload = { tid: 't1', aid: 'a1', code: 'ABCD2345', app: 'dictee', exp: NOW / 1000 + 3600 }

const memStorage = () => {
  const m = new Map()
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }
}

function make({ token = mkToken(payload), fetchImpl = async () => ({ ok: true, status: 200 }), storage = memStorage() } = {}) {
  const replaced = []
  const client = createHubClient({
    storage,
    location: { href: `https://dictee.example.org/dictee/3?lang=fr${token ? `&t=${token}` : ''}#x` },
    history: { replaceState: (...a) => replaced.push(a) },
    fetchImpl, now: () => NOW, uuid: () => 'uuid-1', hubUrl: 'https://hub.example.org',
  })
  return { client, storage, replaced }
}

test('captureToken lit le jeton, le range et le retire de l’URL', () => {
  const { client, replaced } = make()
  const ctx = client.captureToken()
  assert.equal(ctx.code, 'ABCD2345')
  assert.equal(ctx.assignmentId, 'a1')
  assert.equal(replaced[0][2], '/dictee/3?lang=fr#x')
  assert.equal(client.getContext().code, 'ABCD2345') // persiste sans le paramètre
})

test('jeton expiré => pas de contexte', () => {
  const { client } = make({ token: mkToken({ ...payload, exp: NOW / 1000 - 1 }) })
  assert.equal(client.captureToken(), null)
})

test('sans jeton => pas de contexte', () => {
  const { client } = make({ token: '' })
  assert.equal(client.captureToken(), null)
})

test('reportEvent envoie au relais avec jeton, identifiant et champs connus seulement', async () => {
  const sent = []
  const { client } = make({ fetchImpl: async (url, init) => { sent.push([url, JSON.parse(init.body)]); return { ok: true, status: 200 } } })
  client.captureToken()
  const r = await client.reportEvent({ status: 'completed', duration_s: 90, indicators: [{ label: 'essais', value: 2 }], secret: 'ignoré' })
  assert.deepEqual(r, { sent: true })
  assert.equal(sent[0][0], '/api/hub-event')
  assert.equal(sent[0][1].event_id, 'uuid-1')
  assert.equal(sent[0][1].status, 'completed')
  assert.equal(sent[0][1].occurred_at, new Date(NOW).toISOString())
  assert.ok(sent[0][1].token)
  assert.equal(sent[0][1].secret, undefined)
})

test('reportEvent sans contexte : rien n’est envoyé', async () => {
  const { client } = make({ token: '' })
  assert.deepEqual(await client.reportEvent({ status: 'started' }), { sent: false, reason: 'no_context' })
})

test('réseau en panne : l’événement est mis en file, puis renvoyé', async () => {
  let online = false
  const { client, storage } = make({ fetchImpl: async () => { if (!online) throw new Error('offline'); return { ok: true, status: 200 } } })
  client.captureToken()
  assert.deepEqual(await client.reportEvent({ status: 'started' }), { sent: false, queued: true })
  assert.equal(JSON.parse(storage.getItem('hub_queue')).length, 1)
  online = true
  assert.equal(await client.flushQueue(), 0)
  assert.equal(JSON.parse(storage.getItem('hub_queue')).length, 0)
})

test('flushQueue : 5xx conservé, 4xx abandonné', async () => {
  const statuses = [500, 400]
  const { client, storage } = make({ fetchImpl: async () => ({ ok: false, status: statuses.shift() }) })
  storage.setItem('hub_queue', JSON.stringify([{ event_id: 'e1' }, { event_id: 'e2' }]))
  assert.equal(await client.flushQueue(), 1)
  assert.deepEqual(JSON.parse(storage.getItem('hub_queue')), [{ event_id: 'e1' }])
})

test('assignUrl construit l’adresse de la page « Assigner » du hub', () => {
  const { client } = make()
  const u = new URL(client.assignUrl({ app: 'dictee', title: 'Dictée n°3', link: 'https://dictee.example.org/dictee/3', type: 'dictée', domain: 'Orthographe' }))
  assert.equal(u.origin, 'https://hub.example.org')
  assert.equal(u.pathname, '/enseignant/assigner')
  assert.equal(u.searchParams.get('app'), 'dictee')
  assert.equal(u.searchParams.get('title'), 'Dictée n°3')
  assert.equal(u.searchParams.get('link'), 'https://dictee.example.org/dictee/3')
  assert.equal(u.searchParams.get('domain'), 'Orthographe')
})

test('clearContext efface le jeton (poste partagé)', () => {
  const { client } = make()
  client.captureToken()
  client.clearContext()
  assert.equal(client.getContext(), null)
})
```

- [ ] **Step 2: Vérifier l'échec**

Run : `npm test`
Expected : FAIL, `Cannot find module '../sdk/hub-client.js'`.

- [ ] **Step 3: Implémenter `sdk/hub-client.js`**

```js
// SDK HubActif : à copier tel quel dans une app. Aucune dépendance.
// Le jeton est décodé (code élève, expiration) mais sa signature n'est PAS vérifiée ici :
// le hub la vérifie à chaque événement reçu.
const TOKEN_KEY = 'hub_token'
const QUEUE_KEY = 'hub_queue'
const EVENT_FIELDS = ['status', 'duration_s', 'attempts', 'indicators', 'detail_url']

function decodeToken(token) {
  try {
    const body = token.split('.')[0].replace(/-/g, '+').replace(/_/g, '/')
    return JSON.parse(atob(body))
  } catch {
    return null
  }
}

export function createHubClient({
  storage, location, history, fetchImpl,
  relayUrl = '/api/hub-event',
  hubUrl = 'https://hubactif-plai.vercel.app',
  now = () => Date.now(),
  uuid = () => crypto.randomUUID(),
}) {
  const safe = (fn, fallback = null) => { try { return fn() } catch { return fallback } }

  // À appeler au chargement de l'app : range le jeton reçu (?t=) et le retire de l'adresse.
  function captureToken() {
    const url = new URL(location.href)
    const t = url.searchParams.get('t')
    if (t) {
      safe(() => storage.setItem(TOKEN_KEY, t))
      url.searchParams.delete('t')
      safe(() => history.replaceState(null, '', url.pathname + url.search + url.hash))
    }
    return getContext()
  }

  // { code, assignmentId, targetId, token, expiresAt } ou null (absent ou expiré).
  function getContext() {
    const token = safe(() => storage.getItem(TOKEN_KEY))
    const p = token ? decodeToken(token) : null
    if (!p || typeof p.exp !== 'number' || p.exp * 1000 <= now()) return null
    return { token, code: p.code, assignmentId: p.aid, targetId: p.tid, expiresAt: p.exp * 1000 }
  }

  function clearContext() {
    safe(() => storage.removeItem(TOKEN_KEY))
  }

  // Adresse de la page « Assigner » du hub, pour le bouton « Assigner via le hub » de l'app.
  function assignUrl({ app, title, link, type, domain, classId }) {
    const u = new URL('/enseignant/assigner', hubUrl)
    const params = { app, title, link, type, domain, class: classId }
    for (const [k, v] of Object.entries(params)) if (v) u.searchParams.set(k, v)
    return u.toString()
  }

  async function attempt(entry) {
    try {
      const res = await fetchImpl(relayUrl, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(entry),
      })
      if (res.ok) return 'done'
      return res.status >= 500 || res.status === 429 ? 'retry' : 'drop' // 4xx : inutile de réessayer
    } catch {
      return 'retry'
    }
  }

  const readQueue = () => safe(() => JSON.parse(storage.getItem(QUEUE_KEY) || '[]'), [])
  const writeQueue = (q) => safe(() => storage.setItem(QUEUE_KEY, JSON.stringify(q.slice(-50))))

  // event : { status: 'started'|'completed', duration_s?, attempts?, indicators?: [{label, value}], detail_url? }
  async function reportEvent(event) {
    const ctx = getContext()
    if (!ctx) return { sent: false, reason: 'no_context' }
    const entry = { event_id: uuid(), token: ctx.token, occurred_at: new Date(now()).toISOString() }
    for (const f of EVENT_FIELDS) if (event[f] !== undefined) entry[f] = event[f]
    const outcome = await attempt(entry)
    if (outcome === 'retry') {
      writeQueue([...readQueue(), entry])
      return { sent: false, queued: true }
    }
    return { sent: outcome === 'done' }
  }

  // À appeler au chargement et quand le réseau revient. Retourne le nombre d'événements restants.
  async function flushQueue() {
    const rest = []
    for (const entry of readQueue()) {
      if ((await attempt(entry)) === 'retry') rest.push(entry)
    }
    writeQueue(rest)
    return rest.length
  }

  return { captureToken, getContext, clearContext, assignUrl, reportEvent, flushQueue }
}

// Raccourci pour un navigateur.
export function browserHubClient(options = {}) {
  return createHubClient({
    storage: window.localStorage, location: window.location, history: window.history,
    fetchImpl: (...args) => window.fetch(...args), ...options,
  })
}
```

- [ ] **Step 4: Relancer les tests**

Run : `npm test`
Expected : PASS, 0 fail.

- [ ] **Step 5: Écrire le modèle de relais `sdk/relay-event.js`**

```js
// À copier dans api/hub-event.js de l'app (fonction serverless Vercel).
// Variables d'environnement de l'app (Vercel) : HUB_APP_KEY (secrète, jamais dans le frontend),
// HUB_URL (facultative, défaut ci-dessous).
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Méthode non autorisée.' })
  if (!process.env.HUB_APP_KEY) return res.status(503).json({ error: 'Hub non configuré.' })

  const hub = process.env.HUB_URL || 'https://hubactif-plai.vercel.app'
  const upstream = await fetch(`${hub}/api/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-app-key': process.env.HUB_APP_KEY },
    body: JSON.stringify(req.body),
  })
  const body = await upstream.json().catch(() => ({}))
  return res.status(upstream.status).json(body)
}
```

- [ ] **Step 6: Commit et push (build vérifié)**

```bash
npx vite build
git add sdk tests/sdk.test.mjs
git commit -m "feat: SDK pour les apps (jeton, file d'attente d'événements, relais)" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
git push
```
Expected : build OK, push sur `main`.

---

### Task 17: Projet Vercel et environnement de développement local

**Files:**
- Create: `.claude/launch.json`

Cette tâche crée un projet Vercel et le branche au dépôt GitHub : **action externe, à confirmer avec Jean-François avant de l'exécuter.** Elle est nécessaire pour tester les fonctions `/api/*` en local (`vercel dev`, jamais `vite` seul).

- [ ] **Step 1: Lier ou créer le projet Vercel**

Run (dans `hubactif/`) :
```bash
vercel link --yes --project hubactif-plai
vercel projects ls
```
Expected : un seul projet `hubactif-plai` dans la liste. (L'intégration GitHub crée parfois un second projet doublon : s'il en apparaît un autre pour ce dépôt, le supprimer avec `vercel remove <nom> --yes`.)

- [ ] **Step 2: Brancher le dépôt GitHub**

Run : `vercel git connect https://github.com/jfb4plai/hubactif-plai`
Expected : `Connected ... hubactif-plai`. Le dépôt est déjà sur la branche `main`, qui est la branche de production.

- [ ] **Step 3: Déclarer les variables d'environnement (production et développement)**

Les valeurs viennent de `.env.local` (jamais affichées). `printf` et non `echo` (un saut de ligne final casserait les clés).
```bash
for name in SUPABASE_URL SUPABASE_ANON_KEY SUPABASE_SERVICE_ROLE_KEY HUB_SIGNING_PRIVATE_KEY HUB_SIGNING_PUBLIC_KEY CRON_SECRET VITE_SUPABASE_URL VITE_SUPABASE_ANON_KEY; do
  value=$(grep "^$name=" .env.local | cut -d= -f2-)
  [ -z "$value" ] && { echo "MANQUANT: $name"; continue; }
  for env in production development; do printf '%s' "$value" | vercel env add "$name" "$env" --force >/dev/null; done
  echo "ok: $name"
done
```
Expected : `ok:` pour les 8 variables, aucun `MANQUANT`.

- [ ] **Step 4: Vérifier que les valeurs sont bien lues**

Run : `vercel env pull .env.vercel.check --environment=development --yes && grep -c "=" .env.vercel.check && rm .env.vercel.check`
Expected : un nombre ≥ 8 (les variables sont présentes), puis le fichier temporaire est supprimé.

- [ ] **Step 5: Écrire `.claude/launch.json`** (pour lancer l'app depuis l'aperçu)

```json
{
  "version": "0.0.1",
  "configurations": [
    {
      "name": "hubactif-vercel-dev",
      "runtimeExecutable": "npx",
      "runtimeArgs": ["vercel", "dev", "--listen", "3000"],
      "port": 3000
    }
  ]
}
```

- [ ] **Step 6: Vérifier que `vercel dev` démarre et sert une fonction**

Run (en arrière-plan) : `npx vercel dev --listen 3000`, puis :
```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/student
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/a/0000000000000000
```
Expected : `405` (méthode non autorisée : la fonction répond) puis `410` (lien inconnu : la réécriture `/a/:id` et la base fonctionnent). Arrêter le serveur ensuite.

- [ ] **Step 7: Commit**

```bash
git add .claude/launch.json
git commit -m "chore: config d'aperçu local (vercel dev)" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 18: Fondations du frontend (auth, mise en page, connexion)

**Files:**
- Create: `src/lib/supabase.js`, `src/lib/db.js`, `src/lib/api.js`, `src/context/AuthContext.jsx`, `src/components/Layout.jsx`, `src/components/ProtectedRoute.jsx`, `src/components/Field.jsx`, `src/components/QrImage.jsx`, `src/components/NoScoreBanner.jsx`, `src/pages/LoginPage.jsx`
- Modify: `src/App.jsx`

- [ ] **Step 1: Écrire les libs**

`src/lib/supabase.js` :
```js
import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anon) console.warn('Variables Supabase manquantes : vérifiez .env.local')

export const supabase = createClient(url || 'https://placeholder.supabase.co', anon || 'placeholder')
```
`src/lib/db.js` :
```js
// Déballe une réponse Supabase : retourne data ou lève l'erreur.
export function must({ data, error }) {
  if (error) throw error
  return data
}
```
`src/lib/api.js` :
```js
import { supabase } from './supabase.js'

// POST JSON vers une fonction du hub ; ajoute le jeton de l'enseignant s'il est connecté.
export async function apiPost(path, body) {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw Object.assign(new Error(json.error || `Erreur ${res.status}`), { status: res.status })
  return json
}
```

- [ ] **Step 2: Écrire `AuthContext` et `ProtectedRoute`**

`src/context/AuthContext.jsx` :
```jsx
import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'

const Ctx = createContext({ session: null, user: null, loading: true })

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setLoading(false) })
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  return <Ctx.Provider value={{ session, user: session?.user ?? null, loading }}>{children}</Ctx.Provider>
}

export const useAuth = () => useContext(Ctx)
```
`src/components/ProtectedRoute.jsx` :
```jsx
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'

// Redirige vers la connexion en gardant l'adresse demandée (utile pour /enseignant/assigner?...).
export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return <p className="plai-empty">Chargement…</p>
  if (!user) return <Navigate to="/enseignant/connexion" state={{ from: location }} replace />
  return children
}
```

- [ ] **Step 3: Écrire les composants communs**

`src/components/Field.jsx` :
```jsx
// Guidage contextuel obligatoire : label, champ (children), texte d'aide sous le champ.
export default function Field({ id, label, help, children }) {
  return (
    <div className="plai-field">
      <label className="plai-label" htmlFor={id}>{label}</label>
      {children}
      {help && <p className="hub-help" id={`${id}-help`}>{help}</p>}
    </div>
  )
}
```
`src/components/QrImage.jsx` :
```jsx
import { useEffect, useState } from 'react'
import QRCode from 'qrcode'

export default function QrImage({ text, size = 180, alt = 'QR code' }) {
  const [src, setSrc] = useState('')
  useEffect(() => {
    let live = true
    QRCode.toDataURL(text, { margin: 1, width: size }).then((url) => { if (live) setSrc(url) })
    return () => { live = false }
  }, [text, size])
  return src ? <img src={src} width={size} height={size} alt={alt} /> : null
}
```
`src/components/NoScoreBanner.jsx` :
```jsx
export default function NoScoreBanner() {
  return (
    <div className="plai-banner" role="note">
      Vue limitée aux tâches assignées via HubActif. Aucun score global : les indicateurs se lisent, ils ne
      s’additionnent pas. Ce que l’élève a compris reste à observer en classe.
    </div>
  )
}
```
`src/components/Layout.jsx` :
```jsx
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { supabase } from '../lib/supabase.js'

export default function Layout({ children }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const signOut = async () => { await supabase.auth.signOut(); navigate('/') }

  return (
    <>
      <nav className="plai-nav hub-noprint">
        <Link to="/" className="plai-nav-logo">
          <img src="/plai-logo.jpg" alt="PLAI" style={{ height: 32, width: 'auto' }} />
          HubActif
        </Link>
        <div className="plai-nav-actions">
          <Link className="plai-nav-link" to="/">Espace élève</Link>
          <Link className="plai-nav-link" to="/enseignant">Espace enseignant</Link>
          {user && <button className="plai-nav-link" onClick={signOut}>Se déconnecter</button>}
        </div>
      </nav>
      <main className="plai-container" style={{ paddingTop: '1.5rem', paddingBottom: '2rem' }}>{children}</main>
      <footer className="plai-footer hub-noprint">
        <div className="plai-container">
          <img src="/plai-logo.jpg" alt="PLAI" style={{ height: 40, width: 'auto' }} />
          <p>HubActif · Pôle Territorial de la Ville de Liège · PLAI</p>
        </div>
      </footer>
    </>
  )
}
```

- [ ] **Step 4: Écrire `LoginPage`**

`src/pages/LoginPage.jsx` :
```jsx
import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import Field from '../components/Field.jsx'

const FR = {
  'Invalid login credentials': 'Adresse e-mail ou mot de passe incorrect.',
  'Email not confirmed': 'Adresse non confirmée : ouvrez le message reçu à l’inscription.',
  'User already registered': 'Un compte existe déjà avec cette adresse.',
}
const message = (e) => FR[e?.message] ?? e?.message ?? 'Une erreur est survenue.'

const TITLES = {
  signin: 'Connexion enseignant',
  signup: 'Créer un compte enseignant',
  reset: 'Mot de passe oublié',
  newpass: 'Choisir un nouveau mot de passe',
}

export default function LoginPage() {
  const [mode, setMode] = useState('signin') // signin | signup | reset | newpass
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [busy, setBusy] = useState(false)
  const navigate = useNavigate()
  const from = useLocation().state?.from
  const back = from ? from.pathname + from.search : '/enseignant'

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => { if (event === 'PASSWORD_RECOVERY') setMode('newpass') })
    return () => data.subscription.unsubscribe()
  }, [])

  async function submit(e) {
    e.preventDefault()
    setBusy(true); setError(''); setInfo('')
    try {
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        navigate(back, { replace: true })
      } else if (mode === 'signup') {
        // emailRedirectTo obligatoire : sans lui le lien de confirmation renvoie vers une autre app du projet partagé.
        const { error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${window.location.origin}/enseignant` } })
        if (error) throw error
        setInfo('Compte créé. Ouvrez le message reçu pour confirmer votre adresse, puis connectez-vous.')
      } else if (mode === 'reset') {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/enseignant/connexion` })
        if (error) throw error
        setInfo('Si cette adresse existe, un lien de réinitialisation vient d’être envoyé.')
      } else {
        const { error } = await supabase.auth.updateUser({ password })
        if (error) throw error
        navigate('/enseignant', { replace: true })
      }
    } catch (err) {
      setError(message(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="plai-card" style={{ maxWidth: 480, margin: '2rem auto' }}>
      <h1 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 26, marginBottom: '1rem' }}>{TITLES[mode]}</h1>
      <form onSubmit={submit}>
        {mode !== 'newpass' && (
          <Field id="email" label="Adresse e-mail professionnelle" help="Sert uniquement à vous connecter à vos classes. Les élèves n’ont pas de compte.">
            <input id="email" type="email" className="plai-input" required autoComplete="email" aria-describedby="email-help"
              placeholder="prenom.nom@ecole.be" value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
        )}
        {mode !== 'reset' && (
          <Field id="password" label={mode === 'newpass' ? 'Nouveau mot de passe' : 'Mot de passe'}
            help="8 caractères minimum. Il donne accès à vos classes et aux codes de vos élèves : ne le réutilisez pas ailleurs.">
            <input id="password" type="password" className="plai-input" required minLength={8} aria-describedby="password-help"
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              placeholder="8 caractères minimum" value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
        )}
        {error && <div className="plai-error" role="alert">{error}</div>}
        {info && <div className="plai-success" role="status">{info}</div>}
        <button className="plai-btn" type="submit" disabled={busy}>
          {{ signin: 'Se connecter', signup: 'Créer le compte', reset: 'Envoyer le lien', newpass: 'Enregistrer' }[mode]}
        </button>
      </form>
      {mode !== 'newpass' && (
        <div className="hub-row" style={{ marginTop: '1rem' }}>
          {mode !== 'signin' && <button type="button" className="plai-btn-ghost" onClick={() => setMode('signin')}>J’ai déjà un compte</button>}
          {mode !== 'signup' && <button type="button" className="plai-btn-ghost" onClick={() => setMode('signup')}>Créer un compte</button>}
          {mode === 'signin' && <button type="button" className="plai-btn-ghost" onClick={() => setMode('reset')}>Mot de passe oublié</button>}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 5: Remplacer `src/App.jsx`** (les autres routes s'ajoutent aux tâches suivantes)

```jsx
import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext.jsx'
import Layout from './components/Layout.jsx'
import LoginPage from './pages/LoginPage.jsx'

export default function App() {
  return (
    <AuthProvider>
      <Layout>
        <Routes>
          <Route path="/enseignant/connexion" element={<LoginPage />} />
          <Route path="*" element={<Navigate to="/enseignant/connexion" replace />} />
        </Routes>
      </Layout>
    </AuthProvider>
  )
}
```

- [ ] **Step 6: Vérifier le build**

Run : `npx vite build`
Expected : build OK, aucune erreur.

- [ ] **Step 7: Vérifier dans le navigateur** (aperçu `hubactif-vercel-dev`, http://localhost:3000)

Checklist :
1. La page « Connexion enseignant » s'affiche avec logo, nav, footer ; texte lisible (16 px minimum : inspecter label, aide, bouton).
2. Chaque champ a label, placeholder et texte d'aide.
3. Mauvais mot de passe : message rouge en français, sans détail technique.
4. « Créer un compte » : créer un compte avec une adresse de test, vérifier que le lien de confirmation reçu pointe vers l'adresse du hub et non vers une autre app.
5. Console du navigateur : aucune erreur.

- [ ] **Step 8: Commit**

```bash
git add src
git commit -m "feat: fondations frontend (auth, mise en page, connexion)" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 19: Logique de la vue transversale (matrice, statuts, regroupement)

**Files:**
- Create: `src/lib/matrix.js`
- Test: `tests/matrix.test.mjs`

- [ ] **Step 1: Écrire le test qui échoue**

`tests/matrix.test.mjs` :
```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { buildMatrix, filterAssignmentsByDomain, groupByDomain, isLate, STATUS_LABEL, STATUS_ICON, formatDate } from '../src/lib/matrix.js'

const students = [{ id: 's1', code: 'AAAA2222' }, { id: 's2', code: 'BBBB3333' }]
const assignments = [{ id: 'a1', domain_id: 'd1' }, { id: 'a2', domain_id: 'd2' }]
const targets = [
  { student_id: 's1', assignment_id: 'a1', status: 'completed' },
  { student_id: 's2', assignment_id: 'a2', status: 'started' },
]

test('buildMatrix : une cellule par élève et par tâche, null si non assigné', () => {
  const { columns, rows } = buildMatrix({ students, assignments, targets })
  assert.equal(columns.length, 2)
  assert.equal(rows[0].cells[0].status, 'completed')
  assert.equal(rows[0].cells[1], null)
  assert.equal(rows[1].cells[0], null)
  assert.equal(rows[1].cells[1].status, 'started')
})

test('filterAssignmentsByDomain', () => {
  assert.equal(filterAssignmentsByDomain(assignments, '').length, 2)
  assert.deepEqual(filterAssignmentsByDomain(assignments, 'd2').map((a) => a.id), ['a2'])
})

test('isLate : échéance passée et pas terminé', () => {
  const now = new Date('2026-10-10T12:00:00Z')
  assert.equal(isLate(now, '2026-10-01T00:00:00Z', 'started'), true)
  assert.equal(isLate(now, '2026-10-01T00:00:00Z', 'completed'), false)
  assert.equal(isLate(now, '2026-11-01T00:00:00Z', 'assigned'), false)
  assert.equal(isLate(now, null, 'assigned'), false)
})

test('groupByDomain : regroupe, « Sans domaine » en dernier', () => {
  const t = (label) => ({ hub_assignments: { hub_domains: label ? { label } : null } })
  const groups = groupByDomain([t('Vocabulaire'), t(null), t('Orthographe'), t('Vocabulaire')])
  assert.deepEqual(groups.map((g) => [g.domain, g.targets.length]), [['Orthographe', 1], ['Vocabulaire', 2], ['Sans domaine', 1]])
})

test('libellés et icônes de statut couvrent les trois états', () => {
  for (const s of ['assigned', 'started', 'completed']) {
    assert.ok(STATUS_LABEL[s]); assert.ok(STATUS_ICON[s])
  }
})

test('formatDate en français de Belgique', () => {
  assert.match(formatDate('2026-10-01T12:00:00Z'), /^01\/10\/2026$/)
})
```

- [ ] **Step 2: Vérifier l'échec**

Run : `npm test`
Expected : FAIL, `Cannot find module '../src/lib/matrix.js'`.

- [ ] **Step 3: Implémenter `src/lib/matrix.js`**

```js
export const STATUS_LABEL = { assigned: 'Assigné', started: 'Commencé', completed: 'Terminé' }
// L'icône accompagne toujours le texte : le statut ne repose jamais sur la couleur seule.
export const STATUS_ICON = { assigned: '○', started: '◐', completed: '●' }

export const formatDate = (iso) => new Date(iso).toLocaleDateString('fr-BE')

// « En retard » est calculé, jamais stocké.
export function isLate(now, dueAt, status) {
  return Boolean(dueAt) && status !== 'completed' && new Date(dueAt).getTime() < now.getTime()
}

export function filterAssignmentsByDomain(assignments, domainId) {
  return domainId ? assignments.filter((a) => a.domain_id === domainId) : assignments
}

// Grille classe × tâches. cells[i] = cible de l'élève pour la tâche i, ou null si non assignée.
export function buildMatrix({ students, assignments, targets }) {
  const byKey = new Map(targets.map((t) => [`${t.student_id}:${t.assignment_id}`, t]))
  return {
    columns: assignments,
    rows: students.map((student) => ({
      student,
      cells: assignments.map((a) => byKey.get(`${student.id}:${a.id}`) ?? null),
    })),
  }
}

// Fiche élève : cibles (avec hub_assignments.hub_domains imbriqués) regroupées par domaine.
export function groupByDomain(targets) {
  const NONE = 'Sans domaine'
  const groups = new Map()
  for (const t of targets) {
    const label = t.hub_assignments?.hub_domains?.label ?? NONE
    if (!groups.has(label)) groups.set(label, [])
    groups.get(label).push(t)
  }
  return [...groups.entries()]
    .sort(([a], [b]) => (a === NONE) - (b === NONE) || a.localeCompare(b, 'fr'))
    .map(([domain, items]) => ({ domain, targets: items }))
}
```

- [ ] **Step 4: Relancer les tests**

Run : `npm test`
Expected : PASS, 0 fail.

- [ ] **Step 5: Commit**

```bash
git add src/lib/matrix.js tests/matrix.test.mjs
git commit -m "feat: logique de la vue transversale (matrice, retard, domaines)" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 20: Classes, codes élèves, remise à zéro, grille de suivi

**Files:**
- Create: `src/lib/students.js`, `src/components/StudentsPanel.jsx`, `src/components/ResetBanner.jsx`, `src/components/ClassGrid.jsx`, `src/pages/ClassesPage.jsx`, `src/pages/ClassPage.jsx`
- Modify: `src/App.jsx`

- [ ] **Step 1: Écrire `src/lib/students.js`**

```js
import { supabase } from './supabase.js'
import { generateCode, parseCodeList, isValidCode } from '../../shared/codes.js'

const UNIQUE_VIOLATION = '23505'

// Génère `count` codes (les collisions, très rares, sont retentées). Retourne le nombre ajouté.
export async function addGeneratedCodes(classId, count) {
  let added = 0
  for (let guard = 0; added < count && guard < count * 5; guard++) {
    const { error } = await supabase.from('hub_students').insert({ class_id: classId, code: generateCode() })
    if (!error) added++
    else if (error.code !== UNIQUE_VIOLATION) throw error
  }
  return added
}

// Adopte une liste de codes existants. `conflicts` = codes déjà pris (autre classe), `invalid` = format refusé.
export async function addPastedCodes(classId, text) {
  const codes = parseCodeList(text)
  const invalid = codes.filter((c) => !isValidCode(c))
  const added = []
  const conflicts = []
  for (const code of codes.filter(isValidCode)) {
    const { error } = await supabase.from('hub_students').insert({ class_id: classId, code })
    if (!error) added.push(code)
    else if (error.code === UNIQUE_VIOLATION) conflicts.push(code)
    else throw error
  }
  return { added, conflicts, invalid }
}

// Code perdu ou compromis : nouveau code pour le même élève (l'historique est conservé).
export async function regenerateCode(studentId) {
  for (let i = 0; i < 5; i++) {
    const { error } = await supabase.from('hub_students').update({ code: generateCode() }).eq('id', studentId)
    if (!error) return
    if (error.code !== UNIQUE_VIOLATION) throw error
  }
  throw new Error('Impossible de générer un code unique, réessayez.')
}

export async function removeStudent(studentId) {
  const { error } = await supabase.from('hub_students').delete().eq('id', studentId)
  if (error) throw error
}
```

- [ ] **Step 2: Écrire `ResetBanner`**

`src/components/ResetBanner.jsx` :
```jsx
import { useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { needsReset } from '../../shared/dates.js'

export default function ResetBanner({ cls, onDone }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  if (!needsReset(new Date(), { createdAt: cls.created_at, lastResetAt: cls.last_reset_at })) return null

  async function reset() {
    const ok = window.confirm(
      'Remettre cette classe à zéro ?\n\nLes codes élèves, les assignations, les suivis et les notes seront supprimés. ' +
      'La classe et son code restent. Cette action est irréversible.'
    )
    if (!ok) return
    setBusy(true); setError('')
    const { error } = await supabase.rpc('hub_reset_class', { p_class: cls.id })
    setBusy(false)
    if (error) setError('La remise à zéro a échoué. Réessayez.')
    else onDone()
  }

  return (
    <div className="plai-banner" role="alert" style={{ borderRadius: 6, margin: '1rem 0' }}>
      <p>
        Fin d’année : la remise à zéro est proposée dès le 15 juillet. Sans action de votre part, les données de
        cette classe seront supprimées automatiquement le 15 août.
      </p>
      {error && <div className="plai-error" role="alert">{error}</div>}
      <button className="plai-btn" onClick={reset} disabled={busy} style={{ marginTop: 8 }}>Remettre la classe à zéro</button>
    </div>
  )
}
```

- [ ] **Step 3: Écrire `StudentsPanel`**

`src/components/StudentsPanel.jsx` :
```jsx
import { useState } from 'react'
import { Link } from 'react-router-dom'
import Field from './Field.jsx'
import { addGeneratedCodes, addPastedCodes, regenerateCode, removeStudent } from '../lib/students.js'

export default function StudentsPanel({ classId, students, onChange }) {
  const [count, setCount] = useState(10)
  const [pasted, setPasted] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function run(fn) {
    setBusy(true); setError(''); setMessage('')
    try { await fn(); await onChange() } catch (e) { setError(e.message || 'Une erreur est survenue.') } finally { setBusy(false) }
  }

  const generate = () => run(async () => {
    const n = await addGeneratedCodes(classId, Math.min(Math.max(Number(count) || 0, 1), 60))
    setMessage(`${n} code(s) ajouté(s).`)
  })

  const paste = () => run(async () => {
    const { added, conflicts, invalid } = await addPastedCodes(classId, pasted)
    const parts = [`${added.length} code(s) ajouté(s).`]
    if (conflicts.length) parts.push(`Déjà utilisés ailleurs (refusés) : ${conflicts.join(', ')}.`)
    if (invalid.length) parts.push(`Format invalide (refusés) : ${invalid.join(', ')}.`)
    setMessage(parts.join(' '))
    setPasted('')
  })

  return (
    <section className="hub-stack">
      <h2>Élèves ({students.length})</h2>
      <div className="plai-card hub-stack">
        <Field id="count" label="Nombre de codes à générer"
          help="Un code anonyme par élève (8 caractères). HubActif ne stocke aucun nom : gardez vous-même la liste code et élève.">
          <input id="count" type="number" min="1" max="60" className="plai-input" style={{ maxWidth: 140 }}
            aria-describedby="count-help" placeholder="Ex. 24" value={count} onChange={(e) => setCount(e.target.value)} />
        </Field>
        <button className="plai-btn" onClick={generate} disabled={busy}>Générer les codes</button>

        <Field id="pasted" label="Ou coller des codes existants"
          help="Un code par ligne, comme dans vos autres apps PLAI (ex. Mathipulatifs). Vos élèves gardent leurs codes habituels. Un code déjà utilisé dans une autre classe est refusé.">
          <textarea id="pasted" rows={4} className="plai-input" aria-describedby="pasted-help"
            placeholder={'ELEVE01\nELEVE02\nELEVE03'} value={pasted} onChange={(e) => setPasted(e.target.value)} />
        </Field>
        <button className="plai-btn-ghost" onClick={paste} disabled={busy || !pasted.trim()}>Ajouter ces codes</button>

        {message && <div className="plai-success" role="status">{message}</div>}
        {error && <div className="plai-error" role="alert">{error}</div>}
      </div>

      {students.length === 0 ? (
        <p className="plai-empty">Aucun élève pour l’instant. Générez des codes ou collez-en.</p>
      ) : (
        <div className="hub-grid-wrap">
          <table className="hub-grid">
            <thead><tr><th>Code élève</th><th>Actions</th></tr></thead>
            <tbody>
              {students.map((s) => (
                <tr key={s.id}>
                  <td><Link to={`/enseignant/classes/${classId}/eleves/${s.id}`} className="hub-code">{s.code}</Link></td>
                  <td className="hub-row">
                    <button className="plai-btn-ghost" disabled={busy}
                      onClick={() => window.confirm('Donner un nouveau code à cet élève ? L’ancien code cessera de fonctionner.') && run(() => regenerateCode(s.id))}>
                      Nouveau code (perdu)
                    </button>
                    <button className="plai-btn-ghost" disabled={busy}
                      onClick={() => window.confirm('Retirer cet élève ? Son suivi sera supprimé.') && run(() => removeStudent(s.id))}>
                      Retirer
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
```

- [ ] **Step 4: Écrire `ClassGrid`**

`src/components/ClassGrid.jsx` :
```jsx
import { useState } from 'react'
import { Link } from 'react-router-dom'
import Field from './Field.jsx'
import { buildMatrix, filterAssignmentsByDomain, isLate, formatDate, STATUS_ICON, STATUS_LABEL } from '../lib/matrix.js'

export default function ClassGrid({ classId, students, assignments, targets, domains, apps }) {
  const [domainId, setDomainId] = useState('')
  if (assignments.length === 0) return <p className="plai-empty">Aucune tâche assignée pour l’instant.</p>

  const shown = filterAssignmentsByDomain(assignments, domainId)
  const { rows } = buildMatrix({ students, assignments: shown, targets })
  const now = new Date()
  const appName = (id) => apps.find((a) => a.id === id)?.name ?? 'App'

  return (
    <div className="hub-stack">
      <Field id="domain-filter" label="Filtrer par domaine"
        help="N’affiche que les tâches du domaine choisi. Le domaine est posé par vous à l’assignation.">
        <select id="domain-filter" className="plai-input" style={{ maxWidth: 320 }} aria-describedby="domain-filter-help"
          value={domainId} onChange={(e) => setDomainId(e.target.value)}>
          <option value="">Tous les domaines</option>
          {domains.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
        </select>
      </Field>
      <div className="hub-grid-wrap">
        <table className="hub-grid">
          <thead>
            <tr>
              <th>Élève (code)</th>
              {shown.map((a) => (
                <th key={a.id}>
                  {a.title}<br />
                  {appName(a.app_id)}{a.due_at ? ` · pour le ${formatDate(a.due_at)}` : ''}<br />
                  <Link to={`/enseignant/assignations/${a.id}/feuille`}>Feuille à imprimer</Link>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ student, cells }) => (
              <tr key={student.id}>
                <td><Link className="hub-code" to={`/enseignant/classes/${classId}/eleves/${student.id}`}>{student.code}</Link></td>
                {cells.map((cell, i) => (
                  <td key={shown[i].id}>
                    {cell ? (
                      <span className="hub-status">
                        <span aria-hidden="true">{STATUS_ICON[cell.status]}</span>
                        {STATUS_LABEL[cell.status]}
                        {isLate(now, shown[i].due_at, cell.status) && ' · en retard'}
                      </span>
                    ) : '—'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Écrire `ClassesPage`**

`src/pages/ClassesPage.jsx` :
```jsx
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { must } from '../lib/db.js'
import { useAuth } from '../context/AuthContext.jsx'
import Field from '../components/Field.jsx'
import { generateCode, CLASS_CODE_LENGTH } from '../../shared/codes.js'

export default function ClassesPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [classes, setClasses] = useState(null)
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    supabase.from('hub_classes').select('*').order('created_at', { ascending: false })
      .then((r) => { try { setClasses(must(r)) } catch (e) { setError(e.message) } })
  }, [])

  async function create(e) {
    e.preventDefault()
    setBusy(true); setError('')
    try {
      for (let i = 0; i < 5; i++) {
        const { data, error } = await supabase.from('hub_classes')
          .insert({ teacher_id: user.id, name: name.trim(), class_code: generateCode(CLASS_CODE_LENGTH) }).select().single()
        if (!error) return navigate(`/enseignant/classes/${data.id}`)
        if (error.code !== '23505') throw error
      }
      throw new Error('Impossible de générer un code de classe unique, réessayez.')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="hub-stack">
      <h1 style={{ fontFamily: "'DM Serif Display', serif" }}>Mes classes</h1>
      {error && <div className="plai-error" role="alert">{error}</div>}
      {classes === null ? <p className="plai-empty">Chargement…</p> : classes.length === 0 ? (
        <p className="plai-empty">Aucune classe pour l’instant. Créez la première ci-dessous.</p>
      ) : classes.map((c) => (
        <div className="plai-card" key={c.id}>
          <Link to={`/enseignant/classes/${c.id}`}><strong>{c.name}</strong></Link>
          <span> · code de classe </span><span className="hub-code">{c.class_code}</span>
        </div>
      ))}
      <form className="plai-card" onSubmit={create}>
        <Field id="class-name" label="Nom de la classe"
          help="Visible uniquement par vous. Les élèves ne voient que le code de classe généré automatiquement.">
          <input id="class-name" className="plai-input" required maxLength={60} aria-describedby="class-name-help"
            placeholder="Ex. 2e secondaire B – français" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <button className="plai-btn" disabled={busy || !name.trim()}>Créer la classe</button>
      </form>
    </div>
  )
}
```

- [ ] **Step 6: Écrire `ClassPage`**

`src/pages/ClassPage.jsx` :
```jsx
import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { must } from '../lib/db.js'
import ResetBanner from '../components/ResetBanner.jsx'
import StudentsPanel from '../components/StudentsPanel.jsx'
import ClassGrid from '../components/ClassGrid.jsx'
import NoScoreBanner from '../components/NoScoreBanner.jsx'
import QrImage from '../components/QrImage.jsx'

export default function ClassPage() {
  const { classId } = useParams()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try {
      const cls = must(await supabase.from('hub_classes').select('*').eq('id', classId).single())
      const students = must(await supabase.from('hub_students').select('*').eq('class_id', classId).order('code'))
      const assignments = must(await supabase.from('hub_assignments').select('*').eq('class_id', classId).order('created_at', { ascending: false }))
      const domains = must(await supabase.from('hub_domains').select('*').order('label'))
      const apps = must(await supabase.from('hub_apps_public').select('*'))
      const ids = assignments.map((a) => a.id)
      const targets = ids.length ? must(await supabase.from('hub_targets').select('*').in('assignment_id', ids)) : []
      setData({ cls, students, assignments, domains, apps, targets })
    } catch (e) {
      setError(e.message || 'Chargement impossible.')
    }
  }, [classId])

  useEffect(() => { load() }, [load])

  async function deleteClass() {
    if (!window.confirm(`Supprimer la classe « ${data.cls.name} » ? Élèves, assignations et suivis seront supprimés définitivement.`)) return
    const { error } = await supabase.from('hub_classes').delete().eq('id', classId)
    if (error) setError('Suppression impossible.')
    else navigate('/enseignant')
  }

  if (error) return <div className="plai-error" role="alert">{error}</div>
  if (!data) return <p className="plai-empty">Chargement…</p>
  const { cls, students, assignments, domains, apps, targets } = data

  return (
    <div className="hub-stack">
      <p><Link to="/enseignant">← Mes classes</Link></p>
      <h1 style={{ fontFamily: "'DM Serif Display', serif" }}>{cls.name}</h1>
      <div className="plai-card">
        <p>Code de classe à donner à vos élèves : <span className="hub-code">{cls.class_code}</span></p>
        <p className="hub-help">Sur la page d’accueil de HubActif, chaque élève saisit ce code et son code personnel pour retrouver ses tâches.</p>
        <details>
          <summary>QR code de la classe</summary>
          <QrImage text={`${window.location.origin}/?c=${cls.class_code}`} size={180} alt="QR code d’accès de la classe" />
          <p className="hub-help">Les élèves le scannent : le code de classe est déjà rempli, ils tapent seulement leur code personnel.</p>
        </details>
      </div>
      <ResetBanner cls={cls} onDone={load} />
      <StudentsPanel classId={classId} students={students} onChange={load} />
      <section className="hub-stack">
        <h2>Tâches et suivi</h2>
        <div className="hub-row">
          <Link className="plai-btn" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}
            to={`/enseignant/assigner?class=${classId}`}>Assigner une tâche</Link>
        </div>
        <NoScoreBanner />
        <ClassGrid classId={classId} students={students} assignments={assignments} targets={targets} domains={domains} apps={apps} />
      </section>
      <div><button className="plai-btn-ghost" onClick={deleteClass}>Supprimer cette classe</button></div>
    </div>
  )
}
```

- [ ] **Step 7: Ajouter les routes dans `src/App.jsx`**

Ajouter aux imports :
```jsx
import ProtectedRoute from './components/ProtectedRoute.jsx'
import ClassesPage from './pages/ClassesPage.jsx'
import ClassPage from './pages/ClassPage.jsx'
```
Remplacer la route `*` et ajouter avant elle :
```jsx
          <Route path="/enseignant" element={<ProtectedRoute><ClassesPage /></ProtectedRoute>} />
          <Route path="/enseignant/classes/:classId" element={<ProtectedRoute><ClassPage /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/enseignant" replace />} />
```

- [ ] **Step 8: Vérifier le build**

Run : `npx vite build`
Expected : build OK.

- [ ] **Step 9: Vérifier dans le navigateur** (connecté avec le compte de test)

Checklist :
1. `/enseignant` : créer « Ex. 2e secondaire B – français » ; redirection vers la page de la classe, code de classe de 6 caractères affiché.
2. Générer 5 codes : 5 lignes de 8 caractères ; « Nouveau code » change le code ; « Retirer » supprime après confirmation.
3. Coller `ELEVE01`, `eleve02`, `ELEVE01` (doublon) : 2 codes ajoutés en majuscules ; le message l'indique. Coller un code déjà pris dans une autre classe : refusé et listé.
4. Champs : label, placeholder et aide présents ; tailles ≥ 16 px.
5. Créer un second compte enseignant : il ne voit pas cette classe.
6. « Supprimer cette classe » : confirmation puis retour à la liste.
7. « QR code de la classe » : le scan ouvre l’accueil avec le code de classe prérempli.

- [ ] **Step 10: Commit**

```bash
git add src
git commit -m "feat: classes, codes élèves (générés ou collés), remise à zéro, grille de suivi" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 21: Assigner une tâche et feuille imprimable (liens et QR)

**Files:**
- Create: `src/pages/AssignPage.jsx`, `src/pages/SheetPage.jsx`
- Modify: `src/App.jsx`

- [ ] **Step 1: Écrire `AssignPage`**

Paramètres d'URL lus (contrat avec le SDK) : `app` (slug), `title`, `link`, `type`, `domain` (libellé suggéré), `class` (id, facultatif).

`src/pages/AssignPage.jsx` :
```jsx
import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { must } from '../lib/db.js'
import { apiPost } from '../lib/api.js'
import { useAuth } from '../context/AuthContext.jsx'
import Field from '../components/Field.jsx'

export default function AssignPage() {
  const { user } = useAuth()
  const [params] = useSearchParams()
  const [apps, setApps] = useState([])
  const [classes, setClasses] = useState([])
  const [domains, setDomains] = useState([])
  const [students, setStudents] = useState([])
  const [appId, setAppId] = useState('')
  const [classId, setClassId] = useState(params.get('class') ?? '')
  const [title, setTitle] = useState(params.get('title') ?? '')
  const [link, setLink] = useState(params.get('link') ?? '')
  const [taskType, setTaskType] = useState(params.get('type') ?? '')
  const [domainId, setDomainId] = useState('')
  const [due, setDue] = useState('')
  const [mode, setMode] = useState('all')
  const [picked, setPicked] = useState(new Set())
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [newDomain, setNewDomain] = useState('')

  useEffect(() => {
    (async () => {
      try {
        const a = must(await supabase.from('hub_apps_public').select('*'))
        const c = must(await supabase.from('hub_classes').select('id, name').order('name'))
        const d = must(await supabase.from('hub_domains').select('*').order('label'))
        setApps(a); setClasses(c); setDomains(d)
        const bySlug = a.find((x) => x.slug === params.get('app'))
        if (bySlug) setAppId(bySlug.id)
        const suggested = (params.get('domain') ?? '').toLowerCase()
        const byLabel = d.find((x) => x.label.toLowerCase() === suggested)
        if (byLabel) setDomainId(byLabel.id)
        if (!classId && c.length === 1) setClassId(c[0].id)
      } catch (e) { setError(e.message) }
    })()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    setPicked(new Set())
    if (!classId) { setStudents([]); return }
    supabase.from('hub_students').select('id, code').eq('class_id', classId).eq('active', true).order('code')
      .then((r) => { try { setStudents(must(r)) } catch (e) { setError(e.message) } })
  }, [classId])

  async function addDomain() {
    const label = newDomain.trim()
    if (!label) return
    const { data, error } = await supabase.from('hub_domains').insert({ teacher_id: user.id, label }).select().single()
    if (error) return setError(error.code === '23505' ? 'Ce domaine existe déjà.' : 'Ajout impossible.')
    setDomains((d) => [...d, data].sort((a, b) => a.label.localeCompare(b.label, 'fr')))
    setDomainId(data.id)
    setNewDomain('')
  }

  async function submit(e) {
    e.preventDefault()
    setError('')
    if (mode === 'picked' && picked.size === 0) return setError('Cochez au moins un élève.')
    setBusy(true)
    try {
      const res = await apiPost('/api/assignments', {
        app_id: appId, class_id: classId, title, deep_link: link,
        task_type: taskType || null, domain_id: domainId || null,
        due_at: due ? new Date(`${due}T23:59:00`).toISOString() : null,
        student_ids: mode === 'all' ? 'all' : [...picked],
      })
      setResult(res)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  if (result) {
    return (
      <div className="plai-card hub-stack">
        <div className="plai-success" role="status">Tâche assignée à {result.links.length} élève(s).</div>
        <p>Chaque élève a maintenant un lien court et un QR code. Imprimez la feuille ou laissez-les retrouver leur tâche sur HubActif avec leurs codes.</p>
        <div className="hub-row">
          <Link className="plai-btn" style={{ textDecoration: 'none' }} to={`/enseignant/assignations/${result.assignment_id}/feuille`}>Feuille à imprimer</Link>
          <Link className="plai-btn-ghost" style={{ textDecoration: 'none' }} to={`/enseignant/classes/${classId}`}>Retour à la classe</Link>
        </div>
      </div>
    )
  }

  return (
    <form className="plai-card hub-stack" onSubmit={submit}>
      <h1 style={{ fontFamily: "'DM Serif Display', serif" }}>Assigner une tâche</h1>
      {error && <div className="plai-error" role="alert">{error}</div>}
      {apps.length > 0 && !appId && params.get('app') && (
        <div className="plai-error" role="alert">L’app « {params.get('app')} » n’est pas enregistrée dans HubActif. Choisissez-en une dans la liste.</div>
      )}

      <Field id="app" label="App d’origine" help="L’app qui héberge la tâche. Le lien doit pointer vers cette app : HubActif refuse les autres adresses.">
        <select id="app" className="plai-input" required aria-describedby="app-help" value={appId} onChange={(e) => setAppId(e.target.value)}>
          <option value="">Choisir…</option>
          {apps.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </Field>
      <Field id="title" label="Titre de la tâche" help="Ce que l’élève lira sur sa carte de tâche. Court et concret.">
        <input id="title" className="plai-input" required maxLength={120} aria-describedby="title-help"
          placeholder="Ex. Dictée n°3 : les accords du participe passé" value={title} onChange={(e) => setTitle(e.target.value)} />
      </Field>
      <Field id="link" label="Lien de la tâche" help="Adresse de la tâche dans l’app. Elle est préremplie quand vous arrivez depuis l’app.">
        <input id="link" type="url" className="plai-input" required aria-describedby="link-help"
          placeholder="https://…/dictee/3" value={link} onChange={(e) => setLink(e.target.value)} />
      </Field>
      <Field id="type" label="Type de tâche (facultatif)" help="Simple repère pour vous (dictée, exercice, révision…).">
        <input id="type" className="plai-input" maxLength={40} aria-describedby="type-help" placeholder="Ex. dictée"
          value={taskType} onChange={(e) => setTaskType(e.target.value)} />
      </Field>
      <Field id="class" label="Classe" help="Les élèves de cette classe reçoivent la tâche. Ils gardent leurs codes.">
        <select id="class" className="plai-input" required aria-describedby="class-help" value={classId} onChange={(e) => setClassId(e.target.value)}>
          <option value="">Choisir…</option>
          {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </Field>

      <fieldset className="plai-field">
        <legend className="plai-label">Pour qui ?</legend>
        <label className="hub-row"><input type="radio" name="mode" checked={mode === 'all'} onChange={() => setMode('all')} /> Toute la classe ({students.length} élève(s))</label>
        <label className="hub-row"><input type="radio" name="mode" checked={mode === 'picked'} onChange={() => setMode('picked')} /> Certains élèves seulement</label>
        <p className="hub-help">Choisir quelques élèves permet de différencier : chacun reçoit la tâche qui lui convient.</p>
        {mode === 'picked' && students.map((s) => (
          <label className="hub-row" key={s.id}>
            <input type="checkbox" checked={picked.has(s.id)}
              onChange={(e) => setPicked((p) => { const n = new Set(p); e.target.checked ? n.add(s.id) : n.delete(s.id); return n })} />
            <span className="hub-code">{s.code}</span>
          </label>
        ))}
      </fieldset>

      <Field id="due" label="Pour le (facultatif)" help="Après cette date, la tâche apparaît « en retard » dans votre grille. Les liens restent valables 30 jours de plus.">
        <input id="due" type="date" className="plai-input" style={{ maxWidth: 220 }} aria-describedby="due-help" value={due} onChange={(e) => setDue(e.target.value)} />
      </Field>
      <Field id="domain" label="Domaine (facultatif)" help="Étiquette qui regroupe cette tâche avec celles des autres apps dans la fiche de l’élève. C’est votre intention pédagogique.">
        <select id="domain" className="plai-input" aria-describedby="domain-help" value={domainId} onChange={(e) => setDomainId(e.target.value)}>
          <option value="">Sans domaine</option>
          {domains.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
        </select>
      </Field>
      <Field id="new-domain" label="Ajouter un domaine à la liste" help="Pour un objectif absent de la liste (ex. Conjugaison). Il reste à vous seul et sera proposé la prochaine fois.">
        <div className="hub-row">
          <input id="new-domain" className="plai-input" style={{ maxWidth: 320 }} maxLength={60} aria-describedby="new-domain-help"
            placeholder="Ex. Conjugaison" value={newDomain} onChange={(e) => setNewDomain(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addDomain() } }} />
          <button type="button" className="plai-btn-ghost" onClick={addDomain} disabled={!newDomain.trim()}>Ajouter</button>
        </div>
      </Field>

      <button className="plai-btn" disabled={busy || !appId || !classId}>Assigner</button>
    </form>
  )
}
```

- [ ] **Step 2: Écrire `SheetPage`**

`src/pages/SheetPage.jsx` :
```jsx
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { must } from '../lib/db.js'
import QrImage from '../components/QrImage.jsx'

export default function SheetPage() {
  const { assignmentId } = useParams()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    (async () => {
      try {
        const assignment = must(await supabase.from('hub_assignments')
          .select('id, title, due_at, class_id, hub_classes(name, class_code)').eq('id', assignmentId).single())
        const targets = must(await supabase.from('hub_targets')
          .select('id, hub_students(code), hub_links(id, revoked, created_at)').eq('assignment_id', assignmentId))
        const cards = targets.map((t) => {
          const live = (t.hub_links ?? []).filter((l) => !l.revoked).sort((a, b) => b.created_at.localeCompare(a.created_at))[0]
          return { code: t.hub_students.code, linkId: live?.id }
        }).filter((c) => c.linkId).sort((a, b) => a.code.localeCompare(b.code))
        setData({ assignment, cards })
      } catch (e) { setError(e.message || 'Chargement impossible.') }
    })()
  }, [assignmentId])

  if (error) return <div className="plai-error" role="alert">{error}</div>
  if (!data) return <p className="plai-empty">Chargement…</p>
  const { assignment, cards } = data
  const origin = window.location.origin

  return (
    <div className="hub-stack">
      <div className="hub-noprint hub-row">
        <Link to={`/enseignant/classes/${assignment.class_id}`}>← Retour à la classe</Link>
        <button className="plai-btn" onClick={() => window.print()}>Imprimer</button>
      </div>
      <h1 style={{ fontFamily: "'DM Serif Display', serif" }}>{assignment.title}</h1>
      <p>Espace élève : <strong>{origin}</strong> · code de classe <span className="hub-code">{assignment.hub_classes.class_code}</span></p>
      <div className="hub-sheet hub-student">
        {cards.map((c) => (
          <div className="hub-sheet-card" key={c.code}>
            <p><strong>{assignment.title}</strong></p>
            <QrImage text={`${origin}/a/${c.linkId}`} size={170} alt={`QR code de la tâche pour l’élève ${c.code}`} />
            <p>Code : <span className="hub-code">{c.code}</span></p>
            <p>{origin}/a/{c.linkId}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Ajouter les routes dans `src/App.jsx`**

Imports :
```jsx
import AssignPage from './pages/AssignPage.jsx'
import SheetPage from './pages/SheetPage.jsx'
```
Routes (avant la route `*`) :
```jsx
          <Route path="/enseignant/assigner" element={<ProtectedRoute><AssignPage /></ProtectedRoute>} />
          <Route path="/enseignant/assignations/:assignmentId/feuille" element={<ProtectedRoute><SheetPage /></ProtectedRoute>} />
```

- [ ] **Step 4: Vérifier le build**

Run : `npx vite build`
Expected : build OK.

- [ ] **Step 5: Enregistrer une app de test**

Run : `node --env-file=.env.local scripts/register-app.mjs demo "App de démonstration" http://localhost:9999 "mots réussis|essais"`
Expected : `App « App de démonstration » enregistrée` et une ligne `HUB_APP_KEY=hubkey_…` (à noter pour la Task 24, ne pas commiter).

- [ ] **Step 6: Vérifier dans le navigateur**

Checklist :
1. Ouvrir `/enseignant/assigner?app=demo&title=Dictée%20test&link=http://localhost:9999/t/1&domain=Orthographe` : l'app, le titre, le lien et le domaine sont préremplis. Non connecté : redirection vers la connexion puis retour sur la page avec les paramètres.
2. Assigner à toute la classe (avec les codes de la Task 20) : message de succès, bouton « Feuille à imprimer ».
3. Feuille : une carte par élève avec QR, code et lien court ; les QR décodent bien l'adresse `/a/<id>` (scanner l'un d'eux avec un téléphone ou vérifier `alt`).
4. Assigner avec « Certains élèves » : seuls les élèves cochés ont une carte.
5. Lien d'un domaine externe dans `link` : refus « Le lien ne correspond pas au domaine de l'app choisie ».
6. Aperçu impression : nav et footer masqués.
7. « Ajouter un domaine » : le domaine apparaît sélectionné et reste proposé à la prochaine assignation ; un doublon affiche « Ce domaine existe déjà. ».

- [ ] **Step 7: Commit**

```bash
git add src
git commit -m "feat: assigner une tâche (prérempli depuis les apps) et feuille de liens/QR" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 22: Fiche élève (chronologie multi-apps, domaines, notes)

**Files:**
- Create: `src/pages/StudentFilePage.jsx`
- Modify: `src/App.jsx`

- [ ] **Step 1: Écrire `StudentFilePage`**

`src/pages/StudentFilePage.jsx` :
```jsx
import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { must } from '../lib/db.js'
import { useAuth } from '../context/AuthContext.jsx'
import Field from '../components/Field.jsx'
import NoScoreBanner from '../components/NoScoreBanner.jsx'
import { groupByDomain, isLate, formatDate, STATUS_ICON, STATUS_LABEL } from '../lib/matrix.js'

export default function StudentFilePage() {
  const { classId, studentId } = useParams()
  const { user } = useAuth()
  const [data, setData] = useState(null)
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [saved, setSaved] = useState('')
  const [newLink, setNewLink] = useState('')

  const load = useCallback(async () => {
    try {
      const student = must(await supabase.from('hub_students').select('*').eq('id', studentId).single())
      const targets = must(await supabase.from('hub_targets')
        .select('*, hub_assignments(id, title, due_at, app_id, hub_domains(label)), hub_events(*), hub_links(id, revoked, created_at)')
        .eq('student_id', studentId))
      const apps = must(await supabase.from('hub_apps_public').select('*'))
      const noteRow = (await supabase.from('hub_notes').select('body').eq('student_id', studentId).maybeSingle()).data
      setData({ student, targets, apps })
      setNote(noteRow?.body ?? '')
    } catch (e) { setError(e.message || 'Chargement impossible.') }
  }, [studentId])

  useEffect(() => { load() }, [load])

  async function saveNote() {
    setSaved(''); setError('')
    const { error } = await supabase.from('hub_notes').upsert(
      { teacher_id: user.id, student_id: studentId, body: note, updated_at: new Date().toISOString() },
      { onConflict: 'teacher_id,student_id' }
    )
    if (error) setError('Enregistrement impossible.')
    else setSaved('Note enregistrée.')
  }

  async function regenerate(targetId) {
    if (!window.confirm('Créer un nouveau lien pour cette tâche ? L’ancien lien et son QR code cesseront de fonctionner.')) return
    const { data: id, error } = await supabase.rpc('hub_regenerate_link', { p_target: targetId })
    if (error) return setError('Régénération impossible.')
    setNewLink(`${window.location.origin}/a/${id}`)
    load()
  }

  if (error && !data) return <div className="plai-error" role="alert">{error}</div>
  if (!data) return <p className="plai-empty">Chargement…</p>
  const { student, targets, apps } = data
  const appName = (id) => apps.find((a) => a.id === id)?.name ?? 'App'
  const now = new Date()

  return (
    <div className="hub-stack">
      <p><Link to={`/enseignant/classes/${classId}`}>← Retour à la classe</Link></p>
      <h1 style={{ fontFamily: "'DM Serif Display', serif" }}>Élève <span className="hub-code">{student.code}</span></h1>
      <NoScoreBanner />
      {error && <div className="plai-error" role="alert">{error}</div>}
      {newLink && <div className="plai-success" role="status">Nouveau lien : <span className="hub-code">{newLink}</span></div>}

      {targets.length === 0 && <p className="plai-empty">Aucune tâche assignée à cet élève.</p>}
      {groupByDomain(targets).map((group) => (
        <section key={group.domain} className="hub-stack">
          <h2>{group.domain}</h2>
          {group.targets.map((t) => {
            const a = t.hub_assignments
            const events = [...(t.hub_events ?? [])].sort((x, y) => x.occurred_at.localeCompare(y.occurred_at))
            return (
              <div className="plai-card hub-stack" key={t.id}>
                <div>
                  <strong>{a.title}</strong> · {appName(a.app_id)}{a.due_at ? ` · pour le ${formatDate(a.due_at)}` : ''}
                </div>
                <span className="hub-status">
                  <span aria-hidden="true">{STATUS_ICON[t.status]}</span>{STATUS_LABEL[t.status]}
                  {isLate(now, a.due_at, t.status) && ' · en retard'}
                </span>
                {events.length === 0 ? <p className="hub-help">Aucun événement reçu de l’app pour l’instant.</p> : (
                  <ul>
                    {events.map((ev) => (
                      <li key={ev.event_id}>
                        {formatDate(ev.occurred_at)} · {ev.status === 'completed' ? 'terminé' : 'commencé'}
                        {ev.duration_s != null && ` · ${Math.round(ev.duration_s / 60)} min`}
                        {ev.attempts != null && ` · ${ev.attempts} essai(s)`}
                        {(ev.indicators ?? []).map((ind) => ` · ${ind.label} : ${ind.value}`)}
                        {ev.detail_url && <> · <a href={ev.detail_url} target="_blank" rel="noreferrer">Voir dans l’app</a></>}
                      </li>
                    ))}
                  </ul>
                )}
                <div><button className="plai-btn-ghost" onClick={() => regenerate(t.id)}>Nouveau lien / QR</button></div>
              </div>
            )
          })}
        </section>
      ))}

      <section className="plai-card hub-stack">
        <h2>Vos notes</h2>
        <Field id="note" label="Notes sur cet élève"
          help="Visibles par vous seul. HubActif n’en tire aucune conclusion : votre lecture compte. N’écrivez pas le nom de l’élève.">
          <textarea id="note" rows={5} maxLength={2000} className="plai-input" aria-describedby="note-help"
            placeholder="Ex. A besoin que les consignes soient lues à voix haute ; réussit mieux le matin."
            value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
        <div className="hub-row">
          <button className="plai-btn" onClick={saveNote}>Enregistrer la note</button>
          {saved && <span role="status">{saved}</span>}
        </div>
      </section>
    </div>
  )
}
```

- [ ] **Step 2: Ajouter la route dans `src/App.jsx`**

Import :
```jsx
import StudentFilePage from './pages/StudentFilePage.jsx'
```
Route (avant `*`) :
```jsx
          <Route path="/enseignant/classes/:classId/eleves/:studentId" element={<ProtectedRoute><StudentFilePage /></ProtectedRoute>} />
```

- [ ] **Step 3: Vérifier le build**

Run : `npx vite build`
Expected : build OK.

- [ ] **Step 4: Vérifier dans le navigateur**

Checklist :
1. Depuis la classe, cliquer un code élève : la fiche affiche les tâches regroupées par domaine (« Orthographe », « Sans domaine » en dernier).
2. Avec l'assignation de la Task 21 : statut « Assigné ». Après un événement (Task 24) : statut, durée, indicateurs avec leurs libellés d'origine, lien « Voir dans l'app ».
3. « Nouveau lien / QR » : confirmation, nouveau lien affiché ; l'ancien lien renvoie « Ce lien ne marche plus » (`/a/<ancien>`).
4. Notes : enregistrer, recharger la page, la note est conservée. Un second enseignant ne la voit pas.
5. Le bandeau « Aucun score global » est visible.

- [ ] **Step 5: Commit**

```bash
git add src
git commit -m "feat: fiche élève (chronologie multi-apps, domaines, notes)" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 23: Espace élève (codes, cartes de tâches, QR)

**Files:**
- Create: `src/pages/StudentHome.jsx`
- Modify: `src/App.jsx` (version finale complète)

- [ ] **Step 1: Écrire `StudentHome`**

`src/pages/StudentHome.jsx` :
```jsx
import { useEffect, useState } from 'react'
import { apiPost } from '../lib/api.js'
import Field from '../components/Field.jsx'
import QrImage from '../components/QrImage.jsx'
import { STATUS_ICON, STATUS_LABEL, formatDate } from '../lib/matrix.js'

const STORE = 'hub_student_codes'
const read = () => { try { return JSON.parse(localStorage.getItem(STORE)) } catch { return null } }
const write = (v) => { try { v ? localStorage.setItem(STORE, JSON.stringify(v)) : localStorage.removeItem(STORE) } catch { /* stockage indisponible : on continue sans */ } }

export default function StudentHome() {
  // ?c=<code de classe> vient du QR de classe : le code de classe est prérempli.
  const [classCode, setClassCode] = useState(() => (new URLSearchParams(window.location.search).get('c') ?? '').toUpperCase())
  const [studentCode, setStudentCode] = useState('')
  const [remember, setRemember] = useState(false)
  const [tasks, setTasks] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function load(codes, keep) {
    setBusy(true); setError('')
    try {
      const res = await apiPost('/api/student', { class_code: codes.classCode, student_code: codes.studentCode })
      setTasks(res.tasks)
      write(keep ? codes : null)
    } catch (e) {
      setTasks(null)
      setError(e.status === 404 ? 'Je ne reconnais pas ces codes. Vérifie-les avec ton enseignant.' : e.status === 429 ? 'Trop d’essais. Attends quelques minutes.' : 'Un problème est survenu. Réessaie.')
      write(null)
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    const saved = read()
    if (saved?.classCode && saved?.studentCode) {
      setClassCode(saved.classCode); setStudentCode(saved.studentCode); setRemember(true)
      load(saved, true)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const submit = (e) => { e.preventDefault(); load({ classCode, studentCode }, remember) }
  const leave = () => { write(null); setTasks(null); setStudentCode(''); setRemember(false) }
  const origin = window.location.origin

  if (tasks) {
    return (
      <div className="hub-student hub-stack">
        <h1 style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}>Mes tâches</h1>
        {tasks.length === 0 && <p>Tu n’as pas de tâche pour le moment.</p>}
        {tasks.map((t) => (
          <div className="plai-card hub-stack" key={t.link_id}>
            <strong>{t.title}</strong>
            <span>{t.app}{t.due_at ? ` · pour le ${formatDate(t.due_at)}` : ''}</span>
            <span className="hub-status"><span aria-hidden="true">{STATUS_ICON[t.status]}</span>{STATUS_LABEL[t.status]}</span>
            <div><a className="plai-btn" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }} href={`/a/${t.link_id}`}>Ouvrir</a></div>
            <details>
              <summary>Afficher le QR code</summary>
              <QrImage text={`${origin}/a/${t.link_id}`} size={200} alt={`QR code de la tâche ${t.title}`} />
            </details>
          </div>
        ))}
        <div><button className="plai-btn-ghost" onClick={leave}>Changer d’élève</button></div>
      </div>
    )
  }

  return (
    <form className="plai-card hub-student hub-stack" style={{ maxWidth: 520, margin: '2rem auto' }} onSubmit={submit}>
      <h1 style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}>Retrouve tes tâches</h1>
      {error && <div className="plai-error" role="alert">{error}</div>}
      <Field id="class-code" label="Code de la classe" help="Ton enseignant te l’a donné. Il est écrit au tableau ou sur ta feuille.">
        <input id="class-code" className="plai-input" required autoComplete="off" autoCapitalize="characters" aria-describedby="class-code-help"
          placeholder="Ex. K7Q2MX" value={classCode} onChange={(e) => setClassCode(e.target.value)} />
      </Field>
      <Field id="student-code" label="Ton code" help="C’est ton code à toi. Ne le donne à personne d’autre.">
        <input id="student-code" className="plai-input" required autoComplete="off" autoCapitalize="characters" aria-describedby="student-code-help"
          placeholder="Ex. ABCD2345" value={studentCode} onChange={(e) => setStudentCode(e.target.value)} />
      </Field>
      <label className="hub-row">
        <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
        Retenir mes codes sur cet appareil
      </label>
      <p className="hub-help">Coche seulement sur ton appareil personnel, pas sur un ordinateur partagé.</p>
      <button className="plai-btn" disabled={busy}>Voir mes tâches</button>
    </form>
  )
}
```

- [ ] **Step 2: Remplacer `src/App.jsx` par la version finale**

```jsx
import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext.jsx'
import Layout from './components/Layout.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import StudentHome from './pages/StudentHome.jsx'
import LoginPage from './pages/LoginPage.jsx'
import ClassesPage from './pages/ClassesPage.jsx'
import ClassPage from './pages/ClassPage.jsx'
import StudentFilePage from './pages/StudentFilePage.jsx'
import AssignPage from './pages/AssignPage.jsx'
import SheetPage from './pages/SheetPage.jsx'

export default function App() {
  return (
    <AuthProvider>
      <Layout>
        <Routes>
          <Route path="/" element={<StudentHome />} />
          <Route path="/enseignant/connexion" element={<LoginPage />} />
          <Route path="/enseignant" element={<ProtectedRoute><ClassesPage /></ProtectedRoute>} />
          <Route path="/enseignant/classes/:classId" element={<ProtectedRoute><ClassPage /></ProtectedRoute>} />
          <Route path="/enseignant/classes/:classId/eleves/:studentId" element={<ProtectedRoute><StudentFilePage /></ProtectedRoute>} />
          <Route path="/enseignant/assigner" element={<ProtectedRoute><AssignPage /></ProtectedRoute>} />
          <Route path="/enseignant/assignations/:assignmentId/feuille" element={<ProtectedRoute><SheetPage /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </AuthProvider>
  )
}
```

- [ ] **Step 3: Vérifier le build**

Run : `npx vite build`
Expected : build OK.

- [ ] **Step 4: Vérifier dans le navigateur** (`vercel dev`, page `/`)

Checklist :
1. Page d'accueil = espace élève, deux champs avec label, exemple et aide ; police Arial 18 px.
2. Codes de classe et d'élève de la Task 20 (en minuscules) : la liste des tâches s'affiche ; statut en texte et icône.
3. Mauvais code : « Je ne reconnais pas ces codes… », sans dire quel champ est faux.
4. « Ouvrir » redirige vers l'adresse de l'app de démonstration avec `?t=` ; le statut passe à « Commencé » au rechargement.
5. « Afficher le QR code » ouvre le QR ; « Retenir mes codes » : au rechargement les tâches s'affichent sans saisie ; « Changer d'élève » efface la mémoire.
6. Un élève ne voit jamais les tâches d'un autre : tester avec deux codes.
7. Redimensionner à 375 px de large : pas de défilement horizontal, boutons ≥ 44 px.

- [ ] **Step 5: Commit et push (build vérifié)**

```bash
npx vite build
git add src
git commit -m "feat: espace élève (codes, cartes de tâches, QR) et routes finales" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
git push
```
Expected : build OK, push sur `main` (déploiement Vercel).

---

### Task 24: Test de bout en bout automatisé (API réelle)

**Files:**
- Create: `scripts/e2e-smoke.mjs`

Ce script rejoue tout le parcours technique contre `vercel dev` (ou une URL déployée) : création d'une assignation, ouverture du lien court, événements, espace élève. Il crée un compte enseignant et une app jetables et les supprime à la fin.

- [ ] **Step 1: Écrire le script**

`scripts/e2e-smoke.mjs` :
```js
// Usage : lancer `npx vercel dev --listen 3000` dans un terminal, puis `npm run test:e2e`.
// HUB_BASE_URL permet de viser un déploiement (ex. https://hubactif-plai.vercel.app).
import { randomBytes } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { sha256Hex } from '../shared/hash.js'
import { generateCode } from '../shared/codes.js'

const BASE = process.env.HUB_BASE_URL || 'http://localhost:3000'
const { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY } = process.env
const opts = { auth: { persistSession: false } }
const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, opts)
const stamp = Date.now()
const results = []
const check = (name, ok, detail = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  ${JSON.stringify(detail)}`}`) }

async function post(path, body, headers = {}) {
  const res = await fetch(BASE + path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) })
  return { status: res.status, json: await res.json().catch(() => ({})) }
}

let userId, appId
try {
  // --- Comptes et données de départ ---
  const email = `smoke-${stamp}@hubactif.test`
  const password = `Pw-${stamp}-smoke!`
  const { data: u, error: e0 } = await admin.auth.admin.createUser({ email, password, email_confirm: true })
  if (e0) throw e0
  userId = u.user.id
  const teacher = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, opts)
  const { data: s, error: e1 } = await teacher.auth.signInWithPassword({ email, password })
  if (e1) throw e1
  const bearer = { Authorization: `Bearer ${s.session.access_token}` }

  const appKey = `hubkey_smoke_${randomBytes(16).toString('hex')}`
  const { data: app, error: e2 } = await admin.from('hub_apps').insert({
    slug: `smoke-${stamp}`, name: 'App smoke', base_url: 'http://localhost:9999', key_hash: sha256Hex(appKey), indicator_labels: ['mots réussis'],
  }).select().single()
  if (e2) throw e2
  appId = app.id

  const classCode = generateCode(6)
  const { data: cls, error: e3 } = await admin.from('hub_classes').insert({ teacher_id: userId, name: 'Classe smoke', class_code: classCode }).select().single()
  if (e3) throw e3
  const codes = [generateCode(), generateCode()]
  const { error: e4 } = await admin.from('hub_students').insert(codes.map((code) => ({ class_id: cls.id, code })))
  if (e4) throw e4

  // --- Assignation ---
  const payload = { app_id: app.id, class_id: cls.id, title: 'Tâche smoke', deep_link: 'http://localhost:9999/t/1', student_ids: 'all' }
  const noAuth = await post('/api/assignments', payload)
  check('assignation sans connexion : 401', noAuth.status === 401, noAuth)
  const foreign = await post('/api/assignments', { ...payload, deep_link: 'https://evil.example.com/x' }, bearer)
  check('assignation vers un autre domaine : 400', foreign.status === 400, foreign)
  const created = await post('/api/assignments', payload, bearer)
  check('assignation : 200 avec un lien par élève', created.status === 200 && created.json.links?.length === 2, created)
  const link = created.json.links[0]

  // --- Lien court ---
  const go = await fetch(`${BASE}/a/${link.link_id}`, { redirect: 'manual' })
  const location = go.headers.get('location') ?? ''
  check('lien court : 302 vers l’app avec jeton', go.status === 302 && location.startsWith('http://localhost:9999/t/1?t='), { status: go.status, location })
  const token = new URL(location).searchParams.get('t')
  const dead = await fetch(`${BASE}/a/0000000000000000`, { redirect: 'manual' })
  check('lien court inconnu : 410', dead.status === 410)

  // --- Événements ---
  const evt = { event_id: crypto.randomUUID(), token, status: 'completed', duration_s: 90, indicators: [{ label: 'mots réussis', value: 14 }] }
  const h = { 'x-app-key': appKey }
  const r1 = await post('/api/events', evt, h)
  check('événement : 200 enregistré', r1.status === 200 && r1.json.status === 'recorded', r1)
  const r2 = await post('/api/events', evt, h)
  check('événement rejoué : 200 doublon', r2.status === 200 && r2.json.status === 'duplicate', r2)
  check('événement sans clé : 401', (await post('/api/events', evt, {})).status === 401)
  check('événement, mauvaise clé : 401', (await post('/api/events', evt, { 'x-app-key': 'hubkey_faux' })).status === 401)
  const badLabel = await post('/api/events', { ...evt, event_id: crypto.randomUUID(), indicators: [{ label: 'phrase dictée', value: 'x' }] }, h)
  check('événement hors schéma : 400', badLabel.status === 400, badLabel)
  const badToken = await post('/api/events', { ...evt, event_id: crypto.randomUUID(), token: `${token}x` }, h)
  check('événement, jeton altéré : 401', badToken.status === 401, badToken)

  // --- Espace élève ---
  const tasks = await post('/api/student', { class_code: classCode.toLowerCase(), student_code: link.student_code.toLowerCase() })
  check('espace élève : la tâche apparaît, terminée', tasks.status === 200 && tasks.json.tasks?.[0]?.status === 'completed', tasks)
  const other = await post('/api/student', { class_code: classCode, student_code: codes.find((c) => c !== link.student_code) })
  check('espace élève : l’autre élève voit sa propre tâche, non terminée', other.json.tasks?.[0]?.status === 'assigned', other)
  const wrong = await post('/api/student', { class_code: classCode, student_code: 'INCONNU1' })
  check('espace élève : codes inconnus 404 neutre', wrong.status === 404 && wrong.json.error === 'Codes non reconnus.', wrong)
} finally {
  if (userId) await admin.auth.admin.deleteUser(userId)
  if (appId) await admin.from('hub_apps').delete().eq('id', appId)
}

const failed = results.filter((r) => !r).length
console.log(`\n${results.length - failed}/${results.length} vérifications réussies`)
process.exit(failed ? 1 : 0)
```

- [ ] **Step 2: Lancer le serveur puis le test**

Terminal 1 : `npx vercel dev --listen 3000`
Terminal 2 : `npm run test:e2e`
Expected : toutes les lignes `PASS`, `13/13 vérifications réussies`, code de sortie 0. Si une ligne échoue, lire la sortie du terminal 1 (erreur de fonction) avant de corriger.

- [ ] **Step 3: Commit**

```bash
git add scripts/e2e-smoke.mjs
git commit -m "test: parcours de bout en bout (assignation, lien, événements, espace élève)" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 25: Documentation du contrat et mise à jour de la spec

**Files:**
- Create: `docs/CONTRAT-API.md`
- Modify: `docs/superpowers/specs/2026-09-20-hubactif-design.md`

- [ ] **Step 1: Écrire `docs/CONTRAT-API.md`**

````markdown
# HubActif : contrat pour les apps

Ce document dit à un développeur d'app PLAI comment brancher son app sur HubActif (https://hubactif-plai.vercel.app).

## Principe

- L'enseignant assigne depuis HubActif. L'élève arrive dans l'app par un lien ou un QR du hub, avec un jeton `?t=` qui contient son **code élève**.
- L'app utilise ce code comme clé élève (préfixe conseillé : `hub:<code>`), sans rien demander à l'élève.
- L'app renvoie au hub le statut et quelques indicateurs. Le hub ne stocke ni nom ni production d'élève.

## 1. Enregistrer l'app (une fois, par Jean-François)

```bash
node --env-file=.env.local scripts/register-app.mjs <slug> "<Nom>" <https://url-de-l-app> "<libellé1|libellé2>"
```
La commande affiche `HUB_APP_KEY=...` **une seule fois**. La déclarer dans les variables d'environnement Vercel de l'app (jamais dans le frontend). Les libellés d'indicateurs déclarés ici sont les seuls acceptés ensuite.

## 2. Côté app

Copier `sdk/hub-client.js` dans l'app, et `sdk/relay-event.js` dans `api/hub-event.js` (variable `HUB_APP_KEY`). Une app purement statique sur Vercel peut ajouter ce seul dossier `api/`.

```js
import { browserHubClient } from './hub-client.js'
const hub = browserHubClient()

// Au chargement de l'app
const ctx = hub.captureToken()        // { code, assignmentId, ... } ou null
hub.flushQueue()                      // renvoie les événements en attente
window.addEventListener('online', () => hub.flushQueue())

// Quand l'élève commence / termine
hub.reportEvent({ status: 'started' })
hub.reportEvent({
  status: 'completed', duration_s: 300, attempts: 2,
  indicators: [{ label: 'mots réussis', value: 14 }],
  detail_url: 'https://url-de-l-app/eleve/42', // réservé à l'enseignant
})

// Bouton « Assigner via le hub » (côté enseignant)
location.href = hub.assignUrl({ app: '<slug>', title: 'Dictée n°3', link: location.href, type: 'dictée', domain: 'Orthographe' })

// Poste partagé : à la fin de la séance
hub.clearContext()
```

## 3. Format d'un événement

| Champ | Règle |
|---|---|
| `status` | `started` ou `completed` |
| `duration_s` | entier 0 à 86400, facultatif |
| `attempts` | entier 0 à 1000, facultatif |
| `indicators` | 10 maximum ; `label` **déclaré à l'enregistrement** (40 car. max) ; `value` nombre ou texte de 20 car. max |
| `detail_url` | https, même domaine que l'app, facultatif |

**Aucun texte libre produit par l'élève** (phrase dictée, réponse ouverte, prénom cité). Un événement hors règle reçoit `400` et n'est pas enregistré.

Réponses de `POST /api/events` (via le relais) : `200 {status: "recorded"|"duplicate"}`, `400` hors schéma, `401` clé ou jeton invalide/expiré, `403` jeton d'une autre app, `404` assignation inconnue, `429` trop de requêtes.

## 4. Limites à connaître

- **Confiance** : le statut est déclaré par le client de l'app. La clé d'app et le jeton empêchent un tiers de forger des événements ; ils n'empêchent pas un élève technique de rejouer son propre jeton. Enjeu faible (pas de note), mais ne jamais utiliser ces données comme preuve.
- Le jeton dure 120 h ; le SDK le lit sans vérifier la signature, le hub la vérifie à chaque événement.
- Le hub en panne ne bloque pas la tâche : les événements sont remis en file et renvoyés.
- Les codes historiques propres à l'app continuent de fonctionner hors hub.
````

- [ ] **Step 2: Compléter la spec** (`docs/superpowers/specs/2026-09-20-hubactif-design.md`)

Avec l'outil Edit, remplacer la ligne `## 7. Flux d'une assignation` par le bloc suivant suivi de cette même ligne :
```markdown
## 6bis. Précisions d'implémentation (plan du 2026-09-20)

- **Pas de Tailwind** : `plai-style.css` et `hub.css` (surcharges à 16 px minimum) suffisent.
- **Clé d'app côté serveur** : les événements passent par un relais serveur dans chaque app (`api/hub-event.js`), qui porte la clé (variable d'environnement). Une clé dans un navigateur ne serait pas secrète.
- **Limite de confiance** : un statut est déclaré par le client de l'app. La clé et le jeton empêchent les tiers de forger des événements, pas un élève technique qui rejoue son propre jeton. Enjeu faible (pas de note).
- **Vérification du jeton** : le SDK décode le jeton (code élève, expiration) ; la signature est vérifiée par le hub à chaque événement. La vérification côté app reste facultative.
- **Modèle de données** : `hub_events` référence `target_id` (qui implique assignation et élève) ; `hub_assignments` porte un `class_id` ; `hub_links.expires_at` = échéance + 30 jours.
- **Débit** : `/api/student` et `/api/go` limitent par IP avec des seuils larges (une classe entière partage l'IP de l'école) ; `/api/events` limite par app.
- **QR de classe** : `/?c=<code de classe>` préremplit le code de classe ; l'élève tape seulement son code personnel.
- **Jeton** : ES256 (ECDSA P-256), 120 h.

## 7. Flux d'une assignation
```

- [ ] **Step 3: Commit**

```bash
git add docs/CONTRAT-API.md docs/superpowers/specs/2026-09-20-hubactif-design.md
git commit -m "docs: contrat pour les apps et précisions d'implémentation" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 26: Contrôles finaux, déploiement et passation

**Files:** aucun nouveau fichier de code.

- [ ] **Step 1: Suite de tests complète**

Run : `npm test`
Expected : tous les tests passent, `# fail 0`.
Run : `npm run test:db`
Expected : toutes les lignes `PASS`.
Run (serveur `vercel dev` lancé) : `npm run test:e2e`
Expected : `13/13 vérifications réussies`.

- [ ] **Step 2: Aucune clé dans le frontend, aucun `console.log`**

```bash
grep -rn "SERVICE_ROLE\|PRIVATE_KEY\|CRON_SECRET\|HUB_APP_KEY" src index.html || echo "OK: aucune clé dans le frontend"
grep -rn "console.log" src api shared sdk || echo "OK: aucun console.log"
npx vite build
grep -rl "SERVICE_ROLE\|PRIVATE_KEY" dist || echo "OK: rien dans le build"
```
Expected : les trois lignes `OK: …`.

- [ ] **Step 3: Autoriser l'adresse du hub dans Supabase Auth**

Dans le tableau de bord Supabase du projet partagé : Authentication > URL Configuration > Redirect URLs, **ajouter** `https://hubactif-plai.vercel.app/**`. Ne pas modifier le « Site URL » (utilisé par les autres apps). Sans cet ajout, les liens de confirmation et de réinitialisation ne fonctionnent pas en production.

- [ ] **Step 4: Déployer et vérifier la production**

```bash
git push
```
Attendre la fin du déploiement (`vercel ls hubactif-plai`), puis :
```bash
curl -s -o /dev/null -w "%{http_code}\n" https://hubactif-plai.vercel.app/
curl -s -o /dev/null -w "%{http_code}\n" https://hubactif-plai.vercel.app/a/0000000000000000
curl -s -H "Authorization: Bearer $(grep '^CRON_SECRET=' .env.local | cut -d= -f2-)" https://hubactif-plai.vercel.app/api/cron/purge
HUB_BASE_URL=https://hubactif-plai.vercel.app npm run test:e2e
```
Expected : `200`, `410`, `{"purged":0}`, puis `13/13 vérifications réussies`. Vérifier aussi dans le tableau de bord Vercel : un seul projet pour ce dépôt et le cron `/api/cron/purge` (15 août, 03:00 UTC) listé.

- [ ] **Step 5: Parcours complet en navigateur, en production**

Refaire les checklists des Tasks 18, 20, 21, 22 et 23 sur `https://hubactif-plai.vercel.app` : inscription (le lien de confirmation revient bien sur HubActif), classe, codes, assignation, feuille, ouverture d'un lien, fiche élève, espace élève, largeur 375 px, textes ≥ 16 px.

- [ ] **Step 6: Revue globale finale**

Demander une revue de code globale de l'ensemble du dépôt (skill `superpowers:requesting-code-review`), pas seulement tâche par tâche : sécurité (RLS, jetons, redirection ouverte, limitation de débit), fiabilité (idempotence, file d'attente), accessibilité de base. Corriger les points bloquants avant de clore.

- [ ] **Step 7: Passation (hors dépôt)**

1. Écrire `memory/hubactif-session-prompt.md` dans le dossier de mémoire Claude du workspace : objectif, pile, décisions (identité par codes, lien court, jeton 120 h, purge 15 août, schéma strict des indicateurs), pièges (relais serveur pour la clé, redirect URLs Supabase, préfixe `hub_`), et le reste à faire ci-dessous. Ajouter la ligne d'index dans `MEMORY.md`.
2. Reste à faire, en plans séparés :
   - migration des trois apps pilotes (Dictée interactive, LexiActif, FlashPLAI) : `register-app.mjs`, relais `api/hub-event.js`, SDK, bouton « Assigner via le hub » ;
   - vignette HubActif dans `portail-plai/src/data/apps.ts` (dépôt et déploiement séparés), avec lien « Mes tâches ».
3. Références scientifiques : aucune en v1. Toute référence ajoutée plus tard passe par `mcp__RISS__search_articles`.

- [ ] **Step 8: Commit final (si des corrections de revue ont été faites)**

```bash
git add -A
git commit -m "fix: corrections de la revue finale" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
npx vite build && git push
```
