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
  const r = await ev(`(()=>{const o={};
    document.querySelector('[data-open=dlg-album]').click();o.album=document.getElementById('dlg-album').open+' '+document.querySelectorAll('[data-album] img').length;
    document.querySelector('#dlg-album [data-close]').click();
    document.querySelector('[data-lb]').click();o.lb=document.getElementById('dlg-lb').open+' '+document.querySelector('[data-lbcap]').textContent;
    document.querySelector('[data-lbnav="1"]').click();o.lb2=document.querySelector('[data-lbcap]').textContent;document.querySelector('#dlg-lb [data-close]').click();
    document.getElementById('t2').click();o.tab=!document.getElementById('p2').hidden&&document.getElementById('p0').hidden&&document.querySelectorAll('#p2 li').length;
    const b=document.querySelector('[data-burger]');if(getComputedStyle(b).display!=='none'){b.click();o.burger=document.getElementById('nav').classList.contains('open');document.querySelector('#nav a').click();o.burgerClosed=!document.getElementById('nav').classList.contains('open')}
    return o})()`);
  await ev(`document.getElementById('piscine').scrollIntoView()`); await sleep(2500);
  const vstate = await ev(`(()=>{const v=document.querySelector('#piscine video');return {src:v.currentSrc.split('/').pop(),t:+v.currentTime.toFixed(2),paused:v.paused}})()`);
  const broken = await ev(`[...document.images].filter(i=>i.complete&&i.naturalWidth===0).map(i=>i.src)`);
  console.log(JSON.stringify({ r, vstate, broken, logs }));
} finally { try { ws && ws.close(); } catch {} chrome.kill(); }
