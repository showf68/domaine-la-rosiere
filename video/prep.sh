#!/bin/sh
# Prépare les médias de la vidéo (hors git, régénérables) : photos du site + séquences d'images des rushes.
# Les vidéos passent en IMAGES (une par image de la vidéo finale) : la page les affiche par setT(t),
# sans <video> (seek non déterministe, et le Chromium du conteneur pi3 n'a pas le H.264).
# Usage : sh prep.sh   (depuis video/)
set -e
cd "$(dirname "$0")"
mkdir -p media/img media/seq
cp ../docs/assets/img/*.webp media/img/
rm -f media/img/*-s.webp
seq() { # seq <nom> <rush> <debut_s> <duree_s> <filtre_vitesse>
  rm -rf "media/seq/$1"; mkdir -p "media/seq/$1"
  ffmpeg -v error -y -ss "$3" -t "$4" -i "rushes/$2" -vf "$5,scale=1920:1080:flags=lanczos" -q:v 3 "media/seq/$1/f%04d.jpg"
  echo "$1 : $(ls media/seq/$1 | wc -l) images"
}
# Drone (30 i/s) : champs dorés, façade qui monte au-dessus du toit, village au soleil couchant.
seq champs  drone-012.mp4 12 10 "fps=30"
seq facade  drone-012.mp4 0  10 "fps=30"
seq coucher drone-012.mp4 43 9  "fps=30"
# Piscine (60 i/s) : ralenti x0,5 = chaque image source devient une image de la vidéo (30 i/s).
seq piscine piscine-123.mp4 8.3 8 "setpts=2*PTS,fps=30"
