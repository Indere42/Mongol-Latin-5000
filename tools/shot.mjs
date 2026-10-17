// Minimal CDP screenshotter: node shot.mjs <url> <outfile> [w] [h] [dpr]
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const [url, outfile, w = '390', h = '844', dpr = '2', js = ''] = process.argv.slice(2);
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9333 + Math.floor(Math.random() * 300);
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'cdp-'));

const chrome = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run',
  '--no-default-browser-check', '--disable-extensions',
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank',
], { stdio: 'ignore' });

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function version() {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      if (r.ok) return await r.json();
    } catch {}
    await sleep(150);
  }
  throw new Error('chrome did not start');
}

const info = await version();
let target = null;
for (let i = 0; i < 40; i++) {
  const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
  target = list.find(t => t.type === 'page');
  if (target) break;
  await sleep(150);
}
if (!target) throw new Error('no page target');
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });

let id = 0;
const pending = new Map();
const events = [];
ws.onmessage = e => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  else if (m.method) events.push(m);
};
const send = (method, params = {}) => new Promise(res => {
  const i = ++id;
  pending.set(i, res);
  ws.send(JSON.stringify({ id: i, method, params }));
});

await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', {
  width: +w, height: +h, deviceScaleFactor: +dpr, mobile: +w < 700,
});
await send('Page.navigate', { url });
await sleep(1200);
if (js) {
  const r = await send('Runtime.evaluate', { expression: js, returnByValue: true, awaitPromise: true });
  console.log('EVAL:', JSON.stringify(r.result?.result?.value ?? r.result, null, 1));
}
const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
fs.writeFileSync(outfile, Buffer.from(shot.result.data, 'base64'));
console.log(`${outfile} ${w}x${h}@${dpr}`);

ws.close();
chrome.kill();
try { fs.rmSync(profile, { recursive: true, force: true }); } catch {}
process.exit(0);
