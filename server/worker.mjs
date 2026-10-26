// Service du site Domaine La Rosière (Cloudflare Worker + D1) — NON DÉPLOYÉ (voir README.md).
//  GET  /disponibilites.json : nuits prises (imports Abritel/Airbnb + séjours confirmés en direct)
//  GET  /calendrier.ics      : export iCal des séjours DIRECTS confirmés (à donner à Abritel/Airbnb)
//  POST /demande             : enregistre la demande et l'envoie par e-mail au propriétaire
//  GET  /confirmer?id=&t=    : lien du mail ; le propriétaire confirme, les dates se bloquent
//  cron                      : relit les calendriers iCal d'Abritel/Airbnb (variable ICAL_IMPORTS)
// Les imports ne sont JAMAIS ré-exportés (sinon boucle entre plateformes).
import { EmailMessage } from 'cloudflare:email';

const CORS = (env) => ({ 'access-control-allow-origin': env.SITE_ORIGIN || '*', 'access-control-allow-headers': 'content-type' });
const json = (env, o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...CORS(env) } });
const iso = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s + 'T12:00:00Z'));
const esc = (s) => String(s ?? '').replace(/[\r\n]+/g, ' ').slice(0, 2000);

async function hmac(env, msg) {
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(env.SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const b = await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(msg));
  return [...new Uint8Array(b)].slice(0, 12).map((x) => x.toString(16).padStart(2, '0')).join('');
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
    let e = b ? f(b) : new Date(Date.parse(s + 'T12:00:00Z') + 864e5).toISOString().slice(0, 10);
    if (e <= s) e = new Date(Date.parse(s + 'T12:00:00Z') + 864e5).toISOString().slice(0, 10);
    out.push({ start: s, end: e });
  }
  return out;
}

async function mail(env, to, subject, text) {
  const raw = [`From: Site La Rosiere <${env.MAIL_FROM}>`, `To: ${to}`, `Subject: =?UTF-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`,
    'MIME-Version: 1.0', 'Content-Type: text/plain; charset=UTF-8', 'Content-Transfer-Encoding: base64', '', btoa(unescape(encodeURIComponent(text)))].join('\r\n');
  await env.MAIL.send(new EmailMessage(env.MAIL_FROM, to, raw));
}

async function booked(env) {
  const { results } = await env.DB.prepare("SELECT start, end FROM blocks WHERE end >= date('now','-1 day')").all();
  return results;
}

export default {
  async fetch(req, env) {
    const u = new URL(req.url);
    if (req.method === 'OPTIONS') return new Response(null, { headers: CORS(env) });
    if (u.pathname === '/disponibilites.json') return json(env, { booked: await booked(env) });
    if (u.pathname === '/calendrier.ics') {
      const { results } = await env.DB.prepare("SELECT id, start, end FROM blocks WHERE source='direct'").all();
      const d = (s) => s.replaceAll('-', '');
      const ev = results.map((r) => `BEGIN:VEVENT\r\nUID:direct-${r.id}@domainelarosiere.com\r\nDTSTAMP:${d(new Date().toISOString().slice(0, 10))}T000000Z\r\nDTSTART;VALUE=DATE:${d(r.start)}\r\nDTEND;VALUE=DATE:${d(r.end)}\r\nSUMMARY:Réservé\r\nEND:VEVENT`).join('\r\n');
      return new Response(`BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Domaine La Rosiere//FR\r\nCALSCALE:GREGORIAN\r\n${ev}\r\nEND:VCALENDAR\r\n`, { headers: { 'content-type': 'text/calendar; charset=utf-8', 'cache-control': 'max-age=900' } });
    }
    if (u.pathname === '/demande' && req.method === 'POST') {
      let d; try { d = await req.json(); } catch { return json(env, { ok: false }, 400); }
      const p = Number(d.people), n = Number(d.nights);
      if (!iso(d.arrival) || !iso(d.departure) || d.departure <= d.arrival || !(p >= 1 && p <= 50) || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(d.email || '') || String(d.phone || '').replace(/\D/g, '').length < 8 || !String(d.name || '').trim())
        return json(env, { ok: false, error: 'invalide' }, 422);
      const clash = (await booked(env)).some((b) => b.start < d.departure && b.end > d.arrival);
      if (clash) return json(env, { ok: false, error: 'dates_prises' }, 409);
      const r = await env.DB.prepare('INSERT INTO requests (arrival, departure, people, kind, name, email, phone, sheets, towels, message, estimate, created) VALUES (?,?,?,?,?,?,?,?,?,?,?,datetime(\'now\'))')
        .bind(d.arrival, d.departure, p, esc(d.kind || d.type), esc(d.name), esc(d.email), esc(d.phone), d.sheets ? 1 : 0, d.towels ? 1 : 0, String(d.message || '').slice(0, 3000), Number(d.estimate) || 0).run();
      const id = r.meta.last_row_id, t = await hmac(env, 'c' + id);
      await mail(env, env.OWNER_EMAIL, `Demande de séjour du ${d.arrival} au ${d.departure}`,
        `Nouvelle demande depuis le site.\n\nArrivée : ${d.arrival}\nDépart : ${d.departure} (${n} nuits)\nPersonnes : ${p}\nOccasion : ${esc(d.type)}\nDraps : ${d.sheets ? 'oui' : 'non'} · Serviettes : ${d.towels ? 'oui' : 'non'}\nEstimation : ${Number(d.estimate) || 0} €\n\nNom : ${esc(d.name)}\nTéléphone : ${esc(d.phone)}\nE-mail : ${esc(d.email)}\n\n${String(d.message || '').slice(0, 3000)}\n\nPour bloquer ces dates dans le calendrier (et sur Abritel/Airbnb via l'export), ouvrez :\n${u.origin}/confirmer?id=${id}&t=${t}\n`);
      return json(env, { ok: true });
    }
    if (u.pathname === '/confirmer') {
      const id = Number(u.searchParams.get('id'));
      if (!id || u.searchParams.get('t') !== await hmac(env, 'c' + id)) return new Response('Lien invalide', { status: 403 });
      const q = await env.DB.prepare('SELECT arrival, departure FROM requests WHERE id=?').bind(id).first();
      if (!q) return new Response('Introuvable', { status: 404 });
      await env.DB.prepare("INSERT OR IGNORE INTO blocks (source, ref, start, end) VALUES ('direct', ?, ?, ?)").bind('req' + id, q.arrival, q.departure).run();
      return new Response(`<meta charset="utf-8"><p style="font:18px sans-serif;padding:2em">Dates bloquées : ${q.arrival} → ${q.departure}.</p>`, { headers: { 'content-type': 'text/html; charset=utf-8' } });
    }
    return new Response('Domaine La Rosière', { status: 404 });
  },

  // cron : importe les calendriers Abritel / Airbnb (ICAL_IMPORTS = "abritel=https://...,airbnb=https://...")
  async scheduled(_e, env) {
    for (const part of (env.ICAL_IMPORTS || '').split(',').map((s) => s.trim()).filter(Boolean)) {
      const i = part.indexOf('='), name = part.slice(0, i), url = part.slice(i + 1);
      let r; try { r = await fetch(url); } catch { continue; }
      if (!r.ok) continue; // une panne de la plateforme ne vide JAMAIS le calendrier
      const evs = parseIcs(await r.text());
      const st = [env.DB.prepare('DELETE FROM blocks WHERE source=?').bind(name)];
      for (const e of evs) st.push(env.DB.prepare('INSERT INTO blocks (source, ref, start, end) VALUES (?,?,?,?)').bind(name, name + e.start, e.start, e.end));
      await env.DB.batch(st);
    }
  },
};
