import { Link } from 'react-router-dom'

// Page d'aide pour enseignants peu à l'aise avec le numérique : réponses aux questions avant qu'elles ne soient posées.
const FAQ = [
  {
    q: 'Pourquoi des codes et pas les noms de mes élèves ?',
    a: <>Pour protéger vos élèves : HubActif ne connaît que des codes (par exemple <span className="hub-code">K7Q2MX9A</span>). Vous seul savez qui se cache derrière chaque code. Imprimez la liste des codes depuis la page de la classe : elle a une colonne vide où écrire les prénoms <strong>à la main, sur papier</strong>. Gardez cette feuille avec votre cahier de classe.</>,
  },
  {
    q: 'Qu’est-ce que le code de classe et le code personnel ?',
    a: <>Le <strong>code de classe</strong> est le même pour toute la classe (6 caractères). Le <strong>code personnel</strong> est propre à chaque élève (8 caractères). L’élève tape les deux sur la page d’accueil pour retrouver ses tâches. Deux codes, c’est plus sûr : un code personnel seul serait plus facile à deviner.</>,
  },
  {
    q: 'Qu’est-ce qu’un QR code ?',
    a: <>Un carré noir et blanc qui contient une adresse internet. On le « scanne » avec l’appareil photo d’une tablette ou d’un téléphone : la tâche s’ouvre toute seule, sans rien taper. Si un élève n’a pas d’appareil photo, l’adresse courte est aussi écrite sous chaque QR code : il peut la taper.</>,
  },
  {
    q: 'Mes élèves n’ont ni tablette ni téléphone. Comment font-ils ?',
    a: <>Sur un ordinateur, ils ouvrent HubActif, tapent le code de classe puis leur code personnel, et cliquent sur « Ouvrir ». Aucun compte, aucun mot de passe, aucune adresse e-mail n’est nécessaire.</>,
  },
  {
    q: 'Un élève a perdu son code ou sa carte. Que faire ?',
    a: <>Code perdu : dans la liste des élèves de la classe, cliquez sur « Nouveau code » à côté de son code. L’ancien code cesse de fonctionner. Carte ou QR code perdu : ouvrez la fiche de l’élève (cliquez sur son code) puis « Nouveau lien / QR ». Imprimez de nouveau la feuille si besoin.</>,
  },
  {
    q: 'Un élève change de classe ou quitte l’école.',
    a: <>Dans la liste des élèves, cliquez sur « Retirer » : l’élève disparaît de la grille et ne reçoit plus de tâche, mais son historique est conservé. Vous pouvez le « Réactiver » plus tard dans « Élèves retirés ». Pour l’ajouter dans une autre classe, générez-lui un nouveau code.</>,
  },
  {
    q: 'Que voit l’élève ? Que voit HubActif ?',
    a: <>L’élève ne voit que ses propres tâches, jamais celles des autres. HubActif enregistre : les codes, le statut de chaque tâche (assignée, commencée, terminée) et quelques indicateurs envoyés par l’app (durée, nombre d’essais…). Il n’enregistre jamais un nom, ni le texte ou les réponses écrits par l’élève.</>,
  },
  {
    q: 'À quoi sert le « domaine » quand je donne une tâche ?',
    a: <>C’est un thème que vous choisissez (orthographe, vocabulaire, lecture…). Dans la fiche d’un élève, vous verrez ensemble tout ce qu’il a fait sur un même thème, même si les tâches viennent d’apps différentes. C’est facultatif.</>,
  },
  {
    q: 'Que veulent dire « Assigné », « Commencé », « Terminé » et « en retard » ?',
    a: <><strong>Assigné</strong> : la tâche est donnée, l’élève ne l’a pas encore ouverte. <strong>Commencé</strong> : l’élève a ouvert la tâche. <strong>Terminé</strong> : l’app signale que la tâche est finie. <strong>En retard</strong> : la date limite est passée et la tâche n’est pas terminée. « Terminé » ne dit rien de la réussite : HubActif ne calcule ni note ni classement.</>,
  },
  {
    q: 'Quelles apps fonctionnent avec HubActif ?',
    a: <>Les apps PLAI qui ont été « branchées » sur HubActif. Une app branchée affiche un bouton « Assigner via le hub ». HubActif démarre : les premières apps sont branchées une à une. Tant qu’aucune app n’est branchée, vous pouvez déjà préparer vos classes et vos codes.</>,
  },
  {
    q: 'Que se passe-t-il en fin d’année ?',
    a: <>À partir du 15 juillet, un bandeau vous propose de « remettre la classe à zéro » : les codes élèves, les tâches, le suivi et vos notes sont supprimés, la classe et son code restent. Rien n’est urgent : si vous ne faites rien, la suppression se fait automatiquement à partir du 15 août. À la rentrée, vous ajoutez de nouveaux élèves avec de nouveaux codes.</>,
  },
  {
    q: 'Je n’ai pas reçu l’e-mail de confirmation.',
    a: <>Attendez quelques minutes, puis regardez dans vos courriers indésirables (spam). Si rien n’arrive, revenez sur la page de connexion, cliquez sur « Créer un compte » et recommencez avec la même adresse.</>,
  },
  {
    q: 'L’élève voit « Ce lien ne marche plus ».',
    a: <>Le lien de sa tâche a été remplacé ou a expiré (30 jours après la date limite). Ouvrez sa fiche puis « Nouveau lien / QR ».</>,
  },
]

