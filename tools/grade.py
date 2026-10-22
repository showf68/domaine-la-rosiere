# Etalonnage doux des photos du proprietaire (couleur seulement : aucun contenu ajoute ni retire).
# Usage : python -I tools/grade.py <dossier_source_jpg> <dossier_sortie>  (nom source -> nom cible via MAP)
import sys, os
from PIL import Image, ImageOps, ImageEnhance
import numpy as np

def trim_black(im, thr=18):
    # retire les bandes noires uniformes laissees par l'appareil sur les bords
    a = np.asarray(im.convert('L')).astype(np.float32)
    def edge(lines):
        n = 0
        for v in lines:
            if v.mean() < thr and v.std() < 10: n += 1
            else: break
        return n
    l = edge(a.T); r = edge(a.T[::-1]); t = edge(a); b = edge(a[::-1])
    if l + r + t + b == 0: return im
    w, h = im.size
    return im.crop((l + 2 if l else 0, t + 2 if t else 0, w - (r + 2 if r else 0), h - (b + 2 if b else 0)))

def grade(im, warm=1.0):
    im = trim_black(ImageOps.exif_transpose(im).convert('RGB'))
    a = np.asarray(im).astype(np.float32) / 255.0
    # 1) neutraliser la dominante (gray-world partiel) puis rechauffer legerement
    m = a.reshape(-1, 3).mean(0)
    g = m.mean()
    a = a * (1 + 0.6 * (g / np.maximum(m, 1e-3) - 1))
    a[..., 0] *= 1.0 + 0.035 * warm
    a[..., 1] *= 1.0 + 0.012 * warm
    a[..., 2] *= 1.0 - 0.045 * warm
    # 2) niveaux : noirs releves (rendu film), hautes lumieres protegees
    lo, hi = np.percentile(a, 0.4), np.percentile(a, 99.6)
    a = np.clip((a - lo) / max(hi - lo, 1e-3), 0, 1)
    a = 0.035 + a * 0.94
    # 3) courbe en S douce
    a = a + 0.10 * (a - 0.5) * (1 - np.abs(2 * a - 1))
    a = np.clip(a, 0, 1)
    out = Image.fromarray((a * 255 + 0.5).astype(np.uint8))
    out = ImageEnhance.Color(out).enhance(0.88)
    return out

if __name__ == '__main__':
    src, dst = sys.argv[1], sys.argv[2]
    names = sys.argv[3].split(',') if len(sys.argv) > 3 else None
    os.makedirs(dst, exist_ok=True)
    for f in sorted(os.listdir(src)):
        if not f.endswith('.jpg'): continue
        if names and f[:-4] not in names: continue
        im = grade(Image.open(os.path.join(src, f)))
        im.save(os.path.join(dst, f), quality=92)
    print('ok')
