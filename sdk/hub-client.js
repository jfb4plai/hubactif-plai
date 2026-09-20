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
