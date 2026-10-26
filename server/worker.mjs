// Service du site Domaine La Rosière (Cloudflare Worker + D1).
//  GET  /disponibilites.json : nuits prises + saisons (lu par le calendrier du site)
//  GET  /calendrier.ics      : export iCal des séjours DIRECTS et des blocages manuels (à donner à Abritel/Airbnb)
//  POST /demande             : enregistre la demande, l'envoie par e-mail au propriétaire
//  GET  /payer?id=&t=        : paiement par carte (Stancer) de l'acompte 30 %, seulement après confirmation du propriétaire
//  GET  /admin               : espace du propriétaire (connexion par lien reçu par e-mail)
//  cron                      : relit le calendrier Goliday, les liens iCal importés, les paiements Stancer
// Les calendriers importés ne sont JAMAIS ré-exportés (sinon boucle entre plateformes).

const DAY = 864e5;
const addDays = (s, n) => new Date(Date.parse(s + 'T12:00:00Z') + n * DAY).toISOString().slice(0, 10);
const nightsBetween = (a, b) => Math.round((Date.parse(b + 'T12:00:00Z') - Date.parse(a + 'T12:00:00Z')) / DAY);
// date réelle seulement : Date.parse accepte « 2027-02-30 » (il en fait le 2 mars), d'où l'aller-retour
const isoOk = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s + 'T12:00:00Z')) && addDays(s, 0) === s;
const today = () => new Date().toISOString().slice(0, 10);
const h = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const oneLine = (s, n = 300) => String(s ?? '').replace(/[\r\n]+/g, ' ').trim().slice(0, n);
const eur = (v) => Number(v).toLocaleString('fr-FR') + ' €';
const frDate = (s) => new Date(s + 'T12:00:00Z').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

// Tarifs du site actuel (relevés le 26/10/2026) ; les saisons viennent du calendrier Goliday (cron).
export const TARIFS = { rate1: { n: 1200, w: 6750, x: 30, min: 2, label: 'Tarif 1' }, high: { n: 1300, w: 7600, x: 26, min: 4, label: 'Haute saison' }, very_high: { n: 1450, w: 10150, x: 26, min: 4, label: 'Très haute saison' } };
export const INCL = 20, DEPOSIT = 0.3, SHEETS = 10, TOWELS = 3;
export function tarifOf(iso, seasons) {
  for (const s of seasons || []) if (iso >= s.from && iso <= s.to && TARIFS[s.t]) return TARIFS[s.t];
  return TARIFS.rate1;
}
// Chaque nuit au tarif de SA saison (propriétaire, 26/10/2026) ; le prix semaine s'applique par tranche de 7 nuits
// d'une même saison ; le séjour minimum est celui de la saison du jour d'arrivée.
export function price(arrival, departure, people, sheets, towels, seasons) {
  const n = nightsBetween(arrival, departure), T = tarifOf(arrival, seasons), per = new Map();
  for (let i = 0; i < n; i++) { const t = tarifOf(addDays(arrival, i), seasons); per.set(t, (per.get(t) || 0) + 1); }
  let base = 0, extra = 0;
  for (const [t, k] of per) { base += Math.floor(k / 7) * t.w + (k % 7) * t.n; extra += Math.max(0, people - INCL) * t.x * k; }
  const opt = (sheets ? SHEETS * people : 0) + (towels ? TOWELS * people : 0);
  return { nights: n, base, extra, opt, total: base + extra + opt, min: T.min, label: [...per.keys()].map((t) => t.label).join(' + ') };
}

// Fusionne les periodes qui se chevauchent ou se touchent (une plateforme liste souvent une ligne par contrat).
export function merge(list) {
  const out = [];
  for (const b of [...list].sort((x, y) => (x.start < y.start ? -1 : 1))) {
    const l = out[out.length - 1];
    if (l && b.start <= l.end) { if (b.end > l.end) l.end = b.end; } else out.push({ start: b.start, end: b.end });
  }
  return out;
}

// Texte iCal -> [{start,end}] (DTEND exclusif, comme les plateformes)
export function parseIcs(txt) {
  const out = [];
  for (const ev of txt.replace(/\r?\n[ \t]/g, '').split('BEGIN:VEVENT').slice(1)) {
    const g = (k) => (ev.match(new RegExp('^' + k + '[^:\\n]*:(\\d{8})', 'm')) || [])[1];
    const a = g('DTSTART'), b = g('DTEND');
    if (!a) continue;
    const f = (x) => `${x.slice(0, 4)}-${x.slice(4, 6)}-${x.slice(6, 8)}`;
    const s = f(a);
    let e = b ? f(b) : addDays(s, 1);
    if (e <= s) e = addDays(s, 1);
    out.push({ start: s, end: e });
  }
  return out;
}

