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
  const r = await ev(`(async()=>{const o={};const w=ms=>new Promise(r=>setTimeout(r,ms));
    const lb=document.getElementById('dlg-lb'),alb=document.getElementById('dlg-album');
    o.coupe=[...document.querySelectorAll('.coupe h3 span')].map(x=>x.textContent).join(' > ');
    document.querySelector('[data-lb]').click();await w(300);o.lbOpen=lb.open;o.count=document.querySelector('[data-lbcount]').textContent;
    document.querySelector('[data-lbnav="1"]').click();o.count2=document.querySelector('[data-lbcount]').textContent+' '+document.querySelector('[data-lbcap]').textContent;
    document.querySelector('.lbx__stage').click();o.lbClosedByOutside=!lb.open;
    document.querySelector('[data-lb]').click();lb.querySelector('[data-lbimg]').click();o.imgClickKeepsOpen=lb.open;lb.querySelector('[data-close]').click();o.lbClosedByBtn=!lb.open;
    document.querySelector('.morebtn').click();await w(200);o.album=alb.open+' '+alb.querySelectorAll('[data-ai]').length+' / btn '+document.querySelector('[data-albumcount]').textContent;
    alb.querySelector('[data-ai="3"]').click();await w(200);o.albLb=lb.open+' '+document.querySelector('[data-lbcount]').textContent+' '+document.querySelector('[data-lbcap]').textContent;
    lb.querySelector('.lbx__stage').click();o.backToAlbum=!lb.open&&alb.open;
    alb.querySelector('.alb__grid').click();o.albClosedByOutside=!alb.open;
    const f=document.querySelector('[data-form]'),e=f.elements;
    o.recapEmpty=[...f.querySelectorAll('.recap dd')].map(x=>x.textContent).join(' | ');
    e.arrival.value='2027-06-10';e.arrival.dispatchEvent(new Event('change'));e.departure.value='2027-06-13';e.departure.dispatchEvent(new Event('change'));
    f.querySelector('[data-stepbtn="1"]').click();
    o.recap=[...f.querySelectorAll('.recap dd')].map(x=>x.textContent).join(' | ');
    e.name.value='Test Essai';e.email.value='test@exemple.fr';f.querySelector('.send').click();o.done=!f.querySelector('[data-done]').hidden;
    return o})()`);
  await ev(`document.getElementById('piscine').scrollIntoView()`); await sleep(2500);
  const vstate = await ev(`(()=>{const v=document.querySelector('#piscine video');return {src:v.currentSrc.split('/').pop(),t:+v.currentTime.toFixed(2),paused:v.paused}})()`);
  const broken = await ev(`[...document.images].filter(i=>i.complete&&i.naturalWidth===0).map(i=>i.src)`);
  console.log(JSON.stringify({ r, vstate, broken, logs }));
} finally { try { ws && ws.close(); } catch {} chrome.kill(); }
