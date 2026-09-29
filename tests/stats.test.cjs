const { test }=require('node:test'); const assert=require('node:assert/strict'); const vm=require('node:vm');const fs=require('node:fs');const path=require('node:path');
test('estatísticas somam apenas deltas do par ICE selecionado, sem duplicar totais RTP',async()=>{
 const sandbox={Glup:{},performance,Date};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../renderer/stats.js'),'utf8'),sandbox);
 const stats=Object.create(sandbox.Glup.Stats.prototype);stats.previous=new WeakMap();stats.room={members:new Map([['p',{name:'Pessoa'}]])};
 let tx=1000,rx=500;
 const pc={connectionState:'connected',getStats:async()=>new Map([['t',{type:'transport',selectedCandidatePairId:'pair'}],['pair',{id:'pair',type:'candidate-pair',bytesSent:tx,bytesReceived:rx,currentRoundTripTime:.02,localCandidateId:'local',remoteCandidateId:'remote'}],['local',{candidateType:'host',protocol:'udp'}],['remote',{candidateType:'relay'}],['rtp',{type:'outbound-rtp',kind:'video',bytesSent:999999,framesEncoded:5,frameWidth:640,frameHeight:360,framesPerSecond:15,qualityLimitationReason:'none'}]])};
 const a=await stats.sample(pc,'p','Mídia');assert.equal(a.deltaTx,1000);assert.equal(a.deltaRx,500);assert.equal(a.route,'TURN · UDP');assert.equal(a.rtt,20);
 tx=1400;rx=550;const b=await stats.sample(pc,'p','Mídia');assert.equal(b.deltaTx,400);assert.equal(b.deltaRx,50);
 const c=await stats.sample(pc,'p','Mídia');assert.equal(c.deltaTx,0);
});
