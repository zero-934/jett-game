/**
 * @file render-mockups.cjs
 * @purpose Reproducible, standalone design references; never imported by the game.
 * @author Agent 934
 * @date 2026-11-05
 * @license Proprietary – available for licensing
 */
const fs = require('node:fs');
const path = require('node:path');
const root = __dirname;
const themes = { gold: '#d6b76f', emerald: '#64d6b2', violet: '#b4a1f0' };
const assets = Object.fromEntries(['jett-pilot-study','flap-wizard-study'].map(key => [key, 'data:image/png;base64,'+fs.readFileSync(path.join(root,'assets',key+'.png')).toString('base64')]));
const games = { jett:'JETT', flap:'FLAP FORTUNE', shatter:'SHATTER STEP' };
const geometry = { width:390, height:844, header:56, hudBottom:128, stage:{x:16,y:136,width:358,height:544}, controlsTop:692, flap:{worldWidth:390,worldHeight:844,scale:544/844,playerX:80,playerSize:28,pipeWidth:30,gapHeight:158,initialPipeX:490,spawnPipeX:450,spawnThresholdX:160,scrollPerTick:3,firstSpawnTick:111,firstPitch:293,steadyPitch:294,fixtureTick:152,pipeX:[34,327],gapTop:397.6}, shatter:{rows:10,columns:2,tileWidth:148.2,tileHeight:40,rowPitch:48,leftX:38.8,rightX:203,topCenterY:196} };
const esc = s => String(s).replaceAll('&','&amp;').replaceAll('<','&lt;');
const text = (x,y,s,size=12,fill='#e8edf4',weight=500,anchor='start',extra='') => `<text x="${x}" y="${y}" font-size="${size}" fill="${fill}" font-weight="${weight}" text-anchor="${anchor}" ${extra}>${esc(s)}</text>`;
const rect = (x,y,w,h,fill,rx=0,extra='') => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}" ${extra}/>`;
const line = (x1,y1,x2,y2,color,width=1,extra='') => `<path d="M${x1} ${y1}L${x2} ${y2}" stroke="${color}" stroke-width="${width}" fill="none" ${extra}/>`;
const defs = accent => `<defs>
 <linearGradient id="sky" x2="0" y2="1"><stop stop-color="#1b2940"/><stop offset="1" stop-color="#111a29"/></linearGradient>
 <linearGradient id="rock" x2=".8" y2="1"><stop stop-color="#718197"/><stop offset=".45" stop-color="#3c4b60"/><stop offset="1" stop-color="#222e40"/></linearGradient>
 <linearGradient id="metal" x2="1" y2="0"><stop stop-color="#2e3f55"/><stop offset=".3" stop-color="#617288"/><stop offset=".55" stop-color="#45566b"/><stop offset="1" stop-color="#26364a"/></linearGradient>
 <linearGradient id="glass" x1="0" y1="0" x2=".85" y2="1"><stop stop-color="#c8e7f5" stop-opacity=".25"/><stop offset=".35" stop-color="#719bb5" stop-opacity=".1"/><stop offset="1" stop-color="#a1d6e8" stop-opacity=".23"/></linearGradient>
 <linearGradient id="sheen" x2="1" y2="1"><stop stop-color="#d9f4ff" stop-opacity=".58"/><stop offset=".23" stop-color="#d9f4ff" stop-opacity=".04"/><stop offset=".6" stop-color="#d9f4ff" stop-opacity=".02"/><stop offset="1" stop-color="#d9f4ff" stop-opacity=".22"/></linearGradient>
 <radialGradient id="halo"><stop stop-color="${accent}" stop-opacity=".15"/><stop offset="1" stop-color="${accent}" stop-opacity="0"/></radialGradient>
 </defs>`;