// Page Goliday -> { booked:[{start,end}], seasons:[{from,to,t}] }. Goliday note la DERNIÈRE nuit (incluse) :
// vérifié le 26/10/2026 sur le calendrier affiché (réservation du 06 au 08/11 = 6, 7 et 8 grisés, le 9 libre).
export function parseGoliday(html) {
  const i = html.indexOf('var tariffs_marking=');
  if (i < 0) return null;
  const st = html.indexOf('[', i);
  let d = 0, j = st;
  for (; j < html.length; j++) { if (html[j] === '[') d++; else if (html[j] === ']' && --d === 0) break; }
  const arr = JSON.parse(html.slice(st, j + 1));
  const booked = [], seasons = [];
  for (const a of arr) {
    const s = a.calendar_startDate, e = a.calendar_endDate;
    if (!isoOk(s) || !isoOk(e)) continue;
    if (a.propertyAvailable === '1') {
      const t = String(a.css_class || '').replace(/_bg$/, '');
      if (t !== 'rate1' && TARIFS[t]) seasons.push({ from: s, to: e, t });
    } else if (nightsBetween(s, e) < 3650) booked.push({ start: s, end: addDays(e, 1) }); // l'entrée 2024-2044 (20 ans) n'est pas affichée par Goliday
  }
  return { booked: merge(booked), seasons };
}

async function hmac(env, msg) {
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(env.SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const b = await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(msg));
  return [...new Uint8Array(b)].slice(0, 16).map((x) => x.toString(16).padStart(2, '0')).join('');
}
const eq = (a, b) => typeof a === 'string' && a.length === b.length && [...a].reduce((r, c, i) => r | (c.charCodeAt(0) ^ b.charCodeAt(i)), 0) === 0;

// E-mail au propriétaire : relais ICALL (Mailgun rosiere@i-call.me, jamais y68), destinataire fixé côté serveur.
async function mailOwner(env, subject, body, replyTo) {
  const r = await fetch(env.MAIL_RELAY_URL, { method: 'POST', headers: { 'content-type': 'application/json', 'x-rosiere-key': env.MAIL_KEY }, body: JSON.stringify({ subject, body, replyTo: replyTo || '' }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.ok) throw new Error('relais e-mail : ' + r.status + ' ' + (j.error || ''));
}

async function setting(env, k, def = null) { const r = await env.DB.prepare('SELECT v FROM settings WHERE k=?').bind(k).first(); return r ? JSON.parse(r.v) : def; }
async function setSetting(env, k, v) { await env.DB.prepare('INSERT INTO settings (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v=excluded.v').bind(k, JSON.stringify(v)).run(); }
async function booked(env) { return (await env.DB.prepare('SELECT start, end FROM blocks WHERE end >= ? ORDER BY start').bind(addDays(today(), -1)).all()).results; }
const clash = (list, a, b) => list.some((x) => x.start < b && x.end > a);
// Bloque des dates SEULEMENT si elles sont encore libres, en une seule instruction (pas de course entre lecture et écriture).
async function blockIfFree(env, ref, a, b) {
  const r = await env.DB.prepare("INSERT OR IGNORE INTO blocks (source, ref, start, end) SELECT 'direct', ?, ?, ? WHERE NOT EXISTS (SELECT 1 FROM blocks WHERE start < ? AND end > ? AND NOT (source='direct' AND ref=?))")
    .bind(ref, a, b, b, a, ref).run();
  return r.meta.changes > 0 || !!(await env.DB.prepare("SELECT 1 FROM blocks WHERE source='direct' AND ref=?").bind(ref).first());
}
// Nom stable d'une source iCal, tiré de son lien (pas de sa position dans la liste)
async function sourceName(url) {
  const b = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(url)));
  return (/abritel|vrbo|homeaway/i.test(url) ? 'abritel' : /airbnb/i.test(url) ? 'airbnb' : 'cal') + '-' + [...b.slice(0, 3)].map((x) => x.toString(16).padStart(2, '0')).join('');
}

const CORS = (env) => ({ 'access-control-allow-origin': env.SITE_ORIGIN || '*', 'access-control-allow-headers': 'content-type', 'access-control-allow-methods': 'GET, POST, OPTIONS' });
const json = (env, o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...CORS(env) } });

