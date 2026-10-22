#!/bin/bash
# shot.sh <url> <largeur> <hauteur> <fichier.png>
"/c/Program Files/Google/Chrome/Application/chrome.exe" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1 \
  --user-data-dir="$TEMP/rosiere-chrome-$2" --virtual-time-budget=6000 --window-size=$2,$3 --screenshot="$4" "$1" >/dev/null 2>&1
