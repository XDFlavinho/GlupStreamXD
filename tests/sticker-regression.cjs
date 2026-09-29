// Regressão: imagens detalhadas >16 KB, durante vídeo, sem troca de conexão.
const {_electron,chromium}=require('playwright');const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const reproduce=process.env.GLUP_REPRO_OLD==='1', count=reproduce?3:10;
const assets=path.resolve(__dirname,'../../glupstreamxd-android/app/src/main/assets/web');
const server=http.createServer((req,res)=>{const url=new URL(req.url,'http://localhost');const file=path.resolve(assets,'.'+(url.pathname==='/'?'/index.html':url.pathname));if(!file.startsWith(assets+path.sep))return res.writeHead(403).end();fs.readFile(file,(e,data)=>{if(e)return res.writeHead(404).end();res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(data);});});
let app,browser,host;const pages=[], errors=[];
async function fingerprint(page){return page.evaluate(()=>({links:[...room.links.values()].map(x=>x.conn.connectionId).sort(),calls:[...stream.calls.values()].map(x=>x.media.connectionId).sort(),events:window.regressionEvents}));}
async function observe(page){await page.evaluate(()=>{window.regressionEvents=[];for(const kind of ['interrupted','member-left','error'])room.addEventListener(kind,e=>window.regressionEvents.push({kind,detail:e.detail}));});}
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));browser=await chromium.launch({channel:'chrome',headless:true,args:['--autoplay-policy=no-user-gesture-required']});app=await _electron.launch({args:[path.resolve(__dirname,'..')]});host=await app.firstWindow();host.on('pageerror',e=>errors.push(e.message));
 await host.click('#create');await host.waitForFunction(()=>room.state==='waiting');const id=await host.locator('#room-id').textContent();
 for(let i=0;i<count;i++){const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});const page=await context.newPage();pages.push(page);page.on('pageerror',e=>errors.push(e.message));await page.goto(`http://127.0.0.1:${server.address().port}/`);await page.fill('#room-input',id);await page.click('#join');await page.waitForFunction(()=>room.state==='connected');}
 await Promise.all([host,...pages].map(observe));
 const fixture=await host.evaluate(async()=>{const c=document.createElement('canvas');c.width=c.height=256;const x=c.getContext('2d'),pixels=x.createImageData(256,256);let seed=123456789;for(let i=0;i<pixels.data.length;i+=4){for(let n=0;n<3;n++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;pixels.data[i+n]=seed>>>24;}pixels.data[i+3]=255;}x.putImageData(pixels,0,0);const blob=await new Promise(r=>c.toBlob(r,'image/png'));const file=new File([blob],'foto-detalhada.png',{type:'image/png'});const compressed=await Glup.imageFile(file,256,50000);return {png:c.toDataURL('image/png').split(',')[1],compressed,bytes:new TextEncoder().encode(JSON.stringify({type:'sticker',image:compressed})).length};});
 assert.ok(fixture.bytes>16300&&fixture.bytes<50500);console.log('Imagem de regressão:',fixture.bytes,'bytes após redução.');
 if(!reproduce){await host.click('#stream-tab');await host.click('#start-stream');await host.waitForSelector('#source-dialog[open]');await host.locator('#sources button').filter({hasText:'GlupStreamXD'}).first().click();await Promise.all(pages.map(p=>p.waitForFunction(()=>document.querySelector('#video').videoWidth>0,null,{timeout:45000})));await host.click('#chat-tab');}
 const before=await Promise.all([host,...pages].map(fingerprint));
 await host.click('#stickers-button');await host.locator('#sticker-file').setInputFiles({name:'foto-detalhada.png',mimeType:'image/png',buffer:Buffer.from(fixture.png,'base64')});
 if(reproduce){await host.waitForFunction(()=>window.regressionEvents.some(e=>e.kind==='member-left'));console.log('BUG REPRODUZIDO:',JSON.stringify(await fingerprint(host)));return;}
 await Promise.all(pages.map(page=>page.waitForFunction(()=>document.querySelectorAll('.chat-sticker').length===1)));
 await pages[0].click('#chat-tab');await pages[0].click('#stickers-button');await pages[0].locator('#sticker-file').setInputFiles({name:'foto-detalhada.png',mimeType:'image/png',buffer:Buffer.from(fixture.png,'base64')});
 await Promise.all([host,...pages].map(page=>page.waitForFunction(()=>document.querySelectorAll('.chat-sticker').length===2)));
 // Texto continua chegando enquanto as imagens são divididas e remontadas.
 await pages[1].click('#chat-tab');await pages[1].fill('#message','Chat continua depois das figurinhas grandes');await pages[1].press('#message','Enter');await pages[9].waitForFunction(()=>document.querySelector('#messages').textContent.includes('Chat continua depois das figurinhas grandes'));
 // Roster de fotos também ultrapassa o limite anterior do canal JSON.
 for(let i=0;i<6;i++){const page=pages[i];await page.click('#profile-button');await page.fill('#profile-name','Foto '+i);await page.locator('#profile-photo').setInputFiles({name:'avatar.png',mimeType:'image/png',buffer:Buffer.from(fixture.png,'base64')});await page.waitForFunction(()=>!!extras.draftPhoto);await page.locator('#profile-form button[type=submit]').click();}
 await pages[9].waitForFunction(()=>[...room.members.values()].filter(m=>m.photo).length===6);const rosterBytes=await host.evaluate(()=>new TextEncoder().encode(JSON.stringify({type:'roster',members:room.list()})).length);assert.ok(rosterBytes>16300);console.log('Lista de perfis transmitida:',rosterBytes,'bytes.');
 // Aguarda novos pongs em todos, cobrindo mais de uma janela do timeout antigo.
 const heartbeats=await Promise.all(pages.map(p=>p.evaluate(()=>room.links.get(room.target).lastSeen)));
 await Promise.all(pages.map((p,i)=>p.waitForFunction(old=>room.links.get(room.target)?.lastSeen>old+10000,heartbeats[i],{timeout:20000})));
 const after=await Promise.all([host,...pages].map(fingerprint));
 for(let i=0;i<after.length;i++){assert.deepEqual(after[i].links,before[i].links);assert.deepEqual(after[i].calls,before[i].calls);assert.deepEqual(after[i].events,[]);}
 assert.equal(await host.evaluate(()=>room.viewerCount),10);assert.ok((await Promise.all(pages.map(p=>p.evaluate(()=>document.querySelector('#video').videoWidth)))).every(w=>w>0));assert.deepEqual(errors,[]);
 console.log('PASSOU: 10 espectadores, figurinha detalhada nos dois sentidos, perfis grandes, chat e vídeo; zero quedas/reconexões e mesmos IDs de conexão.');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{if(app)await app.close();if(browser)await browser.close();server.close();});
