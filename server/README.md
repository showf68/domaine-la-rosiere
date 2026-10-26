# Service du site (Cloudflare Worker + D1) — écrit, NON déployé

Rôle : envoyer la demande de séjour par e-mail au propriétaire, tenir le calendrier (nuits prises), synchroniser Abritel/Airbnb.

| Point d'entrée | Rôle |
|---|---|
| `POST /demande` | valide (dates libres, téléphone obligatoire), enregistre, envoie l'e-mail à `OWNER_EMAIL` avec un lien « bloquer ces dates » |
| `GET /disponibilites.json` | nuits prises : lu par le calendrier du site (`CFG.api` dans `tools/a5-form.js`) |
| `GET /calendrier.ics` | export iCal des séjours **directs confirmés** : l'URL à coller dans Abritel / Airbnb |
| cron (toutes les 30 min) | importe les liens iCal d'Abritel / Airbnb (`ICAL_IMPORTS`) ; si la plateforme ne répond pas, rien n'est effacé |

Les imports ne sont jamais ré-exportés (pas de boucle entre plateformes).

## Mise en service (à faire, avec l'accord de Yossef Haim — compte Cloudflare, e-mail du propriétaire)
1. `wrangler d1 create rosiere` puis `wrangler d1 execute rosiere --file=server/schema.sql`.
2. `wrangler.toml` : binding D1 `DB`, binding `send_email` nommé `MAIL`, cron `*/30 * * * *`, variables `OWNER_EMAIL`, `MAIL_FROM` (une adresse du domaine), `SITE_ORIGIN`, `ICAL_IMPORTS` ; secret `SECRET` (`wrangler secret put SECRET`).
3. E-mail : Cloudflare Email Routing activé sur la zone du domaine, `domainelarosiere@gmail.com` déclarée comme adresse de destination **vérifiée** (le propriétaire clique le lien reçu). Sans cela `send_email` refuse d'envoyer.
4. Le propriétaire donne les liens iCal d'export d'Abritel et d'Airbnb → `ICAL_IMPORTS`.
5. Renseigner `CFG.api` dans le gabarit du site puis reconstruire.

Rien n'est testé contre un vrai D1 ni un vrai envoi : à valider par un envoi réel avant d'annoncer « corrigé ».
