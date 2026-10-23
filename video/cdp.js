// Mini client CDP : pilote Chrome/Chromium sans playwright. Chemins surchargeables par variables d'environnement
// (CHROME, WS_MODULE) pour tourner aussi bien sous Linux (conteneur) que sous Windows.
const os=require('os'),path=require('path'),fs=require('fs');
const WS_CAND=[process.env.WS_MODULE,'/usr/local/lib/node_modules/@rlabs-inc/gemini-mcp/node_modules/ws',path.join(process.env.APPDATA||'','npm/node_modules/gemini-mcp/node_modules/ws'),'ws'].filter(Boolean);
let WS;for(const c of WS_CAND){try{WS=require(c);break}catch(e){}}
if(!WS)throw new Error('module ws introuvable (definir WS_MODULE)');
const CHROME=[process.env.CHROME,'C:/Program Files/Google/Chrome/Application/chrome.exe','/usr/bin/chromium','/usr/bin/chromium-browser','/usr/bin/google-chrome'].filter(Boolean).find(p=>fs.existsSync(p))||'chromium';
const {spawn}=require('child_process');
const http=require('http');
const getJSON=(u)=>new Promise((res,rej)=>http.get(u,r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>{try{res(JSON.parse(d))}catch(e){rej(e)}})}).on('error',rej));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function launch(port,url,w=1920,h=1080){
  const prof=path.join(os.tmpdir(),'chromium-icalldev-'+port);
  const p=spawn(CHROME,['--headless=new','--no-sandbox','--hide-scrollbars','--disable-dev-shm-usage','--remote-debugging-port='+port,'--user-data-dir='+prof,'--force-device-scale-factor=1','--window-size='+w+','+h,'--lang=he-IL','about:blank'],{stdio:'ignore'});
  let list;for(let i=0;i<200;i++){try{list=await getJSON('http://127.0.0.1:'+port+'/json');if(list.length)break}catch(e){}await sleep(250)}
  const page=list.find(x=>x.type==='page');
  const ws=new WS(page.webSocketDebuggerUrl,{maxPayload:1<<30});
  await new Promise(r=>ws.on('open',r));
  let id=0;const pend=new Map();
  ws.on('message',m=>{const o=JSON.parse(m);if(o.id&&pend.has(o.id)){const {res,rej}=pend.get(o.id);pend.delete(o.id);o.error?rej(new Error(JSON.stringify(o.error))):res(o.result)}});
  const send=(method,params={})=>new Promise((res,rej)=>{const i=++id;pend.set(i,{res,rej});ws.send(JSON.stringify({id:i,method,params}))});
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride',{width:w,height:h,deviceScaleFactor:1,mobile:false});
  await send('Page.navigate',{url});
  await sleep(1500);
  const ev=async(expr)=>{const r=await send('Runtime.evaluate',{expression:expr,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw new Error(JSON.stringify(r.exceptionDetails));return r.result.value};
  return {send,ev,close:()=>{try{ws.close()}catch(e){}try{p.kill()}catch(e){}}};
}
module.exports={launch,sleep};
