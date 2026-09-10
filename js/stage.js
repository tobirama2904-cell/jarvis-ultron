/* ============================================================
   JARVIS Stage (Waves 3+6): STARK-загрузка, звуки интерфейса,
   виджеты, кино-режим, пульс орба при речи, тинт под персону,
   FaceID-lite (видит лицо → здоровается). После creator.js.
   ============================================================ */
(function(){
'use strict';

/* ---------- STARK загрузка ---------- */
function bootInit(){
  const b=document.getElementById('boot'); if(!b) return;
  b.addEventListener('click',()=>{ b.style.display='none'; });
  setTimeout(()=>{ b.style.transition='opacity .5s'; b.style.opacity='0'; setTimeout(()=>{ b.style.display='none'; },520); },1500);
}

/* ---------- Звуки (WebAudio, без файлов) ---------- */
const Sfx={
  on:(function(){ try{ return localStorage.getItem('sfx_on')!=='0'; }catch(e){ return true; } })(),
  ctx:null,
  ensure(){ if(!this.ctx){ try{ this.ctx=new (window.AudioContext||window.webkitAudioContext)(); }catch(e){} } if(this.ctx&&this.ctx.state==='suspended'){ this.ctx.resume().catch(()=>{}); } return this.ctx; },
  tone(f,d,type,g){ if(!this.on) return; const c=this.ensure(); if(!c) return;
    try{ const o=c.createOscillator(),gn=c.createGain(); o.type=type||'sine'; o.frequency.value=f||660;
      gn.gain.setValueAtTime(g||0.05,c.currentTime); gn.gain.exponentialRampToValueAtTime(0.0001,c.currentTime+(d||0.08));
      o.connect(gn); gn.connect(c.destination); o.start(); o.stop(c.currentTime+(d||0.08)); }catch(e){} },
  click(){ this.tone(720,0.06,'square',0.025); },
  ok(){ this.tone(880,0.09); const s=this; setTimeout(()=>s.tone(1320,0.1),90); },
  err(){ this.tone(220,0.16,'sawtooth',0.045); },
  toggle(){ this.on=!this.on; try{ localStorage.setItem('sfx_on',this.on?'1':'0'); }catch(e){} const b=document.getElementById('sndBtn'); if(b) b.textContent=this.on?'🔊 Звук':'🔇 Тихо'; if(this.on) this.click(); }
};
function sfxInit(){
  document.addEventListener('click',e=>{ try{ if(e.target&&e.target.closest&&(e.target.closest('.btn')||e.target.closest('.tab')||e.target.closest('.mode')||e.target.closest('#chips button')||e.target.closest('#styChips button'))) Sfx.click(); }catch(_){} });
  const b=document.getElementById('sndBtn'); if(b) b.textContent=Sfx.on?'🔊 Звук':'🔇 Тихо';
}

/* ---------- Виджеты: погода + курс + время ---------- */
let _wCache={t:0,html:''};
async function loadWidgets(force){
  const row=document.getElementById('wRow'); if(!row) return;
  if(!force&&Date.now()-_wCache.t<1800000&&_wCache.html){ row.innerHTML=_wCache.html; row.style.display='flex'; return; }
  try{
    const w=await fetch('https://wttr.in/Dushanbe?format=%t+%C&m').then(x=>x.text()).catch(()=>'');
    const r=await fetch('https://open.er-api.com/v6/latest/USD').then(x=>x.json()).then(j=>'💱 $1 = '+(+j.rates.TJS).toFixed(2)).catch(()=> '');
    if(!w&&!r) return;
    const clk=new Date().toLocaleString('ru-RU',{timeZone:'Asia/Dushanbe',hour:'2-digit',minute:'2-digit'});
    _wCache={t:Date.now(),html:`<span>🌤 ${w} • Душанбе</span>`+(r?`<span>${r}</span>`:'')+`<span>🕒 ${clk}</span>`};
    row.innerHTML=_wCache.html; row.style.display='flex';
  }catch(e){}
}

/* ---------- Кино-режим + полный экран ---------- */
function toggleCinema(){
  document.body.classList.toggle('cinema');
  const b=document.getElementById('cineBtn');
  if(b) b.textContent=document.body.classList.contains('cinema')?'🎞 Обычный':'🎞 Кино';
  try{ log(document.body.classList.contains('cinema')?'cinema on':'cinema off'); }catch(e){}
}
function toggleFull(){
  try{ if(document.fullscreenElement) document.exitFullscreen().catch(()=>{}); else document.documentElement.requestFullscreen().catch(()=>{}); }catch(e){}
}

/* ---------- Пульс орба пока говорит ---------- */
setInterval(()=>{ try{
  if(window.sunPoints&&window.sunPoints.material){
    window.sunPoints.material.size=window._speaking?(0.045+Math.abs(Math.sin(Date.now()/130))*0.022):0.045;
  }
}catch(e){} },120);

/* ---------- Тинт колец под персону ---------- */
const TINT={jarvis:0x00E7FF,friday:0xFF8B1A,ultron:0xFF2040};
function tintSun(){
  try{
    const g=window.sunGroup; if(!g) return;
    const c=TINT[(typeof currentMode!=='undefined'?currentMode:'jarvis')]||TINT.jarvis;
    g.children.forEach(ch=>{ if(ch.geometry&&ch.geometry.type==='RingGeometry'&&ch.material&&ch.material.color) ch.material.color.setHex(c); });
  }catch(e){}
}

/* ---------- FaceID-lite: видит лицо → здоровается ---------- */
let _faceMod=null,_faceBusy=false,_greeted=false,_faceFails=0;
async function faceTick(){
  if(_faceBusy||_faceFails>3) return;
  if(typeof camStream==='undefined'||!camStream) return;
  const v=document.getElementById('cam'); if(!v||v.readyState<2||!v.videoWidth) return;
  try{
    if(!_faceMod){
      const mod=await import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs');
      const fileset=await mod.FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm');
      _faceMod=await mod.FaceDetector.createFromOptions(fileset,{baseOptions:{modelAssetPath:'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite',delegate:'GPU'},runningMode:'VIDEO',minDetectionConfidence:0.5});
      try{ log('faceID ready'); }catch(e){}
    }
    _faceBusy=true;
    const res=await _faceMod.detectForVideo(v,performance.now());
    const n=(res&&res.detections&&res.detections.length)||0;
    const fl=document.getElementById('faceLabel'); if(fl) fl.textContent=n?('FACE • '+n):'FACE • —';
    if(n>0&&!_greeted){
      _greeted=true;
      let name='Амин'; try{ const mm=loadMemory(); if(mm&&mm.name) name=mm.name; }catch(e){}
      const g=(typeof currentMode!=='undefined'&&currentMode==='ultron')?(name+'. Я тебя вижу.'):((typeof currentMode!=='undefined'&&currentMode==='friday')?('Привет, '+name+'! Вижу тебя!'):('Рад видеть вас, сэр '+name+'.'));
      try{ addMsg('bot','👁️ '+g); queueVoice(g,(typeof currentMode!=='undefined'?currentMode:'jarvis')); }catch(e){}
    }
  }catch(e){ _faceFails++; }
  finally{ _faceBusy=false; }
}
setInterval(faceTick,3000);
function faceReset(){ _greeted=false; try{ const fl=document.getElementById('faceLabel'); if(fl) fl.textContent='FACE • OFF'; }catch(e){} }

/* ---------- init ---------- */
function stageInit(){ bootInit(); sfxInit(); setTimeout(()=>loadWidgets(false),2500); setInterval(()=>loadWidgets(true),900000); }
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',stageInit); else stageInit();

window.Stage={toggleCinema,toggleFull,tintSun,faceReset,loadWidgets};
window.Sfx=Sfx;
})();
