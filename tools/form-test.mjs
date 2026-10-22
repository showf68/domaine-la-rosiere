// Teste la demande de sejour sans rien envoyer : verifie les erreurs, puis capture l'URL mailto
// generee (Chrome headless n'a aucun client mail : rien ne part).
// Usage : node tools/form-test.mjs <url> <largeur>
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const [url, width] = process.argv.slice(2);
const W = parseInt(width || '390', 10);
const port = 9800 + Math.floor(Math.random() * 100);
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--disable-gpu', `--remote-debugging-port=${port}`, `--user-data-dir=${mkdtempSync(join(tmpdir(), 'rosiere-form-'))}`, 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws, id = 0; const pending = new Map(); const navs = []; const logs = [];
const send = (method, params = {}) => { const i = ++id; ws.send(JSON.stringify({ id: i, method, params })); return new Promise((res, rej) => pending.set(i, { res, rej })); };
const ev = async (expression) => (await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result.value;
try {
  let t; for (let k = 0; k < 50 && !t; k++) { await sleep(200); try { t = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((x) => x.type === 'page'); } catch {} }
  ws = new WebSocket(t.webSocketDebuggerUrl); await new Promise((r) => ws.addEventListener('open', r));
  ws.addEventListener('message', (e) => { const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.rej(new Error(m.error.message)) : p.res(m.result); }
    if (m.method === 'Page.frameRequestedNavigation' || m.method === 'Page.frameScheduledNavigation') navs.push(m.params.url);
    if (m.method === 'Runtime.exceptionThrown') logs.push('EXCEPTION ' + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text));
  });
  await send('Page.enable'); await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: W, height: 844, deviceScaleFactor: 1, mobile: W < 700 });
  await send('Page.navigate', { url }); await sleep(2500);
  // 1) envoi vide -> erreurs
  await ev(`document.querySelector('[data-form] [type=submit]').click()`);
  const errs = await ev(`[...document.querySelectorAll('[data-form] .err')].map(e=>e.closest('.field').querySelector('input,select').name+': '+e.textContent)`);
  // 2) depart avant arrivee + 60 personnes
  await ev(`(()=>{const f=document.querySelector('[data-form]').elements;
    f.arrival.value='2027-06-10';f.arrival.dispatchEvent(new Event('change'));f.departure.value='2027-06-08';f.people.value='60';
    f.type.selectedIndex=1;f.name.value='Test Essai';f.email.value='test@exemple';})()`);
  await ev(`document.querySelector('[data-form] [type=submit]').click()`);
  const errs2 = await ev(`[...document.querySelectorAll('[data-form] .err')].map(e=>e.closest('.field').querySelector('input,select').name+': '+e.textContent)`);
  // 3) valeurs correctes
  await ev(`(()=>{const f=document.querySelector('[data-form]').elements;
    f.departure.value='2027-06-13';f.people.value='42';f.email.value='test@exemple.fr';f.phone.value='06 00 00 00 00';f.message.value='Message de test';})()`);
  await ev(`document.querySelector('[data-form] [type=submit]').click()`);
  await sleep(800);
  const done = await ev(`!document.querySelector('.form__done').hidden`);
  await ev(`document.querySelector('[data-lb]').click()`); await sleep(300);
  const lb1 = await ev(`document.querySelector('[data-lb-dialog]').open+' | '+document.querySelector('[data-lb-cap]').textContent`);
  await ev(`document.querySelector('[data-lb-next]').click()`);
  const lb2 = await ev(`document.querySelector('[data-lb-cap]').textContent`);
  await ev(`document.querySelector('[data-lb-close]').click()`);
  const lb3 = await ev(`document.querySelector('[data-lb-dialog]').open`);
  const burger = W < 1080 ? await ev(`(()=>{const b=document.querySelector('[data-burger]');b.click();const o=document.getElementById('nav').classList.contains('is-open');document.querySelector('#nav a').click();return o+' -> '+document.getElementById('nav').classList.contains('is-open')})()`) : 'n/a';
  console.log(JSON.stringify({ lb1, lb2, lb3, burger, errs, errs2, done, navs: navs.map(decodeURIComponent), logs }, null, 2));
} finally { try { ws && ws.close(); } catch {} chrome.kill(); }
