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
      {shown.length === 0 ? <p className="plai-empty">Aucune tâche dans ce domaine.</p> : (
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
      )}
    </div>
  )
}