const GLOSSAIRE = [
  ['Assigner', 'Donner une tâche à une classe ou à quelques élèves.'],
  ['Code de classe', 'Le code commun à toute la classe.'],
  ['Code personnel', 'Le code propre à un élève. C’est lui qui remplace son nom.'],
  ['Lien / QR code', 'Le raccourci personnel qui ouvre directement la tâche d’un élève.'],
  ['Indicateur', 'Une information envoyée par l’app (durée, essais, résultat), affichée telle quelle.'],
  ['Domaine', 'Le thème que vous donnez à une tâche (orthographe, vocabulaire…).'],
  ['Remise à zéro', 'Supprimer les élèves, tâches et suivis d’une classe en fin d’année. La classe reste.'],
]

export default function HelpPage() {
  return (
    <div className="hub-stack">
      <h1 style={{ fontFamily: "'DM Serif Display', serif" }}>Aide : HubActif pas à pas</h1>

      <section className="plai-card hub-stack">
        <h2>HubActif en trois phrases</h2>
        <p>HubActif est un carnet de bord : il garde la trace des tâches que vous donnez à vos élèves avec les apps PLAI.</p>
        <p>Vous donnez une tâche à toute la classe ou à quelques élèves ; chaque élève retrouve la sienne avec un code ou un QR code, sans compte ni mot de passe.</p>
        <p>Vous voyez d’un coup d’œil qui a commencé, qui a terminé, et ce que chaque app en dit. Il n’y a ni note ni classement : c’est vous qui interprétez.</p>
      </section>

      <section className="plai-card hub-stack">
        <h2>Pour démarrer (environ 10 minutes)</h2>
        <ol className="hub-steps">
          <li><strong>Créez votre compte</strong> avec votre adresse professionnelle : <Link to="/enseignant/connexion">Espace enseignant</Link>. Vous recevrez un e-mail de confirmation à ouvrir.</li>
          <li><strong>Créez une classe.</strong> HubActif lui donne un code de classe.</li>
          <li><strong>Ajoutez vos élèves</strong> : « Générer les codes » fabrique un code par élève. Imprimez la liste et écrivez les prénoms à la main.</li>
          <li><strong>Donnez une tâche</strong> : dans une app PLAI branchée, cliquez sur « Assigner via le hub ».</li>
          <li><strong>Donnez accès aux élèves</strong> : imprimez la feuille de QR codes, ou dictez le code de classe et laissez chacun taper son code personnel.</li>
          <li><strong>Suivez</strong> : la grille de la classe montre où en est chacun. Cliquez sur un code pour voir la fiche de l’élève.</li>
        </ol>
        <p className="hub-help">Sur la page d’une classe, la carte « Où j’en suis » vous indique toujours la prochaine étape.</p>
      </section>

      <section className="hub-stack">
        <h2>Questions fréquentes</h2>
        {FAQ.map((item) => (
          <details key={item.q} className="plai-card">
            <summary><strong>{item.q}</strong></summary>
            <p style={{ marginTop: 8 }}>{item.a}</p>
          </details>
        ))}
      </section>

      <section className="plai-card hub-stack">
        <h2>Petit lexique</h2>
        <dl className="hub-lexique">
          {GLOSSAIRE.map(([mot, def]) => (
            <div key={mot}><dt><strong>{mot}</strong></dt><dd>{def}</dd></div>
          ))}
        </dl>
      </section>

      <section className="plai-card hub-stack">
        <h2>Une question ?</h2>
        <p>Écrivez à <a href="mailto:jeanfrancois.beguin@ens.ecl.be">jeanfrancois.beguin@ens.ecl.be</a> (Pôle Territorial de la Ville de Liège, PLAI). Dites-nous ce que vous cherchiez à faire : c’est ce qui nous permet d’améliorer cette page.</p>
      </section>
    </div>
  )
}