async function stancer(env, key, method, path, body) {
  const r = await fetch('https://api.stancer.com/v2/' + path, { method, headers: { authorization: 'Basic ' + btoa(key + ':'), 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error('Stancer ' + r.status + ' ' + JSON.stringify(j).slice(0, 200));
  return j;
}

// ---------- espace du propriétaire ----------
const SESSION_DAYS = 30;
async function sessionOk(env, req) {
  const c = (req.headers.get('cookie') || '').match(/(?:^|; )rs=([a-f0-9]+\.\d+)/);
  if (!c) return false;
  const [sig, exp] = c[1].split('.');
  return Number(exp) > Date.now() && eq(sig, await hmac(env, 'session' + exp));
}
const page = (title, body) => new Response(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>${h(title)}</title><style>
:root{--ink:#22211d;--soft:#67625a;--green:#22382c;--line:rgba(34,33,29,.15);--paper:#fbf9f4;--sand:#ece6da}
body{margin:0;background:#f4f0e8;color:var(--ink);font:16px/1.5 system-ui,sans-serif}main{max-width:1000px;margin:0 auto;padding:24px 16px 60px}
h1{font:400 1.8rem Georgia,serif;margin:0 0 4px}h2{font:400 1.3rem Georgia,serif;margin:32px 0 10px;padding-top:16px;border-top:1px solid var(--line)}
.muted{color:var(--soft);font-size:.9rem}table{width:100%;border-collapse:collapse;font-size:.9rem;background:#fff}th,td{text-align:left;padding:8px;border-bottom:1px solid var(--line);vertical-align:top}th{font-size:.75rem;text-transform:uppercase;letter-spacing:.06em;color:var(--soft)}
button,.btn{font:500 .9rem system-ui;padding:9px 14px;border:1px solid var(--green);background:var(--green);color:#fff;cursor:pointer;text-decoration:none;display:inline-block;margin:2px 0}
.ghost{background:#fff;color:var(--green)}input,textarea{font:inherit;padding:8px;border:1px solid var(--line);width:100%;box-sizing:border-box;background:#fff}textarea{min-height:80px}
.row{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px;align-items:end}label span{display:block;font-size:.8rem;color:var(--soft)}
.tag{display:inline-block;font-size:.75rem;padding:2px 7px;border:1px solid var(--line);background:var(--sand)}.ok{background:#d9e5dc}.no{background:#f2dcd9}
.card{background:#fff;border:1px solid var(--line);padding:16px;margin:8px 0}code{background:var(--sand);padding:2px 6px;word-break:break-all}
@media (max-width:700px){table,thead,tbody,tr,td,th{display:block}thead{display:none}tr{border-bottom:2px solid var(--line);padding:6px 0}td{border:0;padding:3px 8px}}
</style></head><body><main>${body}</main></body></html>`, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });

const STATUS = { nouvelle: ['Nouvelle', ''], confirmee: ['Confirmée', 'ok'], refusee: ['Refusée', 'no'], acompte: ['Acompte payé', 'ok'] };

async function adminPage(env, origin, msg) {
  const reqs = (await env.DB.prepare('SELECT * FROM requests WHERE departure >= ? ORDER BY arrival LIMIT 200').bind(addDays(today(), -30)).all()).results;
  const blocks = (await env.DB.prepare("SELECT id, source, start, end FROM blocks WHERE end >= ? ORDER BY start").bind(today()).all()).results;
  const imports = await setting(env, 'ical_imports', []);
  const sync = await setting(env, 'last_sync', {});
  const iban = await setting(env, 'iban', '');
  const hasStancer = !!(await setting(env, 'stancer_key', ''));
  const rows = (await Promise.all(reqs.map(async (r) => {
    const st = STATUS[r.status] || [r.status, ''];
    const dep = Math.round(r.estimate * DEPOSIT);
    const payLink = hasStancer ? `${origin}/payer?id=${r.id}&t=${await hmac(env, 'client' + r.id)}` : '';
    const mail = `mailto:${encodeURIComponent(r.email)}?subject=${encodeURIComponent('Votre séjour au Domaine La Rosière du ' + frDate(r.arrival) + ' au ' + frDate(r.departure))}&body=${encodeURIComponent(r.status === 'confirmee' || r.status === 'acompte'
      ? `Bonjour ${r.name},\n\nVotre séjour du ${frDate(r.arrival)} au ${frDate(r.departure)} pour ${r.people} personnes est confirmé, les dates vous sont réservées.\n\nMontant du séjour : ${eur(r.estimate)}\nAcompte de 30 % : ${eur(dep)}${iban ? `\nPar virement : IBAN ${iban}, référence RS-${r.id}` : ''}${payLink ? `\nPar carte bancaire : ${payLink}` : ''}\n\nBien cordialement,\nDomaine La Rosière\n07 71 71 20 15`
      : `Bonjour ${r.name},\n\nMerci pour votre demande du ${frDate(r.arrival)} au ${frDate(r.departure)} pour ${r.people} personnes.\n\n\n\nBien cordialement,\nDomaine La Rosière\n07 71 71 20 15`)}`;
    return `<tr><td><b>${h(frDate(r.arrival))}</b><br>→ ${h(frDate(r.departure))}<br><span class="muted">${r.nights} nuits · ${r.people} pers.</span></td>
<td>${h(r.name)}<br><a href="tel:${h(r.phone)}">${h(r.phone)}</a><br><a href="mailto:${h(r.email)}">${h(r.email)}</a></td>
<td>${h(r.kind)}${r.sheets ? '<br>draps' : ''}${r.towels ? '<br>serviettes' : ''}${r.message ? `<br><span class="muted">${h(r.message)}</span>` : ''}</td>
<td>${eur(r.estimate)}<br><span class="muted">acompte ${eur(dep)}</span></td>
<td><span class="tag ${st[1]}">${st[0]}</span>${r.paid_at ? `<br><span class="muted">payé le ${h(r.paid_at.slice(0, 10))}</span>` : ''}${r.mail_error ? '<br><span class="tag no">' + (r.mail_error === 'paiement à vérifier' ? 'paiement à vérifier' : 'e-mail non parti') + '</span>' : ''}</td>
<td>${r.status === 'nouvelle' ? `<form method="post" action="/admin/action"><input type="hidden" name="id" value="${r.id}"><button name="do" value="confirmer">Confirmer</button> <button class="ghost" name="do" value="refuser">Refuser</button></form>` : ''}
<a class="btn ghost" href="${mail}">${r.status === 'confirmee' ? 'Envoyer la confirmation et l’acompte' : 'Répondre'}</a></td></tr>`;
  }))).join('');
  const SRC = { direct: 'Réservation directe', manuel: 'Blocage manuel', goliday: 'Goliday (site actuel)' };
  const brows = blocks.map((b) => `<tr><td>${h(frDate(b.start))} → ${h(frDate(b.end))}</td><td>${h(SRC[b.source] || b.source.replace(/^ical:/, 'iCal '))}</td><td>${b.source === 'manuel' || b.source === 'direct' ? `<form method="post" action="/admin/action"><input type="hidden" name="bid" value="${b.id}"><button class="ghost" name="do" value="debloquer">Libérer</button></form>` : ''}</td></tr>`).join('');
  const syncTxt = Object.entries(sync).map(([k, v]) => `<li>${h(k)} : ${h(v)}</li>`).join('');
  return page('Domaine La Rosière — gestion', `<h1>Domaine La Rosière</h1><p class="muted">Espace du propriétaire${msg ? ' · <b>' + h(msg) + '</b>' : ''}</p>
<h2>Demandes</h2>${rows ? `<table><thead><tr><th>Dates</th><th>Contact</th><th>Séjour</th><th>Montant</th><th>État</th><th></th></tr></thead><tbody>${rows}</tbody></table>` : '<p class="muted">Aucune demande pour l’instant.</p>'}
<p class="muted">« Confirmer » bloque les dates sur le site et dans l’export vers Abritel / Airbnb. Ensuite, « Envoyer la confirmation et l’acompte » ouvre un e-mail prêt à envoyer au client, avec le montant, l’IBAN et le lien de paiement par carte. Le client ne peut payer qu’une demande que vous avez confirmée.</p>
<p><a class="btn ghost" href="/admin/contacts.csv">Télécharger le fichier des contacts</a> <span class="muted">(tous les clients et demandes, avec leur accord ou non pour recevoir vos offres par e-mail)</span></p>
<h2>Calendrier : dates bloquées</h2><form method="post" action="/admin/action" class="row"><label><span>Première nuit</span><input type="date" name="start" required></label><label><span>Jour de départ</span><input type="date" name="end" required></label><button name="do" value="bloquer">Bloquer ces dates</button></form>
<table><thead><tr><th>Période</th><th>Origine</th><th></th></tr></thead><tbody>${brows || '<tr><td colspan="3" class="muted">Aucune date bloquée.</td></tr>'}</tbody></table>
<h2>Synchronisation Abritel / Airbnb</h2>
<div class="card"><b>Exporter</b> mon calendrier vers Abritel ou Airbnb : coller ce lien dans « Importer un calendrier » de la plateforme.<br><code>${h(origin)}/calendrier.ics</code></div>
<form method="post" action="/admin/action" class="card"><b>Importer</b> les calendriers d’Abritel / Airbnb : un lien iCal par ligne (dans Abritel : Calendrier → Synchronisation → Exporter ; dans Airbnb : Calendrier → Disponibilités → Exporter le calendrier).<textarea name="imports" placeholder="https://www.abritel.fr/icalendar/...ics">${h(imports.map((x) => x.url).join('\n'))}</textarea><button name="do" value="imports">Enregistrer et synchroniser</button></form>
<p class="muted">Synchronisation automatique toutes les 30 minutes.</p><ul class="muted">${syncTxt}</ul>
<form method="post" action="/admin/action" class="card"><b>Avant d’arrêter Goliday</b> : reprendre ses réservations à venir comme blocages, pour qu’elles restent sur le site et partent vers Abritel / Airbnb.<br><button class="ghost" name="do" value="reprendre_goliday">Reprendre les réservations Goliday</button></form>
<h2>Paiement de l’acompte</h2>
<form method="post" action="/admin/action" class="card"><label><span>IBAN pour les virements (mis dans l’e-mail de confirmation au client)</span><input name="iban" value="${h(iban)}" placeholder="FR76 ..."></label>
<label><span>Clé secrète Stancer (paiement par carte) ${hasStancer ? '— <b>enregistrée</b>, laisser vide pour la garder' : ''}</span><input name="stancer" placeholder="sprod_..." autocomplete="off"></label><button name="do" value="paiement">Enregistrer</button></form>`);
}

async function adminAction(env, form, origin) {
  const d = form.get('do');
  if (d === 'confirmer' || d === 'refuser') {
    const id = Number(form.get('id'));
    const r = await env.DB.prepare('SELECT * FROM requests WHERE id=?').bind(id).first();
    if (!r) return 'Demande introuvable.';
    if (r.paid_at) return 'Acompte déjà payé : rien à changer ici (remboursement éventuel dans Stancer).';
    if (d === 'refuser') {
      await env.DB.batch([env.DB.prepare("UPDATE requests SET status='refusee' WHERE id=?").bind(id), env.DB.prepare("DELETE FROM blocks WHERE source='direct' AND ref=?").bind('req' + id)]);
      return 'Demande refusée.';
    }
    if (!(await blockIfFree(env, 'req' + id, r.arrival, r.departure))) return 'Impossible : ces dates sont déjà prises.';
    await env.DB.prepare("UPDATE requests SET status='confirmee' WHERE id=?").bind(id).run();
    return 'Séjour confirmé, dates bloquées. Envoyez maintenant la confirmation au client.';
  }
  if (d === 'reprendre_goliday') {
    // à faire juste avant d'arrêter Goliday : ses réservations deviennent des blocages manuels, donc exportés vers Abritel / Airbnb
    const n = (await env.DB.prepare("INSERT OR IGNORE INTO blocks (source, ref, start, end) SELECT 'manuel', 'goliday:' || start || '/' || end, start, end FROM blocks WHERE source='goliday' AND end >= ?").bind(today()).run()).meta.changes;
    return `${n} réservations Goliday reprises en blocages (exportés vers Abritel / Airbnb).`;
  }
  if (d === 'bloquer') {
    const s = form.get('start'), e = form.get('end');
    if (!isoOk(s) || !isoOk(e) || e <= s) return 'Dates invalides.';
    await env.DB.prepare("INSERT INTO blocks (source, ref, start, end) VALUES ('manuel', ?, ?, ?)").bind(crypto.randomUUID(), s, e).run();
    return 'Dates bloquées.';
  }
  if (d === 'debloquer') {
    const b = await env.DB.prepare('SELECT source, ref FROM blocks WHERE id=?').bind(Number(form.get('bid'))).first();
    if (!b || !['manuel', 'direct'].includes(b.source)) return 'Rien à libérer.';
    if (b.source === 'direct' && (await env.DB.prepare('SELECT paid_at FROM requests WHERE id=?').bind(Number(b.ref.slice(3))).first())?.paid_at)
      return 'Acompte payé pour ce séjour : les dates restent bloquées (annulation et remboursement d’abord).';
    await env.DB.prepare('DELETE FROM blocks WHERE id=?').bind(Number(form.get('bid'))).run();
    if (b.source === 'direct') await env.DB.prepare("UPDATE requests SET status='nouvelle' WHERE id=?").bind(Number(b.ref.slice(3))).run();
    return 'Dates libérées.';
  }
  if (d === 'imports') {
    const urls = String(form.get('imports') || '').split(/\s+/).filter((u) => /^https:\/\/\S+$/.test(u)).slice(0, 10);
    await setSetting(env, 'ical_imports', await Promise.all([...new Set(urls)].map(async (url) => ({ name: await sourceName(url), url }))));
    await syncAll(env);
    return 'Liens enregistrés, synchronisation faite.';
  }
  if (d === 'paiement') {
    await setSetting(env, 'iban', oneLine(form.get('iban'), 60));
    const k = oneLine(form.get('stancer'), 120);
    if (k) {
      if (!/^s(prod|test)_\w+$/.test(k)) return 'Clé Stancer invalide (elle commence par sprod_ ou stest_).';
      try { await stancer(env, k, 'GET', 'ping'); } catch (e) { return 'Stancer refuse cette clé.'; }
      await setSetting(env, 'stancer_key', k);
    }
    return 'Paiement enregistré.';
  }
  return '';
}

// ---------- synchronisation ----------
async function syncAll(env) {
  const sync = await setting(env, 'last_sync', {});
  const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ') + ' UTC';
  const replace = async (source, list) => {
    const st = [env.DB.prepare('DELETE FROM blocks WHERE source=?').bind(source)];
    for (const e of list) st.push(env.DB.prepare('INSERT OR IGNORE INTO blocks (source, ref, start, end) VALUES (?,?,?,?)').bind(source, e.start + '/' + e.end, e.start, e.end));
    await env.DB.batch(st);
  };
  if (env.GOLIDAY_URL) {
    try {
      const r = await fetch(env.GOLIDAY_URL, { headers: { 'user-agent': 'Mozilla/5.0 (rosiere-sync)' }, signal: AbortSignal.timeout(15000) });
      const g = r.ok ? parseGoliday(await r.text()) : null;
      if (g && g.booked.length) { await replace('goliday', g.booked); await setSetting(env, 'seasons', g.seasons); sync['Goliday'] = `${stamp}, ${g.booked.length} périodes`; }
      else sync['Goliday'] = `${stamp}, lecture impossible (rien n’a été effacé)`;
    } catch { sync['Goliday'] = `${stamp}, injoignable (rien n’a été effacé)`; }
  }
  const imports = await setting(env, 'ical_imports', []);
  const keep = new Set(imports.map((x) => 'ical:' + x.name));
  for (const old of (await env.DB.prepare("SELECT DISTINCT source FROM blocks WHERE source LIKE 'ical:%'").all()).results) if (!keep.has(old.source)) await env.DB.prepare('DELETE FROM blocks WHERE source=?').bind(old.source).run();
  for (const k of Object.keys(sync)) if (k.startsWith('iCal ') && !imports.some((x) => 'iCal ' + x.name === k)) delete sync[k];
  for (const x of imports) {
    try {
      const r = await fetch(x.url, { signal: AbortSignal.timeout(15000) });
      const txt = r.ok ? await r.text() : '';
      // un document tronqué n'efface rien
      if (!txt.includes('BEGIN:VCALENDAR') || !txt.includes('END:VCALENDAR')) { sync['iCal ' + x.name] = `${stamp}, lien illisible (rien n’a été effacé)`; continue; }
      const evs = merge(parseIcs(txt)); await replace('ical:' + x.name, evs); sync['iCal ' + x.name] = `${stamp}, ${evs.length} périodes`;
    } catch { sync['iCal ' + x.name] = `${stamp}, injoignable (rien n’a été effacé)`; }
  }
  await setSetting(env, 'last_sync', sync);
  await setSetting(env, 'last_sync_at', Date.now());
  // e-mails de demande qui n'étaient pas partis : nouvel essai
  for (const r of (await env.DB.prepare("SELECT id, mail_subject, mail_body, email FROM requests WHERE mail_error LIKE 'relais%' AND mail_body IS NOT NULL AND created > datetime('now','-3 days')").all()).results) {
    try { await mailOwner(env, r.mail_subject, r.mail_body, r.email); await env.DB.prepare('UPDATE requests SET mail_error=NULL WHERE id=?').bind(r.id).run(); } catch {}
  }
  // acomptes Stancer en attente (seules les demandes confirmées peuvent être payées ; un intent impayé n'expire pas)
  const key = await setting(env, 'stancer_key', '');
  if (key) for (const r of (await env.DB.prepare("SELECT id, pi_id FROM requests WHERE pi_id IS NOT NULL AND paid_at IS NULL AND departure >= ?").bind(today()).all()).results) await checkPaid(env, key, r.id, r.pi_id);
}

async function checkPaid(env, key, id, piId) {
  const pi = await stancer(env, key, 'GET', 'payment_intents/' + piId).catch(() => null);
  const payId = pi && (typeof pi.payment === 'string' ? pi.payment : pi.payment?.id);
  if (!payId) return false;
  const p = await stancer(env, key, 'GET', 'payments/' + payId).catch(() => null);
  // « authorized » = carte autorisée mais pas encore débitée : on attend que la capture soit engagée
  if (!p || !['captured', 'to_capture', 'capture_sent'].includes(p.status)) return false;
  const r = await env.DB.prepare('SELECT * FROM requests WHERE id=?').bind(id).first();
  if (!r || r.paid_at) return true;
  const expected = Math.round(r.estimate * DEPOSIT) * 100;
  if (p.amount !== expected || String(p.currency).toLowerCase() !== 'eur' || r.status !== 'confirmee') {
    await env.DB.prepare('UPDATE requests SET paid_at=datetime(\'now\'), mail_error=? WHERE id=?').bind('paiement à vérifier', id).run();
    await mailOwner(env, `Paiement à vérifier : ${r.name}`, `Un paiement par carte de ${eur(p.amount / 100)} (${p.currency}) est arrivé pour la demande de ${r.name} du ${frDate(r.arrival)} au ${frDate(r.departure)}, mais il ne correspond pas à l'acompte attendu (${eur(expected / 100)}) ou la demande n'est pas confirmée (état : ${r.status}).\nRien n'a été bloqué automatiquement : vérifiez dans Stancer.\n\nTéléphone : ${r.phone}\nE-mail : ${r.email}`, r.email).catch(() => {});
    return true;
  }
  await env.DB.prepare("UPDATE requests SET status='acompte', paid_at=datetime('now') WHERE id=?").bind(id).run();
  await mailOwner(env, `Acompte payé : ${r.name}, du ${frDate(r.arrival)} au ${frDate(r.departure)}`,
    `${r.name} a payé l'acompte de ${eur(p.amount / 100)} par carte (Stancer).\nLes dates du ${frDate(r.arrival)} au ${frDate(r.departure)} sont réservées sur le site et dans l'export vers Abritel / Airbnb.\n\nTéléphone : ${r.phone}\nE-mail : ${r.email}`, r.email).catch(() => {});
  return true;
}

export default {
  async fetch(req, env, ctx) {
    const u = new URL(req.url), origin = u.origin, path = u.pathname;
    if (req.method === 'OPTIONS') return new Response(null, { headers: CORS(env) });

    if (path === '/disponibilites.json') {
      // filet si le cron tarde : resynchronise en arriere-plan quand la derniere lecture date de plus d'une heure
      if (Date.now() - (await setting(env, 'last_sync_at', 0)) > 3600e3) { await setSetting(env, 'last_sync_at', Date.now()); ctx.waitUntil(syncAll(env)); }
      return json(env, { booked: await booked(env), seasons: await setting(env, 'seasons', []) });
    }

    if (path === '/calendrier.ics') {
      const { results } = await env.DB.prepare("SELECT id, source, start, end FROM blocks WHERE source IN ('direct','manuel') AND end >= ?").bind(addDays(today(), -60)).all();
      const d = (s) => s.replaceAll('-', '');
      const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z';
      const ev = results.map((r) => `BEGIN:VEVENT\r\nUID:${r.source}-${r.id}@domainelarosiere.com\r\nDTSTAMP:${stamp}\r\nDTSTART;VALUE=DATE:${d(r.start)}\r\nDTEND;VALUE=DATE:${d(r.end)}\r\nSUMMARY:Réservé\r\nEND:VEVENT\r\n`).join('');
      return new Response(`BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Domaine La Rosiere//FR\r\nCALSCALE:GREGORIAN\r\nX-WR-CALNAME:Domaine La Rosière\r\n${ev}END:VCALENDAR\r\n`, { headers: { 'content-type': 'text/calendar; charset=utf-8', 'cache-control': 'max-age=600' } });
    }

    if (path === '/demande' && req.method === 'POST') {
      let d; try { d = await req.json(); } catch { return json(env, { ok: false, error: 'format' }, 400); }
      if (!d || typeof d !== 'object') return json(env, { ok: false, error: 'format' }, 400);
      const p = Number(d.people), email = oneLine(d.email, 160);
      if (!isoOk(d.arrival) || !isoOk(d.departure) || d.departure <= d.arrival || d.arrival < today() || d.arrival > addDays(today(), 3 * 366)
        || !Number.isInteger(p) || p < 1 || p > 50 || nightsBetween(d.arrival, d.departure) > 60
        || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || String(d.phone || '').replace(/\D/g, '').length < 8 || !oneLine(d.name) || String(d.message || '').trim().length < 3)
        return json(env, { ok: false, error: 'invalide' }, 422);
      if (clash(await booked(env), d.arrival, d.departure)) return json(env, { ok: false, error: 'dates_prises' }, 409);
      const seasons = await setting(env, 'seasons', []);
      const q = price(d.arrival, d.departure, p, !!d.sheets, !!d.towels, seasons);
      if (q.nights < q.min) return json(env, { ok: false, error: 'sejour_minimum', min: q.min }, 422);
      // anti-abus : 5 demandes par heure et par adresse e-mail, 10 par heure et par connexion
      const ip = req.headers.get('cf-connecting-ip') || '';
      const recent = await env.DB.prepare("SELECT SUM(email=?) e, SUM(ip=?) i FROM requests WHERE created > datetime('now','-1 hour')").bind(email, ip).first();
      if ((recent.e || 0) >= 5 || (ip && (recent.i || 0) >= 10)) return json(env, { ok: false, error: 'trop' }, 429);
      const subject = `Demande de séjour : ${oneLine(d.name, 60)}, du ${frDate(d.arrival)} au ${frDate(d.departure)}`;
      const body = `Nouvelle demande depuis le site.\n\nArrivée : ${frDate(d.arrival)}\nDépart : ${frDate(d.departure)} (${q.nights} nuits)\nPersonnes : ${p}\nOccasion : ${oneLine(d.type, 40)}\nDraps : ${d.sheets ? 'oui' : 'non'} · Serviettes : ${d.towels ? 'oui' : 'non'}\nAccepte de recevoir vos offres : ${d.offers === true ? 'oui' : 'non'}\nMontant calculé : ${eur(q.total)} (${q.label}), acompte 30 % : ${eur(Math.round(q.total * DEPOSIT))}\n\nNom : ${oneLine(d.name, 120)}\nTéléphone : ${oneLine(d.phone, 40)}\nE-mail : ${email}\n\nMessage :\n${String(d.message).slice(0, 3000)}\n\nPour répondre au client : répondez simplement à cet e-mail.\nPour confirmer et bloquer les dates : ${origin}/admin`;
      const r = await env.DB.prepare("INSERT INTO requests (arrival, departure, nights, people, kind, name, email, phone, sheets, towels, message, estimate, status, created, ip, mail_subject, mail_body, offers) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,'nouvelle',datetime('now'),?,?,?,?)")
        .bind(d.arrival, d.departure, q.nights, p, oneLine(d.type, 40), oneLine(d.name, 120), email, oneLine(d.phone, 40), d.sheets ? 1 : 0, d.towels ? 1 : 0, String(d.message).slice(0, 3000), q.total, ip, subject, body, d.offers === true ? 1 : 0).run();
      const id = r.meta.last_row_id;
      try { await mailOwner(env, subject, body, email); }
      catch (e) { await env.DB.prepare('UPDATE requests SET mail_error=? WHERE id=?').bind(String(e.message).slice(0, 300), id).run(); } // le cron réessaie
      return json(env, { ok: true, total: q.total, deposit: Math.round(q.total * DEPOSIT) });
    }

    // Paiement de l'acompte : lien envoyé par le propriétaire APRÈS confirmation (jeton signé obligatoire).
    if (path === '/payer') {
      const id = Number(u.searchParams.get('id')), t = u.searchParams.get('t') || '';
      const stop = (msg) => page('Paiement', `<h1>${msg}</h1><p>Contactez le Domaine La Rosière : <a href="tel:+33771712015">07 71 71 20 15</a>.</p>`);
      if (!Number.isInteger(id) || !eq(t, await hmac(env, 'client' + id))) return stop('Lien de paiement invalide');
      const key = await setting(env, 'stancer_key', '');
      const r = await env.DB.prepare('SELECT * FROM requests WHERE id=?').bind(id).first();
      if (r && r.paid_at) return stop('Acompte déjà reçu, merci');
      if (!key || !r || r.status !== 'confirmee') return stop('Paiement indisponible');
      // un seul paiement par demande : on reprend celui déjà ouvert s'il n'est pas réglé
      if (r.pi_id) {
        const old = await stancer(env, key, 'GET', 'payment_intents/' + r.pi_id).catch(() => null);
        if (old && old.url && !old.payment && !['canceled', 'unpaid'].includes(old.status)) return Response.redirect(old.url, 303);
        if (old && old.payment) return stop('Paiement en cours de vérification');
      }
      const back = (env.SITE_URL || 'https://showf68.github.io/domaine-la-rosiere/') + `?acompte=${id}&t=${t}#demande`;
      const pi = await stancer(env, key, 'POST', 'payment_intents/', { amount: Math.round(r.estimate * DEPOSIT) * 100, currency: 'eur', methods_allowed: ['card'], description: `Acompte séjour RS-${id}`, return_url: back, metadata: { request: String(id) } });
      await env.DB.prepare('UPDATE requests SET pi_id=? WHERE id=?').bind(pi.id, id).run();
      return Response.redirect(pi.url, 303);
    }

    if (path === '/acompte/etat') {
      const id = Number(u.searchParams.get('id'));
      if (!Number.isInteger(id) || !eq(u.searchParams.get('t') || '', await hmac(env, 'client' + id))) return json(env, { paid: false }, 403);
      const r = await env.DB.prepare('SELECT pi_id, paid_at FROM requests WHERE id=?').bind(id).first();
      if (!r) return json(env, { paid: false });
      if (!r.paid_at && r.pi_id) { const key = await setting(env, 'stancer_key', ''); if (key) return json(env, { paid: await checkPaid(env, key, id, r.pi_id) }); }
      return json(env, { paid: !!r.paid_at });
    }

    // ----- espace du propriétaire -----
    if (path === '/admin' || path.startsWith('/admin/')) {
      if (path === '/admin/lien' && req.method === 'POST') {
        const last = await setting(env, 'last_login_mail', 0);
        if (Date.now() - last > 60e3) {
          await setSetting(env, 'last_login_mail', Date.now());
          const exp = Date.now() + 30 * 60e3;
          await mailOwner(env, 'Connexion à la gestion du site', `Pour ouvrir l'espace de gestion du Domaine La Rosière, cliquez sur ce lien (valable 30 minutes) :\n\n${origin}/admin/entrer?e=${exp}&t=${await hmac(env, 'login' + exp)}\n\nSi vous n'avez rien demandé, ignorez ce message.`);
        }
        return page('Connexion', '<h1>Lien envoyé</h1><p>Un lien de connexion vient d’être envoyé à l’adresse e-mail du domaine. Ouvrez-le sur cet appareil.</p>');
      }
      if (path === '/admin/entrer') {
        const e = u.searchParams.get('e') || '';
        if (!(Number(e) > Date.now()) || !eq(u.searchParams.get('t') || '', await hmac(env, 'login' + e))) return page('Connexion', '<h1>Lien expiré</h1><p><a href="/admin">Recevoir un nouveau lien</a></p>');
        const exp = Date.now() + SESSION_DAYS * DAY;
        return new Response(null, { status: 303, headers: { location: '/admin', 'set-cookie': `rs=${await hmac(env, 'session' + exp)}.${exp}; Path=/; Max-Age=${SESSION_DAYS * 86400}; HttpOnly; Secure; SameSite=Lax` } });
      }
      if (!(await sessionOk(env, req))) return page('Connexion', `<h1>Domaine La Rosière</h1><p>Espace de gestion du propriétaire.</p><form method="post" action="/admin/lien"><button>Recevoir le lien de connexion par e-mail</button></form><p class="muted">Le lien arrive sur l’adresse e-mail du domaine.</p>`);
      if (path === '/admin/contacts.csv') {
        // fichier de TOUS les contacts (le propriétaire les garde, 26/10/2026) ; « accepte les offres » = accord pour recevoir ses offres par e-mail
        const rows = (await env.DB.prepare('SELECT created, name, email, phone, kind, arrival, departure, people, status, offers FROM requests ORDER BY created').all()).results;
        const c = (v) => '"' + String(v ?? '').replace(/"/g, '""') + '"';
        const csv = '\ufeff' + ['date demande;nom;e-mail;téléphone;occasion;arrivée;départ;personnes;état;accepte les offres']
          .concat(rows.map((r) => [r.created, r.name, r.email, r.phone, r.kind, r.arrival, r.departure, r.people, (STATUS[r.status] || [r.status])[0], r.offers ? 'oui' : 'non'].map(c).join(';'))).join('\r\n');
        return new Response(csv, { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': 'attachment; filename="contacts-la-rosiere.csv"', 'cache-control': 'no-store' } });
      }
      if (path === '/admin/action' && req.method === 'POST') {
        if (req.headers.get('origin') !== origin) return new Response('Origine refusée', { status: 403 }); // CSRF
        const msg = await adminAction(env, await req.formData(), origin);
        return new Response(null, { status: 303, headers: { location: '/admin?m=' + encodeURIComponent(msg) } });
      }
      return adminPage(env, origin, u.searchParams.get('m'));
    }
    return new Response('Domaine La Rosière', { status: 404 });
  },

  async scheduled(_e, env, ctx) { ctx.waitUntil(syncAll(env)); },
};
