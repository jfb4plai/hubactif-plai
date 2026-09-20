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
    <div className="plai-banner" role="region" aria-label="Remise à zéro de fin d’année" style={{ borderRadius: 6, margin: '1rem 0' }}>
      <p>
        <strong>Fin d’année : vous pouvez remettre cette classe à zéro.</strong> Cela supprime les codes élèves, les tâches, le suivi et vos
        notes ; la classe et son code restent, et vous ajouterez de nouveaux élèves à la rentrée. Rien n’est urgent : sans action de
        votre part, cette suppression se fait automatiquement à partir du 15 août.
      </p>
      {error && <div className="plai-error" role="alert">{error}</div>}
      <button className="plai-btn" onClick={reset} disabled={busy} style={{ marginTop: 8 }}>Remettre la classe à zéro</button>
    </div>
  )
}
