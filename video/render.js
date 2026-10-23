// Rendu image par image du clip (index.html expose window.setT(t, image) et window.DUR).
//   node render.js still <dossier> <t1> <t2> ...          -> PNG de controle
//   node render.js frames <dossier> <debut> <fin> [SUB]   -> JPEG ; SUB sous-images par image = flou de mouvement reel
// Assemblage : ffmpeg -framerate 30*SUB -i f%05d_%d... (voir build.sh). Variable URL = page servie en HTTP local.
const fs=require('fs');const {launch}=require('./cdp.js');
const [,,mode,dir,...rest]=process.argv;
const FPS=30,SHUTTER=.62,URL=process.env.URL||'http://127.0.0.1:8767/index.html';
(async()=>{
  const br=await launch(9300+Math.floor(Math.random()*600),URL);
  await br.ev('window.ready');
  fs.mkdirSync(dir,{recursive:true});
  if(mode==='still'){
    for(const t of rest){await br.ev(`setT(${t})`);const r=await br.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(`${dir}/t${String(t).padStart(6,'0')}.png`,Buffer.from(r.data,'base64'))}
  }else{
    const s=+rest[0],e=+rest[1],SUB=+(rest[2]||1);
    for(let f=s;f<e;f++)for(let u=0;u<SUB;u++){
      await br.ev(`setT(${(f+u/SUB*SHUTTER)/FPS},${f})`);
      const r=await br.send('Page.captureScreenshot',{format:'jpeg',quality:94});
      fs.writeFileSync(`${dir}/f${String(f*SUB+u).padStart(6,'0')}.jpg`,Buffer.from(r.data,'base64'));
      if(u===0&&f%100===0)console.log('image',f);
    }
  }
  br.close();process.exit(0);
})().catch(e=>{console.error('ERR',e);process.exit(1)});