function pilot(x,y,w=56,h=72,key='jett-pilot-study') { return `<image href="${assets[key]}" x="${x-w/2}" y="${y-h/2}" width="${w}" height="${h}"/>`; }
function runner(x,y) {return `<ellipse cx="${x}" cy="${y+17}" rx="13" ry="3" fill="#060b12" opacity=".5"/><circle cx="${x}" cy="${y-12}" r="5" fill="#e2cfa4"/><path d="M${x} ${y-5}l-3 13m3-13 5 12m-4-8-7 3m8-4 7 1m-12 9-3 10m8-10 5 9" stroke="#e1e8ed" stroke-width="3" stroke-linecap="round"/>`;}
function glass(x,y,w,h,{active=false,passed=false,broken=false,crack=false,settled=false,accent='#d6b76f'}={}) {
 let s = rect(x,y+h,w,3,'#304e62',2)+rect(x,y+2,w,h,'none',6,'stroke="#294457" stroke-opacity=".6"');
 if(broken) {
   s += rect(x,y,w,h,'#0b1522',6,`stroke="#304557"`);
   const polys = [[0,0,35,4,9,18],[45,2,77,1,62,14],[w-34,0,w,0,w-6,15],[3,h-14,34,h-2,0,h],[w-23,h-15,w,h-27,w,h]];
   s += polys.map(p=>`<polygon points="${p.map((v,i)=>v+(i%2?y:x)).reduce((a,v,i)=>a+(i%2?',':' ')+v,'')}" fill="url(#glass)" stroke="#9fc6d5" stroke-opacity=".65"/>`).join('');
   if(!settled)for(let i=0;i<8;i++) {const sx=x+25+i*13,sy=y+h+9+(i%3)*10;s+=`<path d="M${sx} ${sy}l${9-i%3} ${2+i%4}l-5 10Z" fill="#8bb4c8" opacity="${.75-i*.06}"/>`;}
 } else {
   s += rect(x,y,w,h,'url(#glass)',6,`stroke="${active?accent:'#7195aa'}" stroke-opacity="${active?'.9':'.55'}" stroke-width="${active?2:1}"`);
   s += rect(x+2,y+2,w-4,h-4,'url(#sheen)',4);
   s += line(x+8,y+2,x+w-8,y+2,'#c4e6f3',1,'opacity=".58"');
   s += `<path d="M${x+17} ${y+3}l18 0 -24 ${h-6} -8 0Z" fill="#c3e9f6" opacity=".10"/>`;
   s += line(x+7,y+h-2,x+w-7,y+h-2,'#81b0c7',2,'opacity=".45"');
   if(passed)s+=text(x+w/2,y+h/2+4,'✓',15,'#75d6b1',650,'middle');
 }
 if(crack)s+=`<path d="M${x+80} ${y+17}l-27 -11m27 11 28 -13m-28 13 9 20m-9-20-29 15m29-15 29 10m-29-10 1-13" stroke="#d3edf4" stroke-width="1.4" fill="none"/>`;
 return s;
}
function shell(game,state,theme) {
 const a=themes[theme]; const active=state==='playing', lost=state==='loss', paid=state==='cashed-out';
 const data={jett:{mult:'1.45×',progress:'400 m altitude · 1 coin',returned:'14.50',profit:'+4.50'},flap:{mult:'1.06×',progress:'1 gate cleared',returned:'10.57',profit:'+0.57'},shatter:{mult:'3.27×',progress:'3 of 10 rows cleared',returned:'32.74',profit:'+22.74'}}[game];
 let s=`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="390" height="844" viewBox="0 0 390 844" role="img" aria-label="${games[game]} ${state} design reference"><style>text{font-family:Arial,Helvetica,sans-serif}</style>${defs(a)}`;
 s+=rect(0,0,390,844,'#0d121a')+rect(0,0,390,56,'#121923');
 s+=`<path d="M28 22l-6 6 6 6" fill="none" stroke="#b9c6d5" stroke-width="2"/>`+text(43,33,games[game],13,'#edf1f7',750);
 const balance=paid?({jett:'1,004.50',flap:'1,000.57',shatter:'1,022.74'}[game]):state==='ready'?'1,000.00':'990.00';
 s+=text(290,23,'DEMO CREDITS',10,'#a6b3c4',600,'end')+text(290,40,balance,14,'#edf1f7',650,'end');
 s+=`<circle cx="348" cy="28" r="17" fill="#1c2633"/><path d="M340 28h16m-8-8v16" stroke="#b9c6d5" stroke-width="1.5"/><circle cx="348" cy="28" r="5" fill="#1c2633" stroke="#b9c6d5" stroke-width="1.5"/>`;
 s+=text(195,78,state==='ready'?'READY TO PLAY':paid?'ROUND COMPLETE':lost?'ROUND ENDED':'CURRENT MULTIPLIER',9,'#92a2b5',650,'middle','letter-spacing="1.3"');
 s+=text(195,113,state==='ready'?'1.00×':data.mult,37,paid?'#75d6b1':lost?'#bbc4d0':a,750,'middle');
 s+=text(195,130,state==='ready'?'Demo stake · 10.00':data.progress,10,'#a6b3c4',500,'middle');
 s+=rect(16,136,358,544,'url(#sky)',14);
 // Fixed stars and terrain are visual decoration only.
 for(let i=0;i<29;i++){const x=28+(i*67)%335,y=150+(i*97)%495;s+=`<circle cx="${x}" cy="${y}" r="${i%4===0?1.1:.65}" fill="#acbfd4" opacity="${.12+(i%4)*.08}"/>`;}
 s+=`<path d="M16 647l48-51 39 18 41-63 50 55 48-28 57 47 42-42 33 41v56H16Z" fill="#152339"/><path d="M16 672l58-32 54 21 51-37 42 24 61-17 48 24 44-12v37H16Z" fill="#101d2f"/>`;
 if(game==='jett') {
  const scale=544/844, ox=(390-390*scale)/2, oy=136; const px=x=>ox+x*scale,py=y=>oy+y*scale;
  s+=`<g><ellipse cx="195" cy="478" rx="100" ry="115" fill="url(#halo)"/>`;
  const rocks=[[70,190,23],[290,315,30],[95,385,22],[306,620,27]];
  for(const [x,y,r] of rocks)s+=`<g transform="translate(${px(x)} ${py(y)}) scale(${scale})"><path d="M${-r} -5l8 ${-r+3} ${r+4} -4 ${r-2} 15 -6 ${r} -19 9 -17 -9Z" fill="url(#rock)" stroke="#7c8b9e" stroke-opacity=".3"/><ellipse cx="-5" cy="-5" rx="${r*.28}" ry="${r*.19}" fill="#26364a"/><ellipse cx="9" cy="9" rx="4" ry="3" fill="#26364a"/></g>`;
  s+=pilot(px(195),py(523.28),49,66);
  for(const [x,y] of [[210,405],[170,265],[225,135]])s+=`<g><circle cx="${px(x)}" cy="${py(y)}" r="6" fill="${a}"/><circle cx="${px(x)}" cy="${py(y)}" r="4" fill="none" stroke="#fff1c5" stroke-opacity=".5"/>${text(px(x),py(y)+2,'•',7,'#6d5323',700,'middle')}</g>`;
  s+='</g>'+text(195,662,'DRAG TO STEER',10,'#b8c4d4',650,'middle','letter-spacing="1"');
 } else if(game==='flap') {
  const f=geometry.flap,scale=f.scale,ox=(390-390*scale)/2,oy=136;
  s+=`<g transform="translate(${ox} ${oy}) scale(${scale})">`;
  for(const x of f.pipeX){s+=rect(x,0,f.pipeWidth,f.gapTop,'url(#metal)',2)+rect(x,f.gapTop+f.gapHeight,f.pipeWidth,844-f.gapTop-f.gapHeight,'url(#metal)',2);s+=rect(x,f.gapTop-8,30,8,'#8190a0',2)+rect(x,f.gapTop+f.gapHeight,30,8,'#8190a0',2);s+=line(x+4,0,x+4,f.gapTop-9,'#7c8da2',1,'opacity=".5"');}
  s+=pilot(80,476.6,66,60,'flap-wizard-study');
  s+=`</g>`+text(195,643,'DIVE TO CASH OUT · AFTER FIRST GATE',10,'#a6b3c4',600,'middle')+text(195,662,'TAP THE SKY TO FLAP',11,'#b8c4d4',650,'middle','letter-spacing="1"');
 } else {
  s+=text(195,158,'CHOOSE ONE GLASS PANE',9,'#9eafc3',650,'middle','letter-spacing="1"');
  const cleared=state==='ready'?0:3;
  for(let r=9;r>=0;r--){const cy=196+(9-r)*48,activeRow=r===cleared; for(let c=0;c<2;c++){const x=c?203:38.8;const passed=r<cleared&&c===r%2; s+=glass(x,cy-20,148.2,40,{accent:a,active:activeRow&&active,passed,broken:lost&&activeRow&&c===0});}
   s+=text(365,cy+3,String(r+1).padStart(2,'0'),8,activeRow?a:'#62748b',650,'middle');
  }
  s+=runner(112.9,state==='ready'?660:532-22);
 }
 if(state!=='playing'&&state!=='ready') {
  s+=rect(16,136,358,544,'#081019',14,'opacity=".58"');
  s+=rect(43,324,304,166,'#1b2635',16,'stroke="#3a4859"');
  s+=text(195,357,paid?'CASHED OUT':game==='shatter'?'GLASS BROKE':'ROUND ENDED',13,paid?'#75d6b1':'#ebbfaa',750,'middle');
  s+=text(195,400,paid?data.returned:'0.00',36,'#f1f4f8',750,'middle');
  s+=text(195,423,'DEMO CREDITS RETURNED',9,'#a7b5c6',600,'middle','letter-spacing="1"');
  s+=text(195,457,paid?`Net ${data.profit} · stake 10.00`:'Net −10.00 · stake 10.00',12,paid?'#75d6b1':'#c3cbd7',600,'middle');
 }
 s+=rect(0,692,390,152,'#131c27')+line(0,692,390,692,'#2b3848');
 s+=text(22,715,'DEMO STAKE',9,'#8d9caf',600)+text(22,740,'10.00',19,'#e4eaf2',650);
 s+=text(368,715,active?'RETURN IF CASHED OUT':'DEMO MODE',9,'#8d9caf',600,'end')+text(368,740,active?data.returned+' credits':paid?'Settled once':lost?'No return':'No cash value',14,'#d6e0ec',650,'end');
 s+=rect(20,754,350,52,a,12)+text(195,786,active?'CASH OUT':state==='ready'?'PLAY · 10.00 CREDITS':'PLAY AGAIN · 10.00',14,'#111a24',750,'middle');
 s+=text(195,827,'DEMO CREDITS HAVE NO CASH VALUE',11,'#a6b3c4',600,'middle','letter-spacing=".3"');
 return s+'</svg>';
}
fs.mkdirSync(path.join(root,'renders'),{recursive:true});
for(const game of Object.keys(games))for(const state of ['ready','playing','cashed-out','loss'])for(const theme of Object.keys(themes))fs.writeFileSync(path.join(root,'renders',`${game}-${state}-${theme}.svg`),shell(game,state,theme));
let fracture=`<svg xmlns="http://www.w3.org/2000/svg" width="1120" height="310" viewBox="0 0 1120 310"><style>text{font-family:Arial,Helvetica,sans-serif}</style>${defs(themes.gold)}${rect(0,0,1120,310,'#111a28')}${text(28,35,'SHATTER STEP · GLASS BREAK MATERIAL / TIMING STUDY',16,'#e9eff6',700)}`;
const stages=[['0 ms · contact',{}],['35–85 ms · fracture',{crack:true}],['85–260 ms · release',{broken:true}],['650 ms · empty frame',{broken:true,settled:true}]];
for(let i=0;i<4;i++){const x=28+i*278;fracture+=text(x,77,stages[i][0],12,'#d6b76f',650)+glass(x,105,232,66,stages[i][1])+text(x,246,['Highlight, no shake yet','One focal point; branching cracks','12–20 pooled angular fragments','Fragments fade; truthful result remains'][i],10,'#a6b5c8');}
fs.writeFileSync(path.join(root,'renders','shatter-glass-storyboard.svg'),fracture+'</svg>');
fs.writeFileSync(path.join(root,'design-tokens.json'),JSON.stringify({version:1,direction:'B — Soft Depth',referenceViewport:{width:390,height:844},colors:{background:'#0d121a',surface:'#131c27',stage:'#1b2940',text:'#e8edf4',muted:'#a6b3c4',success:'#75d6b1',loss:'#ebbfaa',themes},geometry},null,2)+'\n');
const html=`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>JETT POLISH 003 — Opus visual build references</title><style>*{box-sizing:border-box}body{margin:0;background:#080d14;color:#e8edf4;font-family:Arial,Helvetica,sans-serif}header{padding:22px 24px 14px}h1{font-size:22px;margin:0 0 8px}p{font-size:13px;color:#a6b3c4;margin:0 0 12px;max-width:1050px;line-height:1.5}nav{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px}a{color:#d6b76f;background:#172131;padding:8px 12px;border-radius:8px;text-decoration:none;font-size:12px}.board{display:flex;gap:20px;padding:0 24px 24px;width:max-content}.phone{width:390px}h2{font-size:12px;letter-spacing:1.5px;color:#a6b3c4}.phone img{width:390px;height:844px;border:1px solid #2b3848;border-radius:16px;display:block}.wide{margin:0 24px 24px;width:1120px}.caption{font-size:11px;margin-top:12px;line-height:1.5;max-width:390px}.single header{display:none}.single .board{padding:0;gap:0}.single h2,.single .caption{display:none}.single .phone img{border:0;border-radius:0}</style><header><h1>Direction B — Soft Depth</h1><p>Artist’s build references for Phaser. Editable SVGs govern layout; raster characters are art studies. These are proposed screens, not implemented gameplay or performance evidence. Flap shows the existing 390 × 844 world uniformly fitted into the stage: 158 px opening, 30 px pipe, 293/294 px actual pitch.</p><nav><a href="?state=playing">In play</a><a href="?state=ready">Ready</a><a href="?state=cashed-out">Cashed out</a><a href="?state=loss">Loss</a><a href="?theme=emerald">Emerald</a><a href="?theme=violet">Violet</a><a href="?glass=1">Glass sequence</a></nav></header><main id="content"></main><script>const q=new URLSearchParams(location.search);const state=['ready','playing','cashed-out','loss'].includes(q.get('state'))?q.get('state'):'playing';const theme=['gold','emerald','violet'].includes(q.get('theme'))?q.get('theme'):'gold';const games=${JSON.stringify(games)};const single=q.get('game');if(single)document.body.classList.add('single');document.getElementById('content').innerHTML=q.has('glass')?'<img class="wide" src="renders/shatter-glass-storyboard.svg" alt="Four stages of a glass pane breaking">':'<div class="board">'+Object.entries(games).filter(([key])=>!single||single===key).map(([key,title])=>'<section class="phone"><h2>'+title+' · '+state.toUpperCase()+'</h2><img src="renders/'+key+'-'+state+'-'+theme+'.svg" alt="'+title+' proposed '+state+' screen"><p class="caption">'+({jett:'Soft shaded jetpack pilot, readable asteroid rims, sparse coin route. Drag the stage to steer; the bottom action is isolated.',flap:'Compact wizard and steel pipes. The gap and spacing follow current logic. Tap only the playfield; cash out remains separate.',shatter:'Transparent beveled glass over a deep shaft. Only the current row accepts a choice. Wrong pane fractures before shards fall.'}[key])+'</p></section>').join('')+'</div>';</script></html>`;
fs.writeFileSync(path.join(root,'index.html'),html);
console.log('Generated 36 screen SVGs, glass storyboard, tokens and preview.');
