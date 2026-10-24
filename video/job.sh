#!/bin/sh
# Tourne DANS le conteneur icalldev-video sur pi3 (/work = sources, /out = sorties, /box = dossier du projet).
# Vidéo Domaine La Rosière : 2 workers nice 19, flou de mouvement SUB=2, musique déjà normalisée (−14 LUFS, 48 kHz).
cd /work
python3 -m http.server 8777 --bind 127.0.0.1 >/dev/null 2>&1 &
sleep 3
N=$(python3 -c "import math;print(math.ceil(78*30))")
mkdir -p /out/fr
P=""
for i in 0 1; do
  URL="http://127.0.0.1:8777/index.html" nice -n 19 node render.js frames /out/fr $((N*i/2)) $((N*(i+1)/2)) 2 > /out/r_$i.log 2>&1 &
  P="$P $!"
done
wait $P
GOT=$(ls /out/fr | wc -l); echo "images rendues : $GOT, attendues : $((N*2))" > /out/count.log
touch /out/RENDER_DONE
cd /out
nice -n 19 ffmpeg -y -threads 2 -framerate 60 -i fr/f%06d.jpg -i /work/mix.wav -filter_complex "[0:v]tmix=frames=2,select=eq(mod(n\,2)\,1),setpts=N/30/TB[v]" -map "[v]" -map 1:a -r 30 -c:v libx264 -profile:v high -preset slow -crf 17 -pix_fmt yuv420p -c:a aac -b:a 256k -ar 48000 -movflags +faststart -shortest full.mp4 > asm.log 2>&1
touch /out/ASM_DONE
nice -n 19 ffmpeg -y -threads 2 -i full.mp4 -vf scale=1280:720 -c:v libx264 -preset slow -b:v 2500k -pass 1 -passlogfile /tmp/ros -an -f mp4 /dev/null > enc.log 2>&1
nice -n 19 ffmpeg -y -threads 2 -i full.mp4 -vf scale=1280:720 -c:v libx264 -preset slow -b:v 2500k -pass 2 -passlogfile /tmp/ros -pix_fmt yuv420p -c:a aac -b:a 160k -movflags +faststart web.mp4 >> enc.log 2>&1
rm -rf /out/fr
echo "FIN RC=$?" > /out/ALL_DONE
touch /box/DONE
