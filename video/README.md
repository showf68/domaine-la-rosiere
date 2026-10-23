# Vidéo de présentation — Domaine La Rosière

Vidéo publicitaire 16:9 (1920x1080, 30 i/s, 96,6 s), faite en code : `index.html` expose `setT(t)`, rendue image
par image par Chrome headless puis ffmpeg (méthode `videocreator` d'ICALL). Scénario : `SCENARIO.md`.

## Refaire la vidéo
1. `sh prep.sh` : copie les photos du site dans `media/img/` et découpe les rushes (`rushes/`, hors git) en images (`media/seq/`).
2. Musique : `music/universfield-cinematic-piano-and-strings-558290.mp3` (Pixabay, « Cinematic Piano and Strings »
   de Universfield, licence Pixabay : usage commercial sans attribution, ne pas redistribuer le fichier seul) →
   `mix.wav` normalisé −14 LUFS / −1,5 dBTP / 48 kHz (loudnorm 2 passes, fondu final 1,2 s).
3. Contrôle : `node <ICALL>/.claude/skills/videocreator/tools/render.mjs index.html --w=1920 --h=1080 --snap=0,20,45`.
4. Rendu final sur pi3 (jamais sur le PC) : `src/` = ce dossier (+ `mix.wav`, `media/`), conteneur `icalldev-video`,
   `sh /work/job.sh` → `out/full.mp4` (1080p) + `out/web.mp4` (720p).

## QR code
`qr.svg` → `https://showf68.github.io/domaine-la-rosiere/visite/`, page relais (`docs/visite/index.html`) qui renvoie
vers la maquette A4. Quand le site définitif aura son adresse, on modifie **la page relais**, pas la vidéo.

## Médias hors git
`rushes/` (originaux de l'album : drone 62 s, piscine 18 s), `media/`, `music/`, `mix.wav`, `_ctrl/`, `*.mp4`.
