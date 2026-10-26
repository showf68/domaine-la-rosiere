# Service du site (Cloudflare Worker `rosiere` + D1) — EN LIGNE

`https://rosiere.boyoss.workers.dev` (compte Cloudflare de Yossef Haim, jeton `/c/var/conf/cloudflare-workers/vmailplus.env`).
Mise en ligne / mise à jour : `bash server/deploy.sh` (idempotent ; secrets lus dans `/c/var/conf/rosiere/`, coffre R2 `rosiere`).

| Point d'entrée | Rôle |
|---|---|
| `GET /disponibilites.json` | nuits prises + saisons + moyens de paiement actifs (lu par le calendrier du site) |
| `GET /calendrier.ics` | export iCal des séjours **directs confirmés** et des **blocages manuels** : l'URL à coller dans Abritel / Airbnb |
| `POST /demande` | valide (dates libres, séjour minimum, téléphone), enregistre, e-mail au propriétaire (Reply-To = client) |
| `GET /payer?id=&t=` | paiement par carte (Stancer) de l'acompte 30 %, **seulement pour une demande CONFIRMÉE** par le propriétaire ; lien signé mis dans son e-mail de confirmation ; un seul paiement par demande (réutilisé) |
| `GET /admin` | espace du propriétaire, connexion par lien envoyé à domainelarosiere@gmail.com (cookie 30 jours) |
| cron `*/30` | Goliday (page du site actuel), liens iCal importés, nouvel essai des e-mails non partis, paiements Stancer en attente |

- Les calendriers importés ne sont jamais ré-exportés (pas de boucle entre plateformes).
- Une source qui ne répond pas n'efface rien (le calendrier garde la dernière lecture).
- Goliday note la DERNIÈRE nuit incluse : vérifié le 26/10/2026 contre son calendrier affiché (octobre-décembre 2026, jour pour jour).
- E-mail : le Worker poste sur `https://api.i-call.me/rosiere_mail.php` (dépôt ICALL) avec la clé `MAIL_KEY` ; le mail part par Mailgun
  (« Site Domaine La Rosière <rosiere@i-call.me> », Reply-To = client) vers domainelarosiere@gmail.com SEULEMENT. ⛔ Jamais depuis y68 (Yossef Haim, 26/10).
- Un Worker ne peut pas lire sa propre adresse workers.dev (`/calendrier.ics` importé chez lui-même = « lien illisible ») : normal.
- Paiement Stancer : ÉPROUVÉ le 26/10/2026 avec la clé de test du propriétaire (carte 4242… tapée par lui) : intent créé et réutilisé, paiement reçu, statut « acompte », e-mail « Acompte payé » délivré (Mailgun). Reste : clé `sprod_` quand Stancer aura validé son dossier.

## Durcissements du 26/10 (relecture Codex, chaque point vérifié en réel)
- Confirmer = une seule instruction SQL qui bloque **seulement si libre** (`blockIfFree`) : 2 confirmations simultanées sur des dates qui se chevauchent → une seule passe (testé).
- Paiement : jamais avant confirmation ; `authorized` ne compte pas ; montant + devise contrôlés (sinon « paiement à vérifier », rien de bloqué) ; acompte payé = dates impossibles à libérer / refuser.
- `/payer` et `/acompte/etat` exigent le jeton signé ; `/admin/action` refuse une autre origine (CSRF).
- Dates réelles seulement (`2027-02-30` refusé), personnes entières, corps JSON `null` = 400, 5 demandes/h par e-mail et 10/h par connexion.
- iCal : document sans `END:VCALENDAR` n'efface rien ; nom de source stable (empreinte du lien) ; lectures bornées à 15 s.
- Goliday : seule l'entrée de 20 ans est écartée (plus de seuil à 90 nuits). Bouton « Reprendre les réservations Goliday » à utiliser AVANT d'arrêter Goliday (sinon ses réservations ne partent jamais vers Abritel / Airbnb).
- Décidé par le propriétaire (26/10) : chaque nuit au tarif de sa saison ; contacts gardés sans limite (fichier `/admin/contacts.csv`, case d'accord « offres »). Non traité : lien de connexion réutilisable 30 min, iCal à RRULE/DURATION.
