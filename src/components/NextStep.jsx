import { Link } from 'react-router-dom'
import { classJourney } from '../lib/journey.js'

const LABELS = {
  students: 'Ajouter les élèves',
  assign: 'Donner une tâche',
  share: 'Donner accès aux élèves',
  follow: 'Suivre',
}

// Guide de la classe : où j'en suis, et quoi faire maintenant.
export default function NextStep({ classId, students, assignments, targets, hasApps }) {
  const { steps, current } = classJourney({ students, assignments, targets })
  const n = steps.findIndex((s) => s.key === current) + 1
  const btn = { textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }

  return (
    <section className="plai-card hub-stack hub-noprint hub-step-current" aria-labelledby="next-step-title">
      <h2 id="next-step-title" style={{ fontSize: 20 }}>Où j’en suis : étape {n} sur 4</h2>
      <ol className="hub-steps" aria-label="Les 4 étapes">
        {steps.map((s) => (
          <li key={s.key}>
            <span aria-hidden="true">{s.done ? '●' : s.key === current ? '▶' : '○'}</span>{' '}
            <span className={s.key === current ? 'hub-strong' : undefined}>{LABELS[s.key]}</span>
            {s.done ? ' (fait)' : s.key === current ? ' (à faire maintenant)' : ''}
          </li>
        ))}
      </ol>

      {current === 'students' && (
        <>
          <p>Un élève, c’est un code. Générez autant de codes que d’élèves (ou collez ceux qu’ils utilisent déjà), puis imprimez la liste et notez les prénoms <strong>à la main, sur papier</strong> : HubActif ne connaît aucun nom.</p>
          <div><a className="plai-btn" style={btn} href="#eleves">Ajouter les élèves</a></div>
        </>
      )}
      {current === 'assign' && !hasApps && (
        <p>Votre classe est prête. Aucune app PLAI n’est encore branchée à HubActif : dès qu’une app l’est, elle affiche un bouton « Assigner via HubActif ». Un clic, et la tâche est donnée à cette classe. Revenez ici à ce moment-là.</p>
      )}
      {current === 'assign' && hasApps && (
        <>
          <p>Le plus simple : ouvrez l’app PLAI qui contient la tâche et cliquez sur « Assigner via HubActif ». Le formulaire s’ouvre déjà rempli.</p>
          <div><Link className="plai-btn" style={btn} to={`/enseignant/assigner?class=${classId}`}>Ou remplir le formulaire ici</Link></div>
        </>
      )}
      {current === 'share' && (
        <>
          <p>La tâche est donnée, mais aucun élève ne l’a encore ouverte. Deux façons de la leur faire parvenir : <strong>imprimer la feuille</strong> (un QR code personnel par élève), ou <strong>leur dicter</strong> le code de classe et leur demander de taper leur code personnel (voir « Ce que vous dites à vos élèves »).</p>
          {assignments[0] && (
            <div><Link className="plai-btn" style={btn} to={`/enseignant/assignations/${assignments[0].id}/feuille`}>Ouvrir la feuille à imprimer</Link></div>
          )}
        </>
      )}
      {current === 'follow' && (
        <p>Le tableau plus bas se met à jour tout seul. Cliquez sur le code d’un élève pour voir le détail. Attention : « Terminé » veut dire que l’app signale la fin de la tâche, pas que l’élève a réussi ou compris. Cela reste à observer en classe.</p>
      )}
    </section>
  )
}
