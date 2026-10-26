# Service du site (Cloudflare Worker `rosiere` + D1) — EN LIGNE

`https://rosiere.boyoss.workers.dev` (compte Cloudflare de Yossef Haim, jeton `/c/var/conf/cloudflare-workers/vmailplus.env`).
Mise en ligne / mise à jour : `bash server/deploy.sh` (idempotent ; secrets lus dans `/c/var/conf/rosiere/`, coffre R2 `rosiere`).

| Point d'entrée | Rôle |
|---|---|
| `GET /disponibilites.json` | nuits prises + saisons + moyens de paiement actifs (lu par le calendrier du site) |
| `GET /calendrier.ics` | export iCal des séjours **directs confirmés** et des **blocages manuels** : l'URL à coller dans Abritel / Airbnb |
| `POST /demande` | valide (dates libres, séjour minimum, téléphone), enregistre, e-mail au propriétaire (Reply-To = client) |
| `POST /acompte`, `GET /payer?id=` | paiement de l'acompte 30 % par carte (Stancer, si la clé est saisie) |
| `GET /admin` | espace du propriétaire, connexion par lien envoyé à domainelarosiere@gmail.com (cookie 30 jours) |
| cron `*/30` | Goliday (page du site actuel), liens iCal importés, paiements Stancer en attente |

- Les calendriers importés ne sont jamais ré-exportés (pas de boucle entre plateformes).
- Une source qui ne répond pas n'efface rien (le calendrier garde la dernière lecture).
- Goliday note la DERNIÈRE nuit incluse : vérifié le 26/10/2026 contre son calendrier affiché (octobre-décembre 2026, jour pour jour).
- E-mail : le Worker poste sur `https://api.i-call.me/rosiere_mail.php` (dépôt ICALL) avec la clé `MAIL_KEY` ; le mail part par Mailgun
  (« Site Domaine La Rosière <rosiere@i-call.me> », Reply-To = client) vers domainelarosiere@gmail.com SEULEMENT. ⛔ Jamais depuis y68 (Yossef Haim, 26/10).
- Un Worker ne peut pas lire sa propre adresse workers.dev (`/calendrier.ics` importé chez lui-même = « lien illisible ») : normal.
- Paiement Stancer : codé d'après l'API v2 (`payment_intents`, auth Basic clé secrète), jamais essayé faute de clé.
