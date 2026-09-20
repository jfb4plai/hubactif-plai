import { useState } from 'react'
import { Link } from 'react-router-dom'
import Field from './Field.jsx'
import Callout from './Callout.jsx'
import { friendlyError } from '../lib/errors.js'
import { addGeneratedCodes, addPastedCodes, reactivateStudent, regenerateCode, removeStudent } from '../lib/students.js'

// `students` = tous les élèves de la classe (actifs et retirés) ; `cls` = { name, class_code } pour la liste imprimable.
export default function StudentsPanel({ classId, cls, students: all, onChange }) {
  const students = all.filter((s) => s.active)
  const removed = all.filter((s) => !s.active)
  const [count, setCount] = useState(10)
  const [pasted, setPasted] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function run(fn) {
    setBusy(true); setError(''); setMessage('')
    try { await fn(); await onChange() } catch (e) { setError(friendlyError(e)) } finally { setBusy(false) }
  }

  const generate = () => run(async () => {
    const n = await addGeneratedCodes(classId, Math.min(Math.max(Number(count) || 0, 1), 60))
    setMessage(`${n} code(s) ajouté(s).`)
  })

  const paste = () => run(async () => {
    const { added, conflicts, invalid } = await addPastedCodes(classId, pasted)
    const parts = [`${added.length} code(s) ajouté(s).`]
    if (conflicts.length) parts.push(`Codes refusés, car déjà pris par une autre classe de HubActif : ${conflicts.join(', ')}. Choisissez d’autres codes, ou cliquez sur « Générer les codes » : HubActif en fabrique des uniques.`)
    if (invalid.length) parts.push(`Codes refusés (3 à 32 caractères : lettres, chiffres, tiret) : ${invalid.join(', ')}.`)
    setMessage(parts.join(' '))
    setPasted('')
  })

  // Impression de la liste des codes seule : la classe `printing-codes` masque tout le reste (voir hub.css).
  function printCodes() {
    document.body.classList.add('printing-codes')
    const done = () => { document.body.classList.remove('printing-codes'); window.removeEventListener('afterprint', done) }
    window.addEventListener('afterprint', done)
    window.print()
  }

  return (
    <section className="hub-stack" id="eleves">
      <h2>Élèves ({students.length})</h2>
      <Callout title="Pourquoi des codes et pas des noms ?">
        <p>Pour protéger vos élèves, HubActif ne connaît que des codes. <strong>Vous seul</strong> savez qui se cache derrière chaque code : imprimez la liste (bouton plus bas) et écrivez les prénoms à la main, sur papier.</p>
      </Callout>
      <div className="plai-card hub-stack">
        <Field id="count" label="Nombre de codes à générer"
          help="Un code par élève. HubActif fabrique des codes faciles à recopier (jamais de 0, de O, de 1, de I ni de L, qui se ressemblent). Comptez un code par élève de la classe.">
          <input id="count" type="number" min="1" max="60" className="plai-input" style={{ maxWidth: 140 }}
            aria-describedby="count-help" placeholder="Ex. 24" value={count} onChange={(e) => setCount(e.target.value)} />
        </Field>
        <button className="plai-btn" onClick={generate} disabled={busy}>Générer les codes</button>

        <Field id="pasted" label="Ou coller des codes existants"
          help="Facultatif : si vos élèves ont déjà des codes dans une autre app PLAI (ex. Mathipulatifs), collez-les, un par ligne : ils gardent leurs habitudes. Un code déjà pris par une autre classe de HubActif est refusé : dans ce cas, cliquez plutôt sur « Générer les codes ».">
          <textarea id="pasted" rows={4} className="plai-input" aria-describedby="pasted-help"
            placeholder={'ELEVE01\nELEVE02\nELEVE03'} value={pasted} onChange={(e) => setPasted(e.target.value)} />
        </Field>
        <button className="plai-btn-ghost" onClick={paste} disabled={busy || !pasted.trim()}>Ajouter ces codes</button>

        <div className={message ? 'plai-success' : undefined} role="status" aria-live="polite">{message}</div>
        <div className={error ? 'plai-error' : undefined} role="alert">{error}</div>
      </div>

      {students.length === 0 ? (
        <p className="plai-empty">Aucun élève pour l’instant. Générez des codes ou collez-en.</p>
      ) : (
        <>
        <div className="hub-noprint">
          <button className="plai-btn-ghost" onClick={printCodes}>Imprimer la liste des codes</button>
          <p className="hub-help">La liste imprimée a une colonne vide : écrivez-y à la main le prénom de chaque élève. HubActif ne conserve aucun nom.</p>
        </div>
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
                      Nouveau code
                    </button>
                    <button className="plai-btn-ghost" disabled={busy}
                      onClick={() => window.confirm('Retirer cet élève de la classe ? Son historique est conservé et vous pourrez le réactiver.') && run(() => removeStudent(s.id))}>
                      Retirer
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="hub-help hub-noprint">« Nouveau code » : à utiliser si un élève a perdu son code (l’ancien ne marche plus). « Retirer » : l’élève quitte la classe, son historique est conservé et vous pouvez le réactiver. Cliquez sur un code pour ouvrir la fiche de l’élève.</p>
        </>
      )}

      {removed.length > 0 && (
        <details className="hub-noprint">
          <summary>Élèves retirés ({removed.length})</summary>
          <ul className="hub-stack">
            {removed.map((s) => (
              <li key={s.id} className="hub-row">
                <span className="hub-code">{s.code}</span>
                <button className="plai-btn-ghost" disabled={busy} onClick={() => run(() => reactivateStudent(s.id))}>Réactiver</button>
              </li>
            ))}
          </ul>
        </details>
      )}

      <div className="hub-print-only" aria-hidden="true">
        <h1>Codes élèves : {cls?.name}</h1>
        <p>Code de classe : <strong>{cls?.class_code}</strong> (à saisir sur {window.location.host})</p>
        <table>
          <thead><tr><th style={{ width: '12mm' }}>N°</th><th style={{ width: '45mm' }}>Code</th><th>Prénom (à écrire à la main)</th></tr></thead>
          <tbody>
            {students.map((s, i) => <tr key={s.id}><td>{i + 1}</td><td><strong>{s.code}</strong></td><td /></tr>)}
          </tbody>
        </table>
      </div>
    </section>
  )
}
