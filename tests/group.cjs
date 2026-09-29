// Integração real: Electron host + 10 clientes Chromium, incluindo layout Android.
const { _electron, chromium } = require('playwright');
const fs = require('node:fs'), path = require('node:path'), http = require('node:http'), assert = require('node:assert/strict');
const assets = path.resolve(__dirname,'../../glupstreamxd-android/app/src/main/assets/web');
const server = http.createServer((req,res)=>{const url=new URL(req.url,'http://localhost');const file=path.resolve(assets,'.'+(url.pathname==='/'?'/index.html':url.pathname));if(!file.startsWith(assets+path.sep))return res.writeHead(403).end();fs.readFile(file,(err,data)=>{if(err)return res.writeHead(404).end();res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(data);});});
let electron,browser,host; const pages=[], errors=[];
const waitRoom=(page,state)=>page.waitForFunction(s=>room.state===s,state,{timeout:30000});
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 browser=await chromium.launch({channel:'chrome',headless:true,args:['--autoplay-policy=no-user-gesture-required']});
 electron=await _electron.launch({args:[path.resolve(__dirname,'..')]});host=await electron.firstWindow();host.on('pageerror',e=>errors.push(e.message));await host.waitForFunction(()=>typeof room!=='undefined');
 await host.click('#profile-button');await host.fill('#profile-name','F3D Host');await host.locator('#profile-form button[type=submit]').click();
 await host.reload();await host.waitForFunction(()=>extras.profile.name==='F3D Host');console.log('Perfil do PC persiste após recarregar: OK');
 await host.click('#help-button');await host.click('#copy-pix');const copied=await electron.evaluate(({clipboard})=>clipboard.readText());assert.equal(copied,await host.locator('#pix-code').inputValue());await host.click('[data-close=help-dialog]');
 await host.click('#create');await waitRoom(host,'waiting');const id=await host.locator('#room-id').textContent();
 for(let i=0;i<10;i++){
   const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});const page=await context.newPage();pages.push(page);page.on('pageerror',e=>errors.push(e.message));
   await page.goto(`http://127.0.0.1:${server.address().port}/`);await page.click('#profile-button');await page.fill('#profile-name','Pessoa '+(i+1));
   if(i===0){const data=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=c.height=64;const x=c.getContext('2d');x.fillStyle='#7c3aed';x.fillRect(0,0,64,64);x.fillStyle='white';x.font='40px sans-serif';x.fillText('P',20,48);return c.toDataURL('image/png').split(',')[1]});await page.locator('#profile-photo').setInputFiles({name:'foto.png',mimeType:'image/png',buffer:Buffer.from(data,'base64')});await page.waitForFunction(()=>!!extras.draftPhoto);}
   await page.locator('#profile-form button[type=submit]').click();await page.reload();await page.waitForFunction(()=>extras.profile.name.startsWith('Pessoa'));
   await page.fill('#room-input',id);await page.click('#join');await waitRoom(page,'connected');
 }
 await host.waitForFunction(()=>room.viewerCount===10);await pages[0].waitForFunction(()=>room.members.size===11);console.log('10 espectadores simultâneos + host; perfis e foto distribuídos: OK');
 assert.ok(await pages[1].evaluate(()=>[...room.members.values()].find(x=>x.name==='Pessoa 1').photo.length>0));
 const extra=await browser.newPage();await extra.goto(`http://127.0.0.1:${server.address().port}/`);await extra.fill('#room-input',id);await extra.click('#join');await extra.waitForFunction(()=>document.querySelector('#error-text').textContent.includes('Sala cheia'));await extra.close();
 await pages[0].fill('#message','Olá turma de 10!');await pages[0].press('#message','Enter');await pages[9].waitForFunction(()=>document.querySelector('#messages').textContent.includes('Olá turma de 10!'));await host.waitForFunction(()=>document.querySelector('#messages').textContent.includes('Olá turma de 10!'));
 await host.fill('#message','<b>Mensagem do host</b>');await host.click('#send');await pages[4].waitForFunction(()=>document.querySelector('#messages').textContent.includes('<b>Mensagem do host</b>'));assert.equal(await pages[4].locator('#messages b').count(),0);
 await pages[0].click('#stickers-button');await pages[0].locator('.sticker-choice').first().click();await pages[9].waitForFunction(()=>!!document.querySelector('.emoji-sticker'));
 const image=await pages[0].evaluate(()=>{const c=document.createElement('canvas');c.width=c.height=256;const x=c.getContext('2d');x.fillStyle='#22c55e';x.fillRect(0,0,256,256);return c.toDataURL('image/png').split(',')[1]});
 await host.click('#stickers-button');await host.locator('#sticker-file').setInputFiles({name:'figurinha.png',mimeType:'image/png',buffer:Buffer.from(image,'base64')});await pages[9].waitForFunction(()=>!!document.querySelector('.chat-sticker'));console.log('Chat em grupo, identidade, proteção de texto, figurinhas prontas e imagem: OK');
 await host.click('#stream-tab');await host.click('#start-stream');await host.waitForSelector('#source-dialog[open]');await host.locator('#sources button').filter({hasText:'GlupStreamXD'}).first().click();
 await Promise.all(pages.map(page=>page.waitForFunction(()=>document.querySelector('#video').videoWidth>0,null,{timeout:45000})));
 await host.waitForFunction(()=>stream.calls.size===10);await host.waitForFunction(()=>stats.totalTx>0&&stats.rows.filter(x=>x.kind==='Mídia').length===10);
 const report=await host.evaluate(()=>({viewers:room.viewerCount,mediaConnections:stream.calls.size,rows:stats.rows.length,tx:stats.totalTx,rx:stats.totalRx,limits:stream.limits(),senders:[...stream.calls.values()].map(({media})=>media.peerConnection.getSenders().find(x=>x.track?.kind==='video')?.getParameters().encodings[0].maxBitrate)}));
 assert.equal(report.mediaConnections,10);assert.ok(report.senders.every(value=>value>0&&value<=report.limits.bitrate));console.log('10 vídeos simultâneos e limites de banda aplicados:',JSON.stringify(report));
 await host.click('#stats-button');await host.waitForFunction(()=>document.querySelectorAll('#stats-rows tr').length===20);await host.screenshot({path:path.resolve(__dirname,'../../GlupStreamXD-2.0-estatisticas.png')});await host.click('[data-close=stats-dialog]');
 await pages[0].click('#mute');assert.equal(await pages[0].evaluate(()=>document.querySelector('#video').muted),true);await pages[0].click('#fullscreen');await pages[0].waitForFunction(()=>!!document.fullscreenElement);await pages[0].evaluate(()=>document.exitFullscreen());
 await pages[0].click('#chat-tab');await pages[0].setViewportSize({width:390,height:450});const field=await pages[0].locator('#message').boundingBox();assert.ok(field.y+field.height<=450);await pages[0].setViewportSize({width:390,height:844});
 await pages[0].screenshot({path:path.resolve(__dirname,'../../GlupStreamXD-2.0-Android.png')});
 await pages[0].evaluate(()=>room.conn.close());await waitRoom(pages[0],'connected');await pages[0].waitForFunction(()=>document.querySelector('#video').videoWidth>0);assert.equal(await pages[9].evaluate(()=>room.state),'connected');
 await pages[2].click('#disconnect');await host.waitForFunction(()=>room.viewerCount===9);assert.equal(await pages[9].evaluate(()=>room.state),'connected');
 await host.click('#stop-stream');await Promise.all(pages.filter((_,i)=>i!==2).map(page=>page.waitForFunction(()=>document.querySelector('#video').srcObject===null)));
 await host.click('#disconnect');await Promise.all(pages.map(page=>waitRoom(page,'offline')));assert.deepEqual(errors,[]);console.log('Reconexão individual, saída sem derrubar sala, mudo/fullscreen, teclado e parada global: OK; nenhum erro JavaScript.');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{if(host)await host.evaluate(()=>localStorage.removeItem('glup-profile-v2')).catch(()=>{});if(electron)await electron.close();if(browser)await browser.close();server.close();});
