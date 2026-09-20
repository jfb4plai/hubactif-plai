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
