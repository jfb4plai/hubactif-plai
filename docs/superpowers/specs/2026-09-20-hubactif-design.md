# HubActif — document de conception

Date : 2026-09-20
Statut : brouillon à relire (point de départ, pas version finale)
Adresse cible : https://hubactif-plai.vercel.app (disponibilité du nom de projet Vercel à vérifier)

## 1. Objectif

Un point unique où l'enseignant assigne des tâches issues de plusieurs apps PLAI (Dictée interactive, LexiActif, FlashPLAI, Mathipulatifs...) et suit leur réalisation, et où l'élève retrouve toutes ses tâches (liens et QR codes).

Deux bénéfices :
- Enseignant : vue transversale par élève et par classe, quelle que soit l'app d'origine.
- Élève : un seul endroit pour retrouver ses assignations (optionnel : les liens et QR fonctionnent seuls).

HubActif est une app séparée, comme les autres apps PLAI : dépôt GitHub `jfb4plai/hubactif-plai` (https://github.com/jfb4plai/hubactif-plai), branche `main`, projet Vercel propre, vignette dans `portail-plai/src/data/apps.ts`.

## 2. Principes fondateurs appliqués

- **Inclusion** : interface élève minimale (deux champs, cartes de tâches), Arial, 16 px minimum, statut en texte et icône (jamais la couleur seule), aucun mur de texte. L'élève ne voit jamais les tâches ni le statut d'un autre élève.
- **IA = amplificateur** : HubActif n'utilise aucune IA en v1. Aucune décision automatique sur les élèves. Le hub ne calcule aucun score ni profil : il juxtapose des indicateurs. L'interprétation revient à l'enseignant, avec une zone de notes visible sur chaque fiche élève.
- **RISS** : aucune référence scientifique en v1. Toute référence ajoutée plus tard (aide contextuelle, page d'explication) est vérifiée dans RISS avant publication.
- **Contexte FWB / Pôle de Liège** : exemples et placeholders du vocabulaire scolaire de la FWB (école secondaire, CEB, CE1D, CESS), jamais « collège/lycée ». Liste de domaines initiale ancrée sur les réalités des classes du Pôle.

## 3. Périmètre

### v1
- Espace enseignant : classes, codes élèves, assignations, vue transversale, notes.
- Espace élève : saisie code de classe + code élève, liste des tâches, liens, QR.
- Liens courts et QR codes générés par le hub, feuille imprimable par élève ou par classe.
- API `POST /api/events` pour les apps, plus un petit SDK partagé.
- Migration pilote de 2 ou 3 apps (Dictée interactive, LexiActif, FlashPLAI).

### Hors périmètre v1
- Stockage du contenu des tâches ou des productions d'élèves.
- Score global, classement, comparaison entre élèves, alertes automatiques sur un élève.
- Table de correspondance code-hub / code-app (v2, si le besoin apparaît).
- Migration des mécanismes existants (`devoiractif`, `focusactif`, `entiers-relatifs`, Mathipulatifs, QuizzPLAI) : ils restent en place jusqu'à leur migration, sans big bang.
- Compte élève avec mot de passe.

### Ce que HubActif ne fait pas bien (à afficher dans l'interface)
- Il dit ce qui a été fait, pas ce qui a été compris.
- Il ne couvre que les tâches assignées via le hub. L'usage libre d'une app par un élève n'apparaît pas.

## 4. Identité

- **Enseignant** : compte obligatoire (Supabase auth).
- **Élève** : pas de compte. Un seul code anonyme par élève, celui du hub, plus un code de classe.
- Aucun nom d'élève n'est stocké. La correspondance code ↔ élève reste chez l'enseignant (liste papier).
- À la création d'une classe, l'enseignant peut **générer** des codes ou **coller une liste de codes existants** (ex. ceux de sa classe dans Mathipulatifs). Le hub les adopte, sans couplage technique avec l'app.
- Quand l'élève arrive dans une app par lien ou QR du hub, le jeton porte son code. L'app l'utilise comme clé élève et crée sa fiche locale au premier passage. **L'élève ne saisit rien dans l'app.** Les codes propres aux apps continuent de fonctionner hors hub.
- Codes de 8 caractères, non devinables, régénérables par l'enseignant. Limitation des tentatives à la saisie.

## 5. Architecture

- React 18 + Vite 5 + Tailwind v3, charte PLAI (`plai-style.css`, logo `/plai-logo.jpg` avec hauteur fixe et largeur automatique).
- Supabase v2 (auth + PostgreSQL + RLS), projet partagé `dfoaumjleqtxjeaplnna`. Tables toutes préfixées `hub_`. Avant tout `create table` : grep de conflits dans `projets/*/supabase/`, `socraactif`, `LireActif`, `corpusactif`.
- Vercel Serverless Functions `/api/*.js`. Test avec `vercel dev`, jamais `vite dev` seul.
- Les autres apps, y compris celles sur le projet Supabase FlashFWB, parlent au hub par HTTP, pas par base de données.

### Composants
1. Espace enseignant.
2. Espace élève.
3. API : `POST /api/events` (public, authentifié). La création d'assignation est interne au hub (voir §7).
4. SDK minimal (un fichier JS copié dans chaque app) : vérification du jeton, envoi des événements avec file d'attente et identifiants d'idempotence.

## 6. Sécurité

- **Jeton signé** (ES256 ou Ed25519). Clé privée dans les variables d'environnement Vercel du hub seulement. Clé publique dans les apps. Contenu : assignation, code élève, app, expiration. Durée de vie : 120 h (5 jours), pour couvrir un week-end. Le jeton est refabriqué à chaque clic sur le lien court : les congés plus longs sont couverts par la validité du lien, pas par celle du jeton.
- **Événements** : acceptés uniquement avec un jeton valide **et** la clé de l'app émettrice (stockée hachée, révocable par app). Un élève ne peut pas fabriquer son statut.
- **Liens** : un lien court opaque par élève et par assignation. Quiconque possède le lien agit comme cet élève, pour cette seule tâche. Le lien est révocable et régénérable par l'enseignant. Option de QR de classe partagé (l'élève tape son code une fois) pour les groupes où l'anonymat des feuilles individuelles pose problème.
- **RLS** : chaque table lue par l'enseignant est filtrée par `auth.uid()` (directement ou via la classe). Les élèves n'ont aucun accès direct à la base : une fonction serveur (service role) vérifie leurs codes et ne renvoie que leurs assignations. Les événements s'écrivent uniquement par l'API.
- Aucune clé ni donnée utilisateur dans le frontend ou dans un `console.log`.
- Minimisation RGPD : le hub ne stocke ni production d'élève ni nom. Il stocke un résumé, des indicateurs et un lien de détail réservé à l'enseignant.

## 6bis. Précisions d'implémentation (plan du 2026-09-20)

- **Pas de Tailwind** : `plai-style.css` et `hub.css` (surcharges à 16 px minimum) suffisent.
- **Clé d'app côté serveur** : les événements passent par un relais serveur dans chaque app (`api/hub-event.js`), qui porte la clé (variable d'environnement). Une clé dans un navigateur ne serait pas secrète.
- **Limite de confiance** : un statut est déclaré par le client de l'app. La clé et le jeton empêchent les tiers de forger des événements, pas un élève technique qui rejoue son propre jeton. Enjeu faible (pas de note).
- **Vérification du jeton** : le SDK décode le jeton (code élève, expiration) ; la signature est vérifiée par le hub à chaque événement. La vérification côté app reste facultative.
- **Modèle de données** : `hub_events` référence `target_id` (qui implique assignation et élève) ; `hub_assignments` porte un `class_id` ; `hub_links.expires_at` = échéance + 30 jours.
- **Débit** : les seuils sont larges (une classe entière partage l'IP de l'école). `/api/events` : par IP 3000/min (avant la recherche de la clé), par app 1200/min, par assignation 300/min. `/api/student` : 300 par 5 min par IP. `/api/go` : 300/min par IP. `/api/assignments` : par IP 120/min, par utilisateur 60/min. IP du client : `x-vercel-forwarded-for` ou `x-real-ip`, à défaut le dernier saut de `x-forwarded-for` (`api/_lib/ip.js`).
- **SDK** (`sdk/hub-client.js`) : délai de 8 s par envoi ; nouvel essai sur 408, 429, 5xx et erreur réseau ; 401 réessayé tant que le jeton local est valide (20 essais au plus) puis abandonné ; jeton gardé en mémoire si le stockage est indisponible ; `flushQueue` protégé contre les appels simultanés ; file limitée à 50 événements.
- **Schéma d'événement** (`shared/eventSchema.js`) : `detail_url` en http(s) sur l'origine de l'app, 200 caractères au plus, sans identifiants ; valeurs numériques d'indicateur dans ±1e9 ; aucun caractère de contrôle dans les textes ; libellés d'indicateur en double refusés.
- **Enregistrement d'app** : `register-app.mjs` valide le slug et la `base_url` avant de contacter la base.
- **QR de classe** : `/?c=<code de classe>` préremplit le code de classe ; l'élève tape seulement son code personnel.
- **Jeton** : ES256 (ECDSA P-256), 120 h.

