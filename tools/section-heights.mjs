// Hauteur de chaque section d'une page (px), a une largeur donnee. Usage : node tools/section-heights.mjs <url> <largeur>
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const [url, width] = process.argv.slice(2); const W = +width || 1440;
const port = 9700 + Math.floor(Math.random() * 90);
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--disable-gpu', `--remote-debugging-port=${port}`, `--user-data-dir=${mkdtempSync(join(tmpdir(), 'rosiere-h-'))}`, 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws, id = 0; const pend = new Map();
const send = (m, p = {}) => { const i = ++id; ws.send(JSON.stringify({ id: i, method: m, params: p })); return new Promise((r) => pend.set(i, r)); };
try {
  let t; for (let k = 0; k < 50 && !t; k++) { await sleep(200); try { t = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((x) => x.type === 'page'); } catch {} }
  ws = new WebSocket(t.webSocketDebuggerUrl); await new Promise((r) => ws.addEventListener('open', r));
  ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m.result); pend.delete(m.id); } });
  await send('Emulation.setDeviceMetricsOverride', { width: W, height: 900, deviceScaleFactor: 1, mobile: W < 700 });
  await send('Page.navigate', { url }); await sleep(3000);
  const r = await send('Runtime.evaluate', { returnByValue: true, expression: `JSON.stringify({total:document.documentElement.scrollHeight,parts:[...document.querySelectorAll('body > section, main > section, main > div.orn, .frame > section, .frame > main > section, footer, .quote')].map(e=>(e.id||e.className.split(' ')[0])+':'+Math.round(e.getBoundingClientRect().height))})` });
  console.log(r.result.value);
} finally { try { ws.close(); } catch {} chrome.kill(); }
