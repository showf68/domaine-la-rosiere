// Construit le site statique : docs/index.html (FR), docs/de/index.html (DE)
// et la maquette autonome docs/maquettes/2026-10-22_site/v3b.html (FR, CSS/JS en ligne).
// Usage : node tools/build.mjs
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = (p) => join(root, 'src', p);
const out = (p) => join(root, 'docs', p);
const tpl = readFileSync(src('index.template.html'), 'utf8');
const css = readFileSync(src('site.css'), 'utf8');
const js = readFileSync(src('site.js'), 'utf8');
const dicts = {
  fr: JSON.parse(readFileSync(src('i18n/fr.json'), 'utf8')),
  de: JSON.parse(readFileSync(src('i18n/de.json'), 'utf8')),
};

// Toute cle presente en FR doit exister en DE (et inversement)
const kf = Object.keys(dicts.fr), kd = Object.keys(dicts.de);
const missing = kf.filter((k) => !(k in dicts.de)).concat(kd.filter((k) => !(k in dicts.fr)));
if (missing.length) { console.error('Cles manquantes FR/DE :', missing.join(', ')); process.exit(1); }

function render(lang, { base, home, hrefFr, hrefDe, inline }) {
  const d = {
    ...dicts[lang],
    base, home,
    href_fr: hrefFr, href_de: hrefDe,
    cur_fr: lang === 'fr' ? 'aria-current="true"' : '',
    cur_de: lang === 'de' ? 'aria-current="true"' : '',
    css: inline ? `<style>\n${css}</style>` : `<link rel="stylesheet" href="${base}assets/site.css">`,
    js: inline ? `<script>\n${js}</script>` : `<script src="${base}assets/site.js" defer></script>`,
  };
  const html = tpl.replace(/\{\{(\w+)\}\}/g, (m, k) => {
    if (!(k in d)) throw new Error(`Cle inconnue {{${k}}}`);
    return d[k];
  });
  return html;
}

mkdirSync(out('de'), { recursive: true });
mkdirSync(out('assets'), { recursive: true });
writeFileSync(out('assets/site.css'), css);
writeFileSync(out('assets/site.js'), js);
writeFileSync(out('index.html'), render('fr', { base: '', home: './', hrefFr: './', hrefDe: 'de/' }));
writeFileSync(out('de/index.html'), render('de', { base: '../', home: './', hrefFr: '../', hrefDe: './' }));
mkdirSync(out('maquettes/2026-10-22_site'), { recursive: true });
writeFileSync(out('maquettes/2026-10-22_site/v3b.html'), render('fr', { base: '../../', home: '#', hrefFr: '#', hrefDe: '../../de/', inline: true }));
writeFileSync(out('.nojekyll'), '');
console.log('ok : docs/index.html, docs/de/index.html, maquette v3b');
