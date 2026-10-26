# Domaine La Rosière — site du gîte

Site vitrine bilingue (français / allemand) du Domaine La Rosière, villa pour groupes jusqu'à 50 personnes
avec piscine intérieure chauffée, à Diemeringen (Alsace). Projet client isolé d'ICALL.

## Structure
- `src/index.template.html` : gabarit de la page (design v3b « Les occasions », choisi par Yossef Haim) ; `{{cle}}` = texte traduit. `src/v1.template.html` + `src/v1.css` : ancienne piste v1, archivée.
- `src/i18n/fr.json`, `src/i18n/de.json` : tous les textes. Une clé ajoutée en FR doit exister en DE (le build refuse sinon).
- `src/site.css`, `src/site.js` : style et comportements de la page intégrée (piste v3b, à remplacer par A4).
- `tools/build.mjs` : `node tools/build.mjs` produit `docs/index.html` (FR), `docs/de/index.html` (DE) et la maquette `docs/maquettes/2026-10-22_site/v3b.html`.
- `tools/form-test.mjs` : teste onglets, visionneuse, menu et demande de séjour sans rien envoyer.
- `tools/cdp-shot.mjs` : capture pleine page à vraie largeur (390 px) via Chrome headless ; rapporte débordement horizontal et erreurs console. (`--window-size` de Chrome headless ne descend pas sous 500 px.)
- `docs/` : ce qui est publié (GitHub Pages). `docs/assets/img/` : photos du propriétaire (album Google Photos), WebP 1920 px et 900 px (`-s`).
- `docs/maquettes/2026-10-22_site/` : les trois pistes de design, galerie `index.html`, choix argumenté `PICK.md`.

## État (23/10/2026)
- **Design retenu par Yossef Haim : `docs/maquettes/2026-10-22_haute-classe/a4-demeure.html`** (« Demeure », compacte),
  envoyée au propriétaire le 22/10 au soir (mail y68 `1a165bb41f38cfd7`). C'est une **maquette en français** :
  la page `docs/index.html` (gabarit `src/`) porte encore l'ancienne piste v3b et doit être reconstruite depuis A4.
- Historique des pistes : `docs/maquettes/2026-10-22_site/` (v1–v3, v3b) puis `docs/maquettes/2026-10-22_haute-classe/`
  (A, B, C, A2, A3, A4) ; choix et raisons dans les deux `PICK.md`.
- Médias : `docs/assets/img/` (58 photos étalonnées par `tools/grade.py`, WebP 2200 + 1000 px `-s`),
  `docs/assets/vid/` (4 boucles muettes : drone maison, drone champs, drone coucher, piscine ; 1920 + 960 px + poster).
- Aperçu `noindex` : le domaine `domainelarosiere.com` (registrar OVH, DNS Cloudflare, site actuel Goliday) n'est pas touché.

## État (26/10/2026 au soir) — site A5 en ligne (FR/DE), service de réservation en service
Retours du propriétaire du 26/10 (fil y68 `1a179d6c56403bb6`) appliqués à A4 : titre, textes, photos qui suivent l'étage,
itinéraire Google Maps depuis n'importe quel départ, téléphone obligatoire, montant calculé, calendrier des dates prises,
e-mail réel, synchronisation iCal, acompte par virement ou carte (Stancer), coordonnées en pied.
- **Le site publié est construit par `python tools/make-a5.py`** : A4 + `tools/a5-*.{js,css,html}` → `docs/index.html` (FR),
  `docs/de/index.html` (DE, couples dans `tools/a5_de.py` ; le build refuse un texte FR disparu) et la maquette
  `docs/maquettes/2026-10-22_haute-classe/a5-demeure.html`. ⛔ `tools/build.mjs` (ancienne piste v3b, `src/`) ÉCRASERAIT le site : ne plus le lancer.
- **Service `server/`** (Worker Cloudflare `rosiere` + D1) : `https://rosiere.boyoss.workers.dev`, `bash server/deploy.sh`. Voir `server/README.md`.
  Calendrier = calendrier Goliday actuel relu toutes les 30 min (réservations + saisons) + liens iCal + blocages manuels + séjours confirmés.
- Prix (tarifs du site actuel) : nuit 1 200 / 1 300 / 1 450 € (tarif 1 / haute / très haute), semaine 6 750 / 7 600 / 10 150 €,
  20 personnes incluses, supplément 30 / 26 € par personne et par nuit, minimum 2 / 4 / 4 nuits. Mêmes règles dans `a5-form.js` et `price()` du Worker.

## Reste à faire
1. Le propriétaire, dans `/admin` : coller ses liens iCal Abritel / Airbnb, saisir IBAN et clé Stancer ; coller `/calendrier.ics` dans Abritel / Airbnb.
2. Bascule du domaine, quand il le décide ; Goliday arrêté → retirer `GOLIDAY_URL` de `server/deploy.sh`.
3. Paiement Stancer : codé d'après l'API v2, jamais essayé faute de clé.

## Outils de contrôle
- `node tools/cdp-shot.mjs <url> <largeur> <png> [scrollY] [script]` : capture à largeur réelle (390 px compris),
  liste les éléments qui débordent et les erreurs console. Forcer `document.documentElement.style.scrollBehavior='auto'`
  dans le script avant de défiler.
- `node tools/section-heights.mjs <url> <largeur>` : hauteur de chaque section (pour tenir la page compacte).
- `node tools/ui-test-a4.mjs <url> <largeur>` : coupe, visionneuse, galerie, récapitulatif des dates, envoi simulé.
- `node tools/form-test.mjs` : formulaire de l'ancienne page intégrée.

## Sources du contenu
Descriptif 2026, livret d'accueil, carnet de sorties et logo envoyés par le propriétaire ; album photo partagé ;
site actuel `/fr`. Le livret contient des informations réservées aux voyageurs (contacts sur place, Wi-Fi) : jamais sur le site.
