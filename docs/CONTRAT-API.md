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

Le script valide les arguments avant de contacter la base : `slug` de 2 à 40 caractères parmi `a-z`, `0-9` et tiret ; `base_url` complète en https (http accepté seulement pour `localhost`).

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

### Comportement du SDK

- Chaque envoi a un délai maximal de 8 s.
- Sont remis en file d'attente puis réessayés : les erreurs réseau, le délai dépassé, les statuts `408`, `429` et `5xx`.
- Un `401` est réessayé tant que le jeton local est valide (le hub peut ne pas encore connaître l'assignation), 20 essais au maximum ; ensuite l'événement est abandonné. Les autres `4xx` sont abandonnés sans nouvel essai.
- Si le stockage du navigateur est indisponible (Safari privé), le jeton reçu est gardé en mémoire pour la durée de la page.
- `flushQueue()` est protégé contre les appels simultanés (un seul envoi de file à la fois) et renvoie le nombre d'événements restants.
- La file garde 50 événements au maximum (les plus récents).

## 3. Format d'un événement

| Champ | Règle |
|---|---|
| `status` | `started` ou `completed` |
| `duration_s` | entier 0 à 86400, facultatif |
| `attempts` | entier 0 à 1000, facultatif |
| `indicators` | 10 maximum ; `label` **déclaré à l'enregistrement** (40 car. max), sans doublon dans un même événement ; `value` nombre (valeur absolue de 1e9 au plus) ou texte de 20 car. max |
| `detail_url` | http(s), même origine que l'app, 200 caractères maximum, sans identifiant ni mot de passe dans l'adresse, facultatif |

Les textes (`value` texte) ne peuvent contenir aucun caractère de contrôle.

**Aucun texte libre produit par l'élève** (phrase dictée, réponse ouverte, prénom cité). Un événement hors règle reçoit `400` et n'est pas enregistré.

Réponses de `POST /api/events` (via le relais) : `200 {status: "recorded"|"duplicate"}`, `400` hors schéma, `401` clé ou jeton invalide/expiré, `403` jeton d'une autre app, `404` assignation inconnue, `429` trop de requêtes.

## 4. Limites de débit

Le hub limite le nombre de requêtes (réponse `429`). L'adresse IP du client est lue dans `x-vercel-forwarded-for` ou `x-real-ip`, à défaut dans le dernier saut de `x-forwarded-for`.

| Route | Limite |
|---|---|
| `/api/events` | par IP 3000/min (avant la recherche de la clé), par app 1200/min, par assignation 300/min |
| `/api/student` | 300 par 5 min par IP |
| `/api/go` | 300/min par IP |
| `/api/assignments` | par IP 120/min, par utilisateur 60/min |

Les seuils sont larges : une classe entière partage l'IP de l'école.

## 5. Limites à connaître

- **Référent** : le jeton voyage dans l'adresse (`?t=`). La page de l'app qui le reçoit doit envoyer l'en-tête `Referrer-Policy: no-referrer` (dans son `vercel.json`) : le SDK retire le jeton de la barre d'adresse après le chargement, mais la première requête de la page a pu le transmettre à une ressource tierce.
- **Purge annuelle** : le hub supprime les classes non remises à zéro à partir du 15 août (cron quotidien en août, refusé avant le 15). Les fiches locales des apps ne sont pas touchées : elles relèvent de chaque app.
- **Confiance** : le statut est déclaré par le client de l'app. La clé d'app et le jeton empêchent un tiers de forger des événements ; ils n'empêchent pas un élève technique de rejouer son propre jeton. Enjeu faible (pas de note), mais ne jamais utiliser ces données comme preuve.
- Le jeton dure 120 h ; le SDK le lit sans vérifier la signature, le hub la vérifie à chaque événement.
- Le hub en panne ne bloque pas la tâche : les événements sont remis en file et renvoyés.
- Les codes historiques propres à l'app continuent de fonctionner hors hub.
