# Domaine La Rosière — site du gîte

Site vitrine bilingue (français / allemand) du Domaine La Rosière, villa pour groupes jusqu'à 50 personnes
avec piscine intérieure chauffée, à Diemeringen (Alsace). Projet client isolé d'ICALL.

## Structure
- `src/index.template.html` : gabarit unique de la page ; `{{cle}}` = texte traduit.
- `src/i18n/fr.json`, `src/i18n/de.json` : tous les textes. Une clé ajoutée en FR doit exister en DE (le build refuse sinon).
- `src/site.css`, `src/site.js` : style et comportements (en-tête, arche, visionneuse, demande de séjour).
- `tools/build.mjs` : `node tools/build.mjs` produit `docs/index.html` (FR), `docs/de/index.html` (DE) et la maquette `docs/maquettes/2026-10-22_site/v1.html`.
- `tools/cdp-shot.mjs` : capture pleine page à vraie largeur (390 px) via Chrome headless ; rapporte débordement horizontal et erreurs console. (`--window-size` de Chrome headless ne descend pas sous 500 px.)
- `docs/` : ce qui est publié (GitHub Pages). `docs/assets/img/` : photos du propriétaire (album Google Photos), WebP 1920 px et 900 px (`-s`).
- `docs/maquettes/2026-10-22_site/` : les trois pistes de design, galerie `index.html`, choix argumenté `PICK.md`.

## État (22/10/2026)
- Version 1 en aperçu, `noindex` : le domaine `domainelarosiere.com` n'est pas touché (site actuel chez Goliday).
- **Demande de séjour** : sans serveur, le formulaire rédige la demande et ouvre la messagerie du visiteur vers
  le propriétaire. À remplacer par un envoi direct quand l'hébergement définitif sera choisi.
- **Calendrier synchronisé (import Abritel / export GrandsGites, iCal)** : exigé par le propriétaire, **pas encore construit**.
  Il demande un petit serveur (abonnement aux flux, stockage des blocages, flux sortant). Étape suivante.
- Tarifs volontairement absents : ils varient selon la saison et la durée ; à valider avec le propriétaire avant affichage.

## Sources du contenu
Descriptif 2026, livret d'accueil, carnet de sorties et logo envoyés par le propriétaire ; album photo partagé ;
site actuel `/fr`. Le livret contient des informations réservées aux voyageurs (contacts sur place, Wi-Fi) : jamais sur le site.
