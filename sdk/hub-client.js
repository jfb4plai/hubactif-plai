// SDK HubActif : à copier tel quel dans une app. Aucune dépendance.
// Le jeton est décodé (code élève, expiration) mais sa signature n'est PAS vérifiée ici :
// le hub la vérifie à chaque événement reçu.
const TOKEN_KEY = 'hub_token'
const QUEUE_KEY = 'hub_queue'
const EVENT_FIELDS = ['status', 'duration_s', 'attempts', 'indicators', 'detail_url']
const MAX_TOKEN_LENGTH = 2048
const MAX_QUEUE = 50
const MAX_401_TRIES = 20

function decodeToken(token) {
  try {
    if (typeof token !== 'string' || token.length > MAX_TOKEN_LENGTH) return null
    let body = token.split('.')[0].replace(/-/g, '+').replace(/_/g, '/')
    while (body.length % 4) body += '='
    return JSON.parse(atob(body))
  } catch {
    return null
  }
}

// Identifiant d'événement : ne doit jamais lever (vieux appareils).
function defaultUuid() {
  try {
    const c = globalThis.crypto
    if (c && typeof c.randomUUID === 'function') return c.randomUUID()
    if (c && typeof c.getRandomValues === 'function') {
      const b = c.getRandomValues(new Uint8Array(16))
      b[6] = (b[6] & 0x0f) | 0x40
      b[8] = (b[8] & 0x3f) | 0x80
      const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('')
      return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
    }
  } catch { /* repli ci-dessous */ }
  let h = ''
  for (let i = 0; i < 32; i++) h += Math.floor(Math.random() * 16).toString(16)
  return h
}

export function createHubClient({
  storage, location, history, fetchImpl,
  relayUrl = '/api/hub-event',
  hubUrl = 'https://hubactif-plai.vercel.app',
  now = () => Date.now(),
  uuid = defaultUuid,
  timeoutMs = 8000,
}) {
  const safe = (fn, fallback = null) => { try { return fn() } catch { return fallback } }
  let memToken = null // repli si le stockage est indisponible (Safari privé)
  let flushing = false

  // À appeler au chargement de l'app : range le jeton reçu (?t=) et le retire de l'adresse.
  function captureToken() {
    const url = new URL(location.href)
    const t = url.searchParams.get('t')
    if (t) {
      memToken = t
      safe(() => storage.setItem(TOKEN_KEY, t))
      url.searchParams.delete('t')
      safe(() => history.replaceState(history.state, '', url.pathname + url.search + url.hash))
    }
    return getContext()
  }

  // { code, assignmentId, targetId, token, expiresAt } ou null (absent ou expiré).
  function getContext() {
    const token = safe(() => storage.getItem(TOKEN_KEY)) || memToken
    const p = token ? decodeToken(token) : null
    if (!p || typeof p.exp !== 'number' || p.exp * 1000 <= now()) return null
    return { token, code: p.code, assignmentId: p.aid, targetId: p.tid, expiresAt: p.exp * 1000 }
  }

  function clearContext() {
    memToken = null
    safe(() => storage.removeItem(TOKEN_KEY))
  }

  // Adresse de la page « Assigner » du hub, pour le bouton « Assigner via le hub » de l'app.
  function assignUrl({ app, title, link, type, domain, classId }) {
    const u = new URL('/enseignant/assigner', hubUrl)
    const params = { app, title, link, type, domain, class: classId }
    for (const [k, v] of Object.entries(params)) if (v) u.searchParams.set(k, v)
    return u.toString()
  }

  // 401 : le hub ne connaît pas (encore) le jeton ; on réessaie tant que le jeton local est valide.
  function tokenStillValid(entry) {
    const p = decodeToken(entry.token)
    return !!p && typeof p.exp === 'number' && p.exp * 1000 > now()
  }

  async function attempt(entry) {
    const ctrl = typeof AbortController === 'function' ? new AbortController() : null
    const timer = ctrl ? setTimeout(() => ctrl.abort(), timeoutMs) : null
    try {
      const res = await fetchImpl(relayUrl, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(entry),
        ...(ctrl ? { signal: ctrl.signal } : {}),
      })
      if (res.ok) return 'done'
      if (res.status === 408 || res.status === 429 || res.status >= 500) return 'retry'
      if (res.status === 401) return tokenStillValid(entry) && (entry.tries || 0) + 1 < MAX_401_TRIES ? 'retry401' : 'drop'
      return 'drop' // autres 4xx : inutile de réessayer
    } catch {
      return 'retry'
    } finally {
      if (timer) clearTimeout(timer)
    }
  }

  const readQueue = () => {
    const q = safe(() => JSON.parse(storage.getItem(QUEUE_KEY) || '[]'), [])
    return Array.isArray(q) ? q : []
  }
  const writeQueue = (q) => {
    try { storage.setItem(QUEUE_KEY, JSON.stringify(q.slice(-MAX_QUEUE))); return true } catch { return false }
  }

  // event : { status: 'started'|'completed', duration_s?, attempts?, indicators?: [{label, value}], detail_url? }
  async function reportEvent(event) {
    const ctx = getContext()
    if (!ctx) return { sent: false, reason: 'no_context' }
    const entry = { event_id: uuid(), token: ctx.token, occurred_at: new Date(now()).toISOString() }
    for (const f of EVENT_FIELDS) if (event[f] !== undefined) entry[f] = event[f]
    const outcome = await attempt(entry)
    if (outcome === 'retry' || outcome === 'retry401') {
      if (!writeQueue([...readQueue(), outcome === 'retry401' ? { ...entry, tries: 1 } : entry])) return { sent: false, queued: false, reason: 'storage_unavailable' }
      return { sent: false, queued: true }
    }
    return { sent: outcome === 'done' }
  }

  // À appeler au chargement et quand le réseau revient. Retourne le nombre d'événements restants.
  async function flushQueue() {
    if (flushing) return readQueue().length
    flushing = true
    try {
      const removed = new Set() // envoyés ou abandonnés
      const tries = new Map() // compteur mis à jour des conservés
      for (const entry of readQueue()) {
        const outcome = await attempt(entry)
        if (outcome === 'retry401') tries.set(entry.event_id, (entry.tries || 0) + 1)
        else if (outcome !== 'retry') removed.add(entry.event_id)
      }
      // Relecture : les événements ajoutés pendant les attentes ne sont jamais effacés.
      const rest = readQueue()
        .filter((e) => !removed.has(e.event_id))
        .map((e) => (tries.has(e.event_id) ? { ...e, tries: tries.get(e.event_id) } : e))
      writeQueue(rest)
      return rest.length
    } finally {
      flushing = false
    }
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
