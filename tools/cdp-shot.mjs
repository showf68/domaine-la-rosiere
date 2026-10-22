// Capture pleine page avec emulation reelle de largeur (Chrome headless impose 500 px minimum
// a --window-size, d'ou ce passage par le protocole DevTools).
// Usage : node tools/cdp-shot.mjs <url> <largeur> <sortie.png> [scrollY]
import { spawn } from 'node:child_process';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const [url, width, outFile, scrollY] = process.argv.slice(2);
const W = parseInt(width, 10);
const mobile = W < 700;
const port = 9400 + Math.floor(Math.random() * 400);
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', [
  '--headless=new', '--disable-gpu', '--hide-scrollbars', `--remote-debugging-port=${port}`,
  `--user-data-dir=${mkdtempSync(join(tmpdir(), 'rosiere-cdp-'))}`, 'about:blank',
], { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws, id = 0;
const pending = new Map();
const logs = [];
function send(method, params = {}) {
  const i = ++id;
  ws.send(JSON.stringify({ id: i, method, params }));
  return new Promise((res, rej) => pending.set(i, { res, rej }));
}
try {
  let target;
  for (let k = 0; k < 50 && !target; k++) {
    await sleep(200);
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
      target = list.find((t) => t.type === 'page');
    } catch {}
  }
  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r));
  ws.addEventListener('message', (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.rej(new Error(m.error.message)) : p.res(m.result); }
    if (m.method === 'Runtime.exceptionThrown') logs.push('EXCEPTION ' + JSON.stringify(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text));
    if (m.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(m.params.type)) logs.push(m.params.type + ' ' + m.params.args.map((a) => a.value).join(' '));
    if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') logs.push('LOG ' + m.params.entry.text + ' ' + (m.params.entry.url || ''));
  });
  await send('Runtime.enable'); await send('Log.enable'); await send('Page.enable');
  const H = mobile ? 844 : 900;
  await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile });
  await send('Page.navigate', { url });
  await sleep(2500);
  // faire defiler pour declencher le chargement differe des images
  const total = (await send('Runtime.evaluate', { expression: 'document.documentElement.scrollHeight', returnByValue: true })).result.value;
  for (let y = 0; y < total; y += H / 2) { await send('Runtime.evaluate', { expression: `window.scrollTo(0,${y})` }); await sleep(200); }
  for (let k = 0; k < 40; k++) {
    const left = (await send('Runtime.evaluate', { expression: '[...document.images].filter(i=>!i.complete).length', returnByValue: true })).result.value;
    if (!left) break; await sleep(250);
  }
  await send('Runtime.evaluate', { expression: `window.scrollTo(0,${scrollY || 0})` });
  await sleep(1800);
  const metrics = (await send('Runtime.evaluate', { expression: 'JSON.stringify({sw:document.documentElement.scrollWidth,cw:document.documentElement.clientWidth,h:document.documentElement.scrollHeight})', returnByValue: true })).result.value;
  const full = scrollY === undefined;
  const shot = await send('Page.captureScreenshot', full ? { format: 'png', captureBeyondViewport: true } : { format: 'png' });
  writeFileSync(outFile, Buffer.from(shot.data, 'base64'));
  console.log(metrics, logs.length ? '\n' + logs.join('\n') : '(console propre)');
} finally {
  try { ws && ws.close(); } catch {}
  chrome.kill();
}