## 7. Flux d'une assignation

1. L'enseignant crée sa classe (codes générés ou collés).
2. Dans l'app X, bouton « Assigner via le hub ». L'app **redirige vers le hub** avec titre, lien de la tâche, type et domaine suggéré en paramètres d'URL (rien de sensible). Pas d'authentification enseignant entre domaines.
3. Dans le hub, l'enseignant choisit les cibles (classe entière ou élèves), l'échéance et le domaine (valeur suggérée, qu'il confirme ou modifie). Le hub crée l'assignation, les liens courts, les QR et la feuille imprimable.
4. L'élève scanne le QR ou clique le lien : `hubactif-plai.vercel.app/a/<id>`. Le hub retrouve la cible, note l'ouverture (statut « commencé »), fabrique un jeton court et redirige vers `app/tache/...?t=<jeton>`.
5. L'app vérifie la signature avec la clé publique, lit le code élève, ouvre la tâche. Elle garde une session locale après la première vérification.
6. L'app envoie ses événements au hub (début, fin, indicateurs). Le hub met à jour le statut.
7. La vue transversale lit `hub_targets` et `hub_events`.

Le bouton « Ouvrir » de la page élève du hub utilise le même mécanisme (étape 4).

## 8. Modèle de données

Toutes les tables ont la RLS activée et le préfixe `hub_`.

| Table | Contenu principal |
|---|---|
| `hub_classes` | teacher_id (`auth.uid()`), nom, code de classe |
| `hub_students` | class_id, code élève anonyme, actif |
| `hub_apps` | slug, nom, empreinte de clé, révoquée |
| `hub_assignments` | teacher_id, app_id, titre, lien profond, type, domain_id, échéance |
| `hub_targets` | assignment_id, student_id, statut (assigné / commencé / terminé), mis à jour le |
| `hub_links` | id court opaque, target_id, révoqué, première ouverture |
| `hub_events` | id d'événement (idempotence), assignment_id, student_id, date, durée, tentatives, indicateurs (liste de paires libellé/valeur), lien de détail |
| `hub_notes` | teacher_id, student_id, texte, date |
| `hub_domains` | libellé, teacher_id nul si liste commune |

- « En retard » est calculé à partir de l'échéance, pas stocké.
- Les indicateurs sont affichés **tels quels avec le libellé de l'app**. Ils ne sont jamais additionnés ni normalisés.

## 9. Vue transversale (suivi mutualisé)

Le hub est un **index**, pas une copie des suivis des apps.

1. **Classe × tâches** : grille des statuts, filtrable par domaine.
2. **Fiche élève** : chronologie multi-apps, indicateurs bruts, notes de l'enseignant.
3. **Regroupement par domaine** : ce qu'un élève a fait sur un même objectif, quelle que soit l'app.

Le domaine est une étiquette posée par l'enseignant à l'assignation (liste courte, extensible). L'app peut proposer une valeur par défaut, que l'enseignant confirme ou modifie. C'est le seul pont entre apps hétérogènes.

Bandeau permanent : « Vue limitée aux tâches assignées via le hub. Aucun score global : les indicateurs se lisent, ils ne s'additionnent pas. »

## 10. Interface

Guidage contextuel obligatoire sur chaque champ : label précis, placeholder concret avec exemple réel FWB, texte d'aide sous le champ expliquant l'impact de la saisie.

**Enseignant** : liste des classes, page classe (codes, régénération, feuille imprimable), page « Assigner » (cible de la redirection), grille classe × tâches, fiche élève, notes.

**Élève** : deux champs (code de classe, code élève), puis cartes de tâches : titre, app, échéance, statut (texte + icône), bouton Ouvrir, QR. Mémorisation locale du code optionnelle (localStorage, dans un try/catch, rendu correct sans).

## 11. Erreurs et robustesse

- Hub indisponible : une tâche déjà ouverte continue de fonctionner. Le SDK remet les événements en file et les renvoie plus tard. Identifiants d'événement pour l'idempotence.
- Limite connue : si le hub est indisponible, l'élève ne peut pas **lancer** une tâche depuis un lien ou un QR (la redirection passe par le hub). Atténuation : session locale dans l'app après la première vérification. Alternative écartée : jeton signé directement dans le QR (supprime la dépendance mais QR denses et non révocables).
- Jeton expiré ou invalide : message clair dans l'app, lien de retour vers le hub.
- Code inconnu ou trop d'essais : message neutre et temporisation, sans indiquer quel champ est faux.
- Événement refusé (clé révoquée, jeton invalide) : journalisé côté serveur, sans donnée personnelle.

## 12. Tests

- Signature et vérification du jeton : valide, altéré, expiré.
- RLS : un enseignant ne lit jamais les classes d'un autre.
- API événements : refus sans clé ou sans jeton, idempotence, rejet d'une clé révoquée.
- Bout en bout avec `vercel dev` et une app pilote, y compris le flux de connexion enseignant dans le navigateur.
- `npx vite build` sans erreur avant tout `git push`.
- Revue globale finale après la dernière tâche du plan.

## 13. Déploiement

- Dépôt GitHub `jfb4plai/hubactif-plai`, branche `main`, créé dès le début.
- Projet Vercel `hubactif-plai` connecté au dépôt (vérifier qu'aucun doublon de projet n'apparaît après l'intégration GitHub).
- Variables d'environnement dans Vercel uniquement : clés Supabase, clé privée de signature.
- Vignette dans `portail-plai/src/data/apps.ts` (dépôt et déploiement séparés), avec un lien « Mes tâches » pour l'entrée élève.

## 14. Décisions et questions ouvertes

### Décidé
- **Apps pilotes** : Dictée interactive, LexiActif, FlashPLAI.
- **Durée du jeton** : 120 h (§6). **Lien court** : valide jusqu'à l'échéance plus 30 jours, révocable.
- **Domaines de départ** : Orthographe, Vocabulaire, Lecture, Grammaire, Mémorisation et révision (extensibles par l'enseignant, point de départ à affiner, pas un référentiel officiel FWB).
- **Cycle de vie des données** : le hub ne contient que des codes (aucun nom). Une **remise à zéro annuelle est proposée à partir du 15 juillet** (bandeau dans l'espace enseignant, déclenchée par l'enseignant, une action qui supprime élèves, cibles, événements, liens et notes de la classe). **Purge automatique le 15 août** pour les classes non remises à zéro. À partir du 16 août, l'enseignant peut préparer sa nouvelle année (nouvelles classes, nouveaux codes). Pendant l'année, l'enseignant gère librement ses classes : ajout et suppression de classes, ajout et retrait d'élèves. Supprimer une classe supprime en cascade tout ce qui s'y rattache. De nouveaux codes sont générés chaque année. Les fiches locales des apps ne sont pas touchées par cette remise à zéro (elles relèvent de chaque app).
- **Nom de projet Vercel** `hubactif-plai` : pas de crainte, vérifié à la création du projet.

### Règle sur les indicateurs (ré-identification)
Les apps envoient des indicateurs sous forme de paires libellé/valeur. Pour qu'un indicateur ne devienne pas un canal de données personnelles, l'API applique un schéma strict :
- le libellé est choisi dans une liste déclarée par l'app à son enregistrement (≤ 40 caractères) ;
- la valeur est un nombre ou un texte court (≤ 20 caractères) ;
- aucun texte libre saisi ou produit par l'élève (phrase dictée, réponse ouverte, prénom cité) ;
- le lien de détail est une URL vers l'app, réservée à l'enseignant.
Un événement hors schéma est rejeté et journalisé sans donnée personnelle.

### Encore ouvert
- **Forme du bouton « Assigner via le hub »** dans chacune des trois apps pilotes : à préciser dans le plan d'implémentation.

## 15. Questions challengeantes (réponses de conception)

- **Problème réel ou théorique ?** Trois apps ont déjà chacune leur logique d'assignation : le besoin de fédérer est observé, pas supposé. Reste à vérifier auprès d'enseignants que la vue transversale sert leurs décisions.
- **L'élève en difficulté en bénéficie-t-il ?** Oui si l'entrée est sans friction (QR, aucune saisie dans l'app). Le bénéfice enseignant seul ne suffit pas comme critère d'inclusion.
- **Risque de perdre confiance en son jugement ?** Réduit par l'absence de score, la juxtaposition d'indicateurs et la zone de notes obligatoirement visible. À réévaluer après usage.
- **Ce que l'outil ne fait pas bien** : voir §3.

## 16. Checklist post-build

- Références citées : vérifiées RISS (ou aucune).
- RLS actif sur toutes les tables `hub_*`.
- Aucune clé exposée côté frontend, aucun `console.log` de données utilisateur.
- Aucun résultat IA : sans objet en v1.
- Audit sécurité et fiabilité (jetons, limitation de tentatives, idempotence, révocation).
- Vignette portail à jour.
