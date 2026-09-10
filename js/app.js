function log(t){ const el=document.getElementById('log'); if(el) el.textContent=(new Date().toLocaleTimeString()+' • '+t).slice(0,160); console.log(t); window.__logHist=window.__logHist||[]; window.__logHist.push(new Date().toLocaleTimeString()+' • '+t); if(window.__logHist.length>200) window.__logHist.shift(); }
setInterval(()=>{ const el=document.getElementById('sysClock'); if(el) el.textContent=new Date().toLocaleString('ru-RU',{timeZone:'Asia/Dushanbe',hour:'2-digit',minute:'2-digit',second:'2-digit'})+' DSH' },1000);
let currentMode='jarvis';
const greetings={ jarvis:'Добрый день, сэр Амин. JARVIS к вашим услугам.', friday:'Привет, Амин! FRIDAY на связи — готова, босс!', ultron:'Амин. ULTRON активирован.' };
const pColors={jarvis:'00D9FF',friday:'FF8A00',ultron:'FF2336'};
function setMode(m, speak=true){
  currentMode=m;
  document.body.className='theme-'+m;
  document.querySelectorAll('.mode').forEach(x=>x.classList.toggle('active', x.dataset.m===m));
  const wn=document.getElementById('whoName'); if(wn) wn.textContent=m.toUpperCase();
  const mw=document.getElementById('modeWord'); if(mw) mw.textContent=m.toUpperCase();
  const ot=document.getElementById('orbTitle'); if(ot) ot.textContent=(m==='jarvis'?'HOLO-SUN • JARVIS':m==='friday'?'HOLO-SUN • FRIDAY':'HOLO-SUN • ULTRON');
  const hs=document.getElementById('hudState'); if(hs) hs.textContent=m.toUpperCase()+' • STANDBY';
  const meta=document.querySelector('meta[name="theme-color"]'); if(meta) meta.content='#'+pColors[m];
  const dt=document.getElementById('dotText'); if(dt) dt.textContent=m.toUpperCase();
  log('режим '+m);
  if(scene3d) buildParticleSun();
  if(speak){ addMsg('bot', m==='jarvis'?'🇬🇧 JARVIS включён, сэр Амин.':'FRIDAY на связи!'+(m==='ultron'?' ULTRON проснулся.':'')); speakText(greetings[m]); }
}
let rot=0, scale=1;
function switchTab(which){
  const map={chat:'pane-chat', code:'pane-code', image:'pane-image', video:'pane-video', analysis:'pane-analysis', legion:'pane-legion', quest:'pane-quest'};
  const tabMap={chat:'t-chat', code:'t-code', image:'t-image', video:'t-video', analysis:'t-analysis', legion:'t-legion', quest:'t-quest'};
  document.querySelectorAll('.pane').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(b=>b.classList.remove('active'));
  const paneId=map[which]||('pane-'+which);
  const tabId=tabMap[which]||('t-'+which);
  const pane=document.getElementById(paneId); if(pane){ pane.classList.add('active'); setTimeout(()=>{ const card=pane.closest('.card'); if(card) card.scrollIntoView({behavior:'smooth', block:'start'}); },120); }
  const tab=document.getElementById(tabId); if(tab) tab.classList.add('active');
  log('tab '+which);
}
function addMsg(role, text){
  const list=document.getElementById('msgs'); if(!list) return;
  const div=document.createElement('div'); div.className='msg '+(role==='user'?'user':role==='sys'?'sys':'bot');
  div.textContent=text; list.appendChild(div); list.scrollTop=list.scrollHeight;
}
function quick(t){ document.getElementById('inp').value=t; send(); }
function getKey(){ return localStorage.getItem('agnes_key')||''; }
function saveAgnes(){ const k=document.getElementById('agnesKey').value.trim(); if(!k) return alert('Вставь sk-...'); localStorage.setItem('agnes_key',k); document.getElementById('agnesStat').textContent='сохранён ✓'; testAgnes(); log('agnes saved'); }
function clearAgnes(){ localStorage.removeItem('agnes_key'); document.getElementById('agnesKey').value=''; document.getElementById('agnesStat').textContent='нет ключа'; }
async function testAgnes(){
  const k=getKey()||document.getElementById('agnesKey').value.trim();
  if(!k){ document.getElementById('agnesStat').textContent='нет ключа'; return; }
  document.getElementById('agnesStat').textContent='проверка...';
  try{
    const r=await aiFetch('https://apihub.agnes-ai.com/v1/chat/completions',{method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+k}, body: JSON.stringify({model:'agnes-2.5-flash', messages:[{role:'user',content:'hi'}], max_tokens:5})});
    document.getElementById('agnesStat').textContent=r.ok?'Agnes OK ✓ (agnes-2.5-flash)':'ошибка '+r.status;
  }catch(e){ document.getElementById('agnesStat').textContent='ошибка '+e.message; }
}
document.getElementById('agnesKey').value=getKey()||'';
if(getKey()){testAgnes();}else{document.getElementById('agnesStat').textContent='вставь ключ 🔑';}
let voices=[]; function loadVoices(){ try{ voices=speechSynthesis.getVoices(); }catch{} }
speechSynthesis.onvoiceschanged=loadVoices; loadVoices(); setTimeout(loadVoices,600);
function pickVoice(mode, text){
  const isRu=/[а-яё]/i.test(text||'');
  if(!voices.length) try{ voices=speechSynthesis.getVoices(); }catch{}
  if(mode==='ultron') return voices.find(v=>v.lang.toLowerCase().includes('ru'))||voices.find(v=>v.lang.includes('en-US'))||voices[0];
  if(mode==='friday') return voices.find(v=>/female/i.test(v.name)&&v.lang.includes('en'))||voices.find(v=>v.lang.includes('en-GB'))||voices.find(v=>v.lang.includes('en'))||voices[0];
  return voices.find(v=>v.lang.includes('en-GB'))||voices.find(v=>v.lang.includes('en'))||voices[0];
}
let speaking=false;
function speakText(text){
  if(!document.getElementById('voiceToggle')?.checked) return;
  queueVoice(text, currentMode);
}
function unlockAudio(force){ if(force) { try{ const a=new SpeechSynthesisUtterance(' '); a.volume=0; speechSynthesis.speak(a); }catch{} } document.addEventListener('click', ()=>{ try{ speechSynthesis.getVoices(); }catch{} }, {once:true});
  document.addEventListener('touchend', ()=>{ try{ speechSynthesis.getVoices(); }catch{} }, {once:true});
  log('audio unlocked — voices '+speechSynthesis.getVoices().length); }
async function agnesChat(prompt){
  const k=getKey(); if(!k){ addMsg('sys','🔑 Вставь ключ Agnes слева (кнопка «Получить» — бесплатно) и нажми Сохранить'); return; }
  if(/что видишь|что там/i.test(prompt) && window.lastLiveSeen){
    const last=window.lastLiveSeen;
    addMsg('bot','👁️ LIVE: '+last.text);
    try{ queueVoice(last.text.slice(0,160), currentMode); }catch{}
    return last.text;
  }
  const needSearch=/найди|поищи|интернет|гугл|сеть|ссылк/i.test(prompt);
  let webResults='';
  if(needSearch){
    addMsg('sys','🌐 Ищу в интернете: '+prompt.slice(0,50)+'…');
    try{ webResults=await webSearch(prompt); if(webResults&&webResults!=='поиск недоступен') addMsg('sys','🌐 Нашёл:\n'+webResults.slice(0,400)); }catch(e){}
  }
  const P=(typeof PERSONAS!=='undefined'&&PERSONAS[currentMode])||{sys:'Ты '+currentMode.toUpperCase()+' для Амина. Отвечай по-русски, живо, по делу.'};
  const sys=enrichSys(P.sys+(webResults?'\n\nРезультаты веб-поиска (используй их в ответе):\n'+webResults.slice(0,3000):''));
  addMsg('user', prompt);
  try{ ChatHist.push('user',prompt); }catch{}
  const list=document.getElementById('msgs');
  const div=document.createElement('div'); div.className='msg bot'; div.textContent='▌'; list.appendChild(div); list.scrollTop=list.scrollHeight;
  let full='', spoken=0;
  const speakNew=()=>{
    try{
      const rest=full.slice(spoken);
      const parts=rest.split(/([.!?…]["»)]?\s+)/);
      let consumed=0;
      for(let i=0;i+1<parts.length;i+=2){
        const s=(parts[i]+(parts[i+1]||'')).trim();
        consumed+=parts[i].length+(parts[i+1]||'').length;
        if(s.length>2){ try{ queueVoice(s, currentMode); }catch{} }
      }
      spoken+=consumed;
    }catch{}
  };
  try{
    const hist=(typeof ChatHist!=='undefined')?ChatHist.forAPI():[{role:'user',content:prompt}];
    const done=await aiStreamChat({messages:[{role:'system',content:sys},...hist],max_tokens:900,temperature:0.62,
      onToken:(t)=>{ full+=t; div.textContent=full; list.scrollTop=list.scrollHeight; speakNew(); }});
    if(!full&&done){ full=done; div.textContent=full; }
    full=(full||'').replace(/\{"type"\s*:\s*"search"[^}]*\}/gi,'').trim();
    if(!full&&webResults) full=webResults.slice(0,1200);
    div.textContent=full||'…';
    const rest=full.slice(spoken).trim(); if(rest){ try{ queueVoice(rest, currentMode); }catch{} }
    try{ ChatHist.push('assistant',full); }catch{}
    if(/создай|сгенери.*код|сделай.*файл/i.test(prompt)&&full.includes('```')){
      const m=full.match(/```(?:\w+)?\n([\s\S]*?)```/);
      if(m){
        const code=m[1];
        if(code.includes('<!DOCTYPE')||code.includes('<html')){
          document.getElementById('codeOut').value=code;
          document.getElementById('codePreview').srcdoc=code;
          addMsg('sys','💻 Код создан и в превью — смотри Кодинг');
          switchTab('code');
        }
      }
    }
    setEngine('Agnes 2.5-flash');
    return full;
  }catch(e){ div.textContent='❌ '+e.message; try{ ChatHist.pop(); }catch{} setEngine('Agnes 2.5-flash'); }
}
async function send(){
  const inp=document.getElementById('inp'); const val=inp.value.trim(); if(!val) return;
  const low=val.toLowerCase();
  inp.value='';
  if(low.includes('нарисуй')||low.includes('сгенери')&&low.includes('картин')){ switchTab('image'); document.getElementById('imgPrompt2').value=val; genImg2(); return; }
  if(low.includes('видео')||low.includes('сделай видео')){ switchTab('video'); document.getElementById('vidPrompt2').value=val; genVid2(); return; }
  if(low.includes('код')||low.includes('сделай сайт')||low.includes('лендинг')){ switchTab('code'); document.getElementById('codePrompt').value=val; genCode(); return; }
  if(low.includes('анализ')||low.includes('проанализируй')){ switchTab('analysis'); return; }
  agnesChat(val);
}
document.getElementById('inp').addEventListener('keydown', e=>{ if(e.key==='Enter') send(); });

// MIC
let rec=null, micActive=false;
async function toggleMic(){
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!SR) return addMsg('sys','Микрофон не поддерживается — используй Chrome');
  if(micActive){ try{ rec.stop(); }catch{} return; }
  // WAKE и Слушать не могут вместе — паузим WAKE
  let wasWake=false;
  if(typeof wakeActive !== 'undefined' && wakeActive){
    wasWake=true;
    try{ if(wakeRec) wakeRec.stop(); }catch{}
    wakeActive=false;
    log('WAKE paused for mic');
  }
  try{
    const perm=await navigator.mediaDevices.getUserMedia({audio:true});
    perm.getTracks().forEach(t=>t.stop());
  }catch(e){ log('mic perm '+e.message); }
  rec=new SR(); rec.lang='ru-RU'; rec.continuous=false; rec.interimResults=false;
  rec.onstart=()=>{ micActive=true; document.getElementById('micBtn').classList.add('primary'); document.getElementById('hudState').textContent=currentMode.toUpperCase()+' • LISTENING'; log('mic on'); };
  rec.onend=()=>{
    micActive=false; document.getElementById('micBtn').classList.remove('primary'); document.getElementById('hudState').textContent=currentMode.toUpperCase()+' • STANDBY';
    if(wasWake){
      // Resume WAKE after mic done
      setTimeout(()=>{ try{ initWake(); }catch{} }, 600);
      log('WAKE resumed after mic');
    }
  };
  rec.onresult=(e)=>{ const t=e.results[0][0].transcript; document.getElementById('inp').value=t; send(); };
  rec.onerror=(e)=>{
    if(e.error==='aborted' || e.error==='no-speech'){
      log('mic '+e.error+' — ignore');
      micActive=false;
      document.getElementById('micBtn').classList.remove('primary');
      if(wasWake) setTimeout(()=>{ try{ initWake(); }catch{} }, 600);
      return;
    }
    addMsg('sys','Mic error '+e.error); micActive=false;
    if(wasWake) setTimeout(()=>{ try{ initWake(); }catch{} }, 800);
  };
  rec.start();
}

// CAM + HANDS
let camStream=null, hands=null, camera=null, handActive=false, lastPinchDist=0;
async function toggleCam(){
  const v=document.getElementById('cam'), off=document.getElementById('faceOff'), btn=document.getElementById('camBtn');
  if(camStream){
    try{ if(camera) camera.stop(); }catch{} try{ if(hands) hands.close(); }catch{}
    camStream.getTracks().forEach(t=>t.stop()); camStream=null; v.srcObject=null;
    off.style.display='grid'; btn.textContent='📷 Камера'; document.getElementById('hudHand').textContent='HAND: OFF'; handActive=false; log('камера выкл'); return;
  }
  try{
    window._camFacing=window._camFacing||'user';
    log('запрос камеры '+window._camFacing+'...');
    camStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:window._camFacing, width:{ideal:640}, height:{ideal:480}}, audio:false});
    v.srcObject=camStream; v.style.transform=window._camFacing==='user'?'scaleX(-1)':'none'; await v.play().catch(()=>{});
    off.style.display='none'; btn.textContent='📷 Выкл';
    try{ await initHands(v); }catch(e){ log('hands fail '+e.message); }
  }catch(e){ log('камера ошибка '+e.message); document.getElementById('faceOff').innerHTML='<span style="color:#FF8A00">Нет доступа<br><span style="font-size:10px">'+e.message.slice(0,50)+'</span></span>'; document.getElementById('faceOff').style.display='grid'; }
}
async function initHands(video){
  if(!window.Hands){
    await new Promise((res,rej)=>{ const s=document.createElement('script'); s.src='https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js'; s.onload=res; s.onerror=()=>rej(new Error('hands.js fail')); document.head.appendChild(s); });
    await new Promise((res,rej)=>{ const s=document.createElement('script'); s.src='https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js'; s.onload=res; s.onerror=rej; document.head.appendChild(s); });
  }
  hands=new Hands({locateFile:(f)=>`https://cdn.jsdelivr.net/npm/@mediapipe/hands/${f}`});
  hands.setOptions({maxNumHands:1, modelComplexity:1, minDetectionConfidence:0.68, minTrackingConfidence:0.68});
  hands.onResults(onHandResults);
  camera=new Camera(video,{onFrame:async()=>{ await hands.send({image:video}); }, width:640, height:480});
  camera.start(); log('hands on');
}
async function flipCam(){
  window._camFacing = window._camFacing==='user' ? 'environment' : 'user';
  const v=document.getElementById('cam');
  const btn=document.getElementById('flipBtn');
  if(btn) btn.textContent = window._camFacing==='environment' ? '🤳 Фронт' : '🔄 Зад';
  log('flip to '+window._camFacing);
  // Properly restart camera with new facingMode
  if(camStream || (v && v.srcObject)){
    await toggleCam(); // off
    await new Promise(r=>setTimeout(r, 400));
    await toggleCam(); // on with new facing
  } else {
    // Just set transform for next start
    if(v) v.style.transform = window._camFacing==='user' ? 'scaleX(-1)' : 'none';
  }
  // If LIVE is on, restart it with rear
  if(typeof liveVisionActive !== 'undefined' && liveVisionActive){
    stopLiveVision(); setTimeout(()=>startLiveVision(), 800);
  }
}

function drawFaceFrame(ctx, box){ ctx.strokeStyle=getComputedStyle(document.body).getPropertyValue('--accent'); ctx.lineWidth=2; ctx.strokeRect(4,4,box.clientWidth-8,box.clientHeight-8); }
function onHandResults(res){
  const canvas=document.getElementById('faceOv'), ctx=canvas.getContext('2d');
  const box=document.getElementById('faceBox');
  canvas.width=box.clientWidth*2; canvas.height=box.clientHeight*2;
  ctx.clearRect(0,0,canvas.width,canvas.height); ctx.setTransform(2,0,0,2,0,0);
  if(!document.getElementById('gestureToggle').checked){ drawFaceFrame(ctx, box); handActive=false; return; }
  if(res.multiHandLandmarks && res.multiHandLandmarks.length>0){
    handActive=true;
    const lm=res.multiHandLandmarks[0];
    const conn=window.HAND_CONNECTIONS||[]; ctx.strokeStyle=getComputedStyle(document.body).getPropertyValue('--accent'); ctx.lineWidth=2;
    for(const c of conn){ const a=lm[c[0]], b=lm[c[1]]; ctx.beginPath(); ctx.moveTo(a.x*box.clientWidth, a.y*box.clientHeight); ctx.lineTo(b.x*box.clientWidth, b.y*box.clientHeight); ctx.stroke(); }
    ctx.fillStyle='white'; lm.forEach(p=>{ ctx.beginPath(); ctx.arc(p.x*box.clientWidth, p.y*box.clientHeight, 3,0,Math.PI*2); ctx.fill(); });
    const th=lm[4], ix=lm[8], wr=lm[0], mid=lm[9];
    const dist=Math.hypot(th.x-ix.x, th.y-ix.y);
    const oneUp = lm[8].y < lm[6].y && lm[12].y > lm[10].y && lm[16].y > lm[14].y && lm[20].y > lm[18].y;
    const twoFingers = lm[8].y < lm[6].y && lm[12].y < lm[10].y && lm[16].y > lm[14].y && lm[20].y > lm[18].y;
    window.handControl3d=window.handControl3d||{pinching:false, oneFingerUp:false, twoFingers:false, dx:0, dy:0, lastX:0, lastY:0};
    window.handControl3d.oneFingerUp=oneUp; window.handControl3d.twoFingers=twoFingers; window.handControl3d.pinching=dist<0.05;
    if(oneUp) document.getElementById('hudHand').textContent='HAND: ☝️ ВВЕРХ';
    else if(twoFingers) document.getElementById('hudHand').textContent='HAND: ✌️ СВАЙП';
    else if(dist<0.05) document.getElementById('hudHand').textContent='HAND: PINCH';
    else document.getElementById('hudHand').textContent='HAND: ON';
    const cx=mid.x, cy=mid.y;
    if(window.handControl3d.lastX){ window.handControl3d.dx=(cx-window.handControl3d.lastX)*18; window.handControl3d.dy=(cy-window.handControl3d.lastY)*18; } else window.handControl3d.dx=0, window.handControl3d.dy=0;
    window.handControl3d.lastX=cx; window.handControl3d.lastY=cy;
    if(dist<0.05){ if(lastPinchDist===0) lastPinchDist=dist; const d=(dist-lastPinchDist); scale=Math.max(0.6,Math.min(1.7, scale - d*4)); document.getElementById('hudHand').textContent='HAND: PINCH'; }
    else lastPinchDist=0;
    const angle=Math.atan2(mid.y-wr.y, mid.x-wr.x); rot+= (angle*0.02);
    // sun control via handControl3d handled in animateSun
  } else { handActive=false; document.getElementById('hudHand').textContent='HAND: OFF'; if(window.handControl3d){ window.handControl3d.pinching=false; window.handControl3d.oneFingerUp=false; window.handControl3d.twoFingers=false; } drawFaceFrame(ctx, box); }
}

// CODING — fast single + 1 quick continue
async function genCode(){
  const prompt=document.getElementById('codePrompt').value.trim();
  const lang=document.getElementById('codeLang').value;
  if(!prompt) return addMsg('sys','💻 Напиши что накодить');
  const k=getKey(); if(!k) return addMsg('sys','🔑 Ключ');
  const sys=`Ты — топ-кодер Opus 4.7, Agnes 2.5-flash. Пиши ПОЛНЫЙ рабочий файл без // ... без обрыва. Язык ${lang}. Если html — один файл с <style> и <script> внутри, до </html>. Отвечай ТОЛЬКО кодом в \`\`\` блоке.`;
  document.getElementById('codeStat').textContent='⏳ Генерю (быстро)...';
  log('coding '+lang);
  try{
    const r=await aiFetch('https://apihub.agnes-ai.com/v1/chat/completions',{method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+k}, body: JSON.stringify({model:'agnes-2.5-flash', messages:[{role:'system',content:sys},{role:'user',content:prompt}], max_tokens:8000, temperature:0.28})});
    const j=await r.json(); if(!r.ok) throw new Error(j.error?.message||r.status);
    let txt=(j.choices?.[0]?.message?.content||'').trim();
    const finish=j.choices?.[0]?.finish_reason;
    if(finish==='length'){
      log('length — быстрая доклейка');
      try{
        const r2=await aiFetch('https://apihub.agnes-ai.com/v1/chat/completions',{method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+k}, body: JSON.stringify({model:'agnes-2.5-flash', messages:[{role:'system',content:sys},{role:'user',content:prompt},{role:'assistant',content:txt},{role:'user',content:'Продолжи с места обрыва, не повторяй, заверши до </html>'}], max_tokens:4000})});
        const j2=await r2.json(); if(r2.ok){ let add=(j2.choices?.[0]?.message?.content||'').trim(); const m2=add.match(/```(?:\w+)?\n([\s\S]*?)```/); if(m2) add=m2[1].trim(); else add=add.replace(/^```\w*\n?/,'').replace(/```$/,'').trim(); txt+='\n'+add; }
      }catch{}
    }
    const m=txt.match(/```(?:\w+)?\n([\s\S]*?)```/); if(m) txt=m[1].trim(); else txt=txt.replace(/^```\w*\n?/,'').replace(/```$/,'').trim();
    if(txt.length<60) return document.getElementById('codeStat').textContent='⚠️ Пусто';
    document.getElementById('codeOut').value=txt;
    document.getElementById('codeLen').textContent=txt.length+' симв';
    document.getElementById('codeStat').textContent='✅ Готово ('+txt.length+' симв)';
    log('code done '+txt.length);
    if(txt.includes('<!DOCTYPE')||txt.includes('<html')||lang==='html'){ document.getElementById('codePreview').srcdoc=txt; document.getElementById('codeConsole').textContent='превью обновлено • '+new Date().toLocaleTimeString(); }
    addProject('code', prompt);
  }catch(e){ document.getElementById('codeStat').textContent='Ошибка '+e.message; }
}
function runCode(){
  const code=document.getElementById('codeOut').value; const lang=document.getElementById('codeLang').value; const con=document.getElementById('codeConsole');
  try{
    if(lang==='html'||code.includes('<!DOCTYPE')||code.includes('<html')){ document.getElementById('codePreview').srcdoc=code; con.textContent='▶️ HTML запущен'; }
    else if(lang==='javascript'){ let out=''; const old=console.log; console.log=(...a)=>{ out+=a.join(' ')+'\n'; old(...a); }; try{ const r=Function(code)(); con.textContent='▶️\n'+out+(r!==undefined?String(r):''); }catch(err){ con.textContent='❌ '+err.message; } console.log=old; }
    else con.textContent='ℹ️ Для '+lang+' скопируй код';
  }catch(e){ con.textContent='❌ '+e.message; }
}
function copyCode(){ navigator.clipboard.writeText(document.getElementById('codeOut').value); log('копи'); addMsg('sys','📋 Скопирован'); }
function downloadCode(){ const code=document.getElementById('codeOut').value; const lang=document.getElementById('codeLang').value; const ext={html:'html',javascript:'js',python:'py',react:'jsx',vue:'vue',nextjs:'js',php:'php'}[lang]||'txt'; const blob=new Blob([code],{type:'text/plain'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='amin-'+Date.now()+'.'+ext; a.click(); URL.revokeObjectURL(url); }
function formatCode(){ const el=document.getElementById('codeOut'); el.value=el.value.replace(/;(?!\n)/g,';\n').replace(/{/g,'{\n').replace(/}/g,'\n}'); }
function openPreview(){ const code=document.getElementById('codeOut').value; if(!code.trim()) return; const w=window.open('','_blank'); if(!w) return addMsg('sys','❌ Попап'); w.document.open(); w.document.write(code); w.document.close(); }
function openLocalhost(){ const code=document.getElementById('codeOut').value; if(!code.trim()) return; const blob=new Blob([code],{type:'text/html'}); const url=URL.createObjectURL(blob); window.open(url,'_blank'); setTimeout(()=>URL.revokeObjectURL(url),60000); }

// IMAGE / VIDEO
let imgHistory=JSON.parse(localStorage.getItem('amin_img_hist')||'[]');
function renderImgHist(){ const g=document.getElementById('imgGrid'); if(!g) return; g.innerHTML=imgHistory.slice(0,12).map(o=>`<div style="border:1px solid var(--line);border-radius:10px;overflow:hidden;background:#000"><img src="${o.url}" style="width:100%;display:block"><div style="padding:6px;font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${o.prompt.slice(0,40)}</div></div>`).join('')||'<span style="color:var(--muted);font-size:11px">история пуста</span>'; }
renderImgHist();
async function genImg2(){
  const prompt=document.getElementById('imgPrompt2').value.trim(); if(!prompt) return addMsg('sys','🎨 Промпт');
  const size=document.getElementById('imgSize').value; const k=getKey(); if(!k) return addMsg('sys','🔑 Ключ');
  addMsg('bot','🎨 Рисую: '+prompt.slice(0,60)); log('img '+prompt.slice(0,30));
  try{
    let url=null, lastErr=null;
    for(let model of ['agnes-image-2.1','agnes-image-2.5-flash','agnes-image-2.0-flash','agnes-image-2.1-flash']){
      try{
        const r=await aiFetch('https://apihub.agnes-ai.com/v1/images/generations',{method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+k}, body: JSON.stringify({model, prompt, size, n:1})});
        const j=await r.json(); if(!r.ok) throw new Error(j.error?.message||r.status);
        const u=j.data?.[0]?.url; if(!u) throw new Error('no url');
        url=u; log('img ok via '+model); break;
      }catch(e){ lastErr=e; log('img '+e.message+' try next'); continue; }
    }
    if(!url) throw lastErr||new Error('no channel');
    imgHistory.unshift({prompt, url, ts:Date.now()}); localStorage.setItem('amin_img_hist', JSON.stringify(imgHistory.slice(0,20))); renderImgHist();
    document.getElementById('imgBox').style.display='block'; document.getElementById('genImg').src=url; document.getElementById('imgCap').textContent=prompt;
    addMsg('bot','✅ Готово'); speakText('Готово, Амин.'); addProject('image', prompt);
  }catch(e){ addMsg('sys','Ошибка изо: '+e.message); }
}
async function genVid2(){
  const prompt=document.getElementById('vidPrompt2').value.trim(); if(!prompt) return addMsg('sys','🎬 Промпт');
  const k=getKey(); if(!k) return addMsg('sys','🔑 Ключ');
  addMsg('bot','🎬 Видео: '+prompt.slice(0,60)); log('vid '+prompt.slice(0,30));
  try{
    const r=await aiFetch('https://apihub.agnes-ai.com/v1/videos/generations',{method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+k}, body: JSON.stringify({model:'agnes-video-v2.0', prompt, duration:5})});
    const j=await r.json(); if(!r.ok) throw new Error(j.error?.message||r.status);
    const id=j.video_id||j.id; const box=document.getElementById('vidList'); const div=document.createElement('div'); div.style.cssText='padding:10px;border:1px solid var(--line);border-radius:10px;background:rgba(255,255,255,.04)'; div.innerHTML=`<div style="font-family:'JetBrains Mono',monospace;font-size:11px" id="vid-${id}">⏳ ${id} — queued</div>`; box.prepend(div);
    let tries=0; const iv=setInterval(async()=>{
      tries++;
      try{
        const pr=await aiFetch('https://apihub.agnes-ai.com/v1/videos/'+id,{headers:{'Authorization':'Bearer '+k}});
        const pj=await pr.json();
        if(pj.status==='completed'&&pj.video_url){ clearInterval(iv); document.getElementById('vid-'+id).innerHTML=`✅ <video src="${pj.video_url}" controls style="width:100%;border-radius:8px;margin-top:6px"></video><div style="font-size:11px;margin-top:4px">${prompt}</div>`; addProject('video', prompt); }
        else if(pj.status==='failed'){ clearInterval(iv); document.getElementById('vid-'+id).textContent='❌ Ошибка'; }
        else if(tries>45){ clearInterval(iv); document.getElementById('vid-'+id).textContent='⏳ Долго — '+id; }
        else document.getElementById('vid-'+id).textContent='⏳ '+(pj.status||'queued')+' ('+tries+'/45)';
      }catch{}
    },4000);
  }catch(e){ addMsg('sys','Ошибка видео: '+e.message); }
}

// ===== WAVE-1: helpers (в V13 отсутствовали → ReferenceError) =====
let lastAnalysisContext=null;
function compressImage(dataUrl,maxSide){
  maxSide=maxSide||1024;
  return new Promise((res)=>{
    try{
      const img=new Image();
      img.onload=()=>{ try{ const s=Math.min(1,maxSide/Math.max(img.width||1,img.height||1)); const c=document.createElement('canvas'); c.width=Math.max(1,Math.round(img.width*s)); c.height=Math.max(1,Math.round(img.height*s)); c.getContext('2d').drawImage(img,0,0,c.width,c.height); res(c.toDataURL('image/jpeg',0.82)); }catch(e){ res(dataUrl); } };
      img.onerror=()=>res(dataUrl);
      img.src=dataUrl;
    }catch(e){ res(dataUrl); }
  });
}
async function sendAnalysisChat(){
  const inp=document.getElementById('analysisChatInput'); const q=(inp.value||'').trim(); if(!q) return; inp.value='';
  const out=document.getElementById('analysisChatOut'); const k=getKey(); if(!k) return addMsg('sys','🔑 Ключ');
  const esc=(s)=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const qd=document.createElement('div'); qd.style.cssText='padding:8px 10px;border-radius:10px;border:1px solid var(--line);background:rgba(255,255,255,.05)'; qd.innerHTML='<b style="color:var(--accent)">Ты:</b> '+esc(q); out.appendChild(qd);
  const ad=document.createElement('div'); ad.style.cssText='padding:8px 10px;border-radius:10px;border:1px solid var(--line);background:rgba(0,0,0,.3)'; ad.textContent='⏳ Думаю…'; out.appendChild(ad);
  try{
    const ctx=lastAnalysisContext;
    const ctxTxt=ctx?('Файл: '+ctx.fileName+' • '+(ctx.N||1)+' кадров.\nИТОГ:\n'+(ctx.finalTxt||'')+'\nПОКАДРОВО:\n'+(ctx.perFrameTexts||[]).map(p=>'Кадр '+(p.idx+1)+' @'+(p.ts||0)+'с: '+p.txt).join('\n').slice(0,4000)):'Анализ ещё не запускался — попроси пользователя сначала выбрать файл.';
    const r=await aiFetch('https://apihub.agnes-ai.com/v1/chat/completions',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+k},body:JSON.stringify({model:'agnes-2.5-flash',messages:[{role:'system',content:enrichSys('Ты — аналитик JARVIS. Отвечай на вопросы по последнему анализу файла. Коротко и точно, по-русски.')},{role:'user',content:'Контекст анализа:\n'+ctxTxt+'\n\nВопрос: '+q}],max_tokens:600,temperature:0.4})});
    const j=await r.json(); if(!r.ok) throw new Error((j.error&&j.error.message)||r.status);
    const txt=(j.choices&&j.choices[0]&&j.choices[0].message&&j.choices[0].message.content||'').trim()||'…';
    ad.innerHTML='<b style="color:var(--accent)">JARVIS:</b> '+esc(txt);
  }catch(e){ ad.textContent='❌ '+e.message; }
}

// MEMORY
const MEM_KEY='jarvis_memory_v2';
function loadMemory(){ try{ return JSON.parse(localStorage.getItem(MEM_KEY)||'{"name":"Амин","persona":"jarvis","projects":[]}'); }catch{ return {name:'Амин',persona:'jarvis',projects:[]}; } }
function saveMemory(m){ localStorage.setItem(MEM_KEY, JSON.stringify(m)); renderMemory(); }
function addProject(type, prompt){ const m=loadMemory(); m.projects.unshift({type, prompt:prompt.slice(0,120), ts:Date.now(), persona:currentMode}); if(m.projects.length>36) m.projects=m.projects.slice(0,36); m.persona=currentMode; saveMemory(m); }
function renderMemory(){
  const m=loadMemory(); const pan=document.getElementById('memoryPanel'); const stat=document.getElementById('memoryStat'); if(!pan) return;
  if(!m.projects.length){ pan.innerHTML='<div style="font-size:10px;color:var(--muted);padding:6px;border:1px dashed var(--line);border-radius:8px">Пока пусто — сгенери код/картинку/видео</div>'; if(stat) stat.textContent='Помню '+m.name+' • 0 проектов'; return; }
  pan.innerHTML=m.projects.slice(0,10).map(p=>{ const ic=p.type==='code'?'💻':p.type==='image'?'🎨':p.type==='video'?'🎬':'💬'; const d=new Date(p.ts).toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'}); return `<div style="display:flex;gap:8px;align-items:center;padding:6px 8px;border-radius:10px;background:rgba(255,255,255,.04);border:1px solid var(--line);cursor:pointer" onclick="recallProject('${p.type}','${p.prompt.replace(/'/g,"\\'")}')"><span>${ic}</span><div style="flex:1;min-width:0"><div style="font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${p.prompt}</div><div style="font-size:9px;color:var(--muted)">${p.type} • ${p.persona} • ${d}</div></div></div>`; }).join('');
  if(stat) stat.textContent='Помню '+m.name+' • '+m.projects.length+' проектов • '+m.persona.toUpperCase();
}
function clearMemory(){ if(!confirm('Очистить?')) return; localStorage.removeItem(MEM_KEY); renderMemory(); addMsg('sys','🧠 Очищена'); }
function exportMemory(){ const m=loadMemory(); const blob=new Blob([JSON.stringify(m,null,2)],{type:'application/json'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='jarvis-memory.json'; a.click(); setTimeout(()=>URL.revokeObjectURL(url),2000); }
function recallProject(type, prompt){ if(type==='code'){ switchTab('code'); document.getElementById('codePrompt').value=prompt; } if(type==='image'){ switchTab('image'); document.getElementById('imgPrompt2').value=prompt; } if(type==='video'){ switchTab('video'); document.getElementById('vidPrompt2').value=prompt; } }
setTimeout(renderMemory, 800);
function loadAboutMe(){ const v=localStorage.getItem('aboutMe'); if(v) document.getElementById('aboutMe').value=v; return v||''; }
function saveAboutMe(){ const v=document.getElementById('aboutMe').value.trim(); localStorage.setItem('aboutMe', v); addProject('about', v.slice(0,60)); addMsg('sys','👤 Запомнил'); log('about saved'); }
setTimeout(loadAboutMe, 700);
function enrichSys(base){ const about=localStorage.getItem('aboutMe')||''; const mem=loadMemory(); const recent=mem.projects.slice(0,3).map(p=>p.prompt).join(' | '); return base + (about? `\nО Амине: ${about}`:'') + (recent? `\nНедавние: ${recent}`:'') + `\nБудь живым, инициативным, как ${currentMode}.`; }

// SUN — PARTICLES (big yellow)
let scene3d, cam3d, ren3d, sunGroup, sunPoints, raf3d=null;
let handControl={pinching:false, oneFingerUp:false, twoFingers:false, dx:0, dy:0, lastX:0, lastY:0};
window.handControl3d=handControl;
function initHolo3D(){
  const canvas=document.getElementById('holo3d'); const stage=document.getElementById('stage');
  if(!canvas||!stage||!window.THREE){ log('3D: no THREE'); return; }
  try{
    scene3d=new THREE.Scene();
    cam3d=new THREE.PerspectiveCamera(46, stage.clientWidth/stage.clientHeight, 0.1, 100); cam3d.position.set(0,0,2.9);
    ren3d=new THREE.WebGLRenderer({canvas, alpha:true, antialias:true}); ren3d.setPixelRatio(Math.min(2,window.devicePixelRatio||1)); ren3d.setSize(stage.clientWidth, stage.clientHeight); ren3d.setClearColor(0x000000,0);
    const amb=new THREE.AmbientLight(0xffffff, 0.9); scene3d.add(amb);
    const sunLight=new THREE.PointLight(0xffb84d, 2.4, 10); sunLight.position.set(0,0,0); scene3d.add(sunLight);
    buildParticleSun();
    let drag=false, lx=0, ly=0;
    canvas.addEventListener('pointerdown', e=>{drag=true; lx=e.clientX; ly=e.clientY; canvas.setPointerCapture(e.pointerId)});
    canvas.addEventListener('pointerup', ()=>drag=false);
    canvas.addEventListener('pointermove', e=>{ if(drag&&sunGroup){ const dx=e.clientX-lx, dy=e.clientY-ly; sunGroup.rotation.y+=dx*0.009; sunGroup.rotation.x+=dy*0.005; sunGroup.rotation.x=Math.max(-0.6,Math.min(0.6,sunGroup.rotation.x)); lx=e.clientX; ly=e.clientY; }});
    canvas.addEventListener('wheel', e=>{ const s=Math.max(0.6,Math.min(1.8,sunGroup.scale.x + e.deltaY*-0.0012)); sunGroup.scale.set(s,s,s); e.preventDefault(); },{passive:false});
    canvas.addEventListener('click', ()=>toggleSunBurst());
    window.addEventListener('resize', ()=>{ const r=stage.getBoundingClientRect(); cam3d.aspect=r.width/r.height; cam3d.updateProjectionMatrix(); ren3d.setSize(r.width,r.height); });
    animateSun(); log('SUN ready — 3400 частиц');
  }catch(e){ log('sun fail '+e.message); }
}
function buildParticleSun(){
  if(!scene3d) return; if(sunGroup) scene3d.remove(sunGroup);
  sunGroup=new THREE.Group(); window.sunGroup=sunGroup; scene3d.add(sunGroup);
  const count=3600;
  const geo=new THREE.BufferGeometry();
  const pos=new Float32Array(count*3), col=new Float32Array(count*3);
  for(let i=0;i<count;i++){
    const phi=Math.acos(1-2*Math.random()), theta=Math.random()*Math.PI*2, r=0.82+Math.random()*0.44;
    pos[i*3]=r*Math.sin(phi)*Math.cos(theta); pos[i*3+1]=r*Math.sin(phi)*Math.sin(theta); pos[i*3+2]=r*Math.cos(phi);
    const d=r;
    if(d<0.95){ col[i*3]=1; col[i*3+1]=0.82; col[i*3+2]=0.18; }
    else if(d<1.08){ col[i*3]=1; col[i*3+1]=0.56; col[i*3+2]=0.08; }
    else { col[i*3]=1; col[i*3+1]=0.34; col[i*3+2]=0.06; }
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos,3));
  geo.setAttribute('color', new THREE.BufferAttribute(col,3));
  const mat=new THREE.PointsMaterial({size:0.045, vertexColors:true, transparent:true, opacity:1, blending:THREE.AdditiveBlending, depthWrite:false, sizeAttenuation:true});
  sunPoints=new THREE.Points(geo, mat); sunGroup.add(sunPoints);
  for(let r=1.32; r<1.6; r+=0.09){
    const ring=new THREE.Mesh(new THREE.RingGeometry(r*0.96, r, 64), new THREE.MeshBasicMaterial({color:0xff8a1a, transparent:true, opacity:0.08 - (r-1.32)*0.12, side:THREE.DoubleSide, blending:THREE.AdditiveBlending}));
    ring.rotation.x=Math.PI/2 + (Math.random()-0.5)*0.2; ring.userData.baseR=r; sunGroup.add(ring);
  }
  const core=new THREE.Mesh(new THREE.SphereGeometry(0.58,32,32), new THREE.MeshBasicMaterial({color:0xffd54f, transparent:true, opacity:0.38, blending:THREE.AdditiveBlending}));
  sunGroup.add(core);
  document.getElementById('disBadge').textContent='☀️ SUN • PARTICLES';
}
function animateSun(){
  if(!scene3d||!ren3d) return; raf3d=requestAnimationFrame(animateSun);
  const t=Date.now()*0.001;
  if(sunGroup){
    if(!handControl.pinching && !handControl.twoFingers){ sunGroup.rotation.y+=0.0016; sunGroup.rotation.z=Math.sin(t*0.2)*0.03; }
    if(handControl.pinching){ sunGroup.rotation.y+=handControl.dx*0.012; const s=Math.max(0.6,Math.min(1.8,sunGroup.scale.x+handControl.dy*0.004)); sunGroup.scale.set(s,s,s); }
    if(handControl.twoFingers){ sunGroup.position.x+=handControl.dx*0.006; sunGroup.position.y+=handControl.dy*0.006; }
    if(handControl.oneFingerUp){ sunGroup.position.y+=0.007; }
    sunGroup.children.forEach((ch,i)=>{ if(ch.geometry&&ch.geometry.type==='RingGeometry'){ ch.rotation.z+=0.001*(i+1); ch.material.opacity=0.08 - (ch.userData.baseR-1.32)*0.12 + Math.sin(t*1.2+i)*0.015; }});
    if(sunPoints) sunPoints.material.opacity=0.88+Math.sin(t*0.9)*0.06;
  }
  ren3d.render(scene3d, cam3d);
}
let sunBurst=false;
function toggleSunBurst(){
  if(!sunGroup) return; sunBurst=!sunBurst;
  const badge=document.getElementById('disBadge');
  if(sunBurst){
    if(badge) badge.textContent='☀️ ВСПЫШКА';
    sunGroup.children.forEach(ch=>{
      if(!ch.userData.orig) ch.userData.orig={p:ch.position.clone(), s:ch.scale.clone()};
      const off=new THREE.Vector3((Math.random()-0.5)*1.6,(Math.random()-0.5)*1.2,(Math.random()-0.5)*1.0);
      if(ch.isPoints){ const pos=ch.geometry.attributes.position; for(let i=0;i<pos.count;i++){ pos.array[i*3]+=off.x*0.2; pos.array[i*3+1]+=off.y*0.2; pos.array[i*3+2]+=off.z*0.2; } pos.needsUpdate=true; } else ch.position.add(off);
    });
    setTimeout(()=>{ if(sunBurst) toggleSunBurst(); }, 1800);
  } else {
    if(badge) badge.textContent='☀️ SUN • PARTICLES';
    sunGroup.children.forEach(ch=>{ if(ch.userData.orig){ ch.position.copy(ch.userData.orig.p); ch.scale.copy(ch.userData.orig.s); } if(ch.isPoints) buildParticleSun(); });
  }
}
async function getVideoDuration(file){
  const u=URL.createObjectURL(file);
  const v=document.createElement('video');
  v.src=u; v.muted=true; v.preload='metadata';
  await new Promise(r=>{ v.onloadedmetadata=r; v.onerror=r; setTimeout(r,2200); });
  const d=isFinite(v.duration)?v.duration:0;
  URL.revokeObjectURL(u);
  return d||0;
}
async function captureFramesPerSecond(file, maxFrames=40){
  const duration=await getVideoDuration(file);
  let N=Math.ceil(duration||0);
  if(!N || N<1) N=5;
  if(duration>60) N=40;
  else if(duration>30) N=30;
  else N=Math.min(N, 40);
  // ensure at least 5 for very short
  if(duration>0 && duration<3) N=Math.max(3, Math.ceil(duration*2));
  if(N>40) N=40;
  const interval=duration/N;
  const u=URL.createObjectURL(file);
  const v=document.createElement('video');
  v.src=u; v.muted=true; v.playsInline=true; v.preload='auto'; v.crossOrigin='anonymous';
  await new Promise(r=>{ v.onloadedmetadata=r; v.onerror=r; setTimeout(r,1500); });
  const frames=[];
  for(let i=0;i<N;i++){
    let t = interval*(i+0.5);
    if(t<0.25) t=0.25;
    if(t>duration-0.15) t=Math.max(0.25, duration-0.15);
    try{
      v.currentTime=t;
      await new Promise(r=>{ v.onseeked=r; setTimeout(r,650); });
      await new Promise(r=>setTimeout(r,60));
      const c=document.createElement('canvas'); c.width=960; c.height=540;
      const ctx=c.getContext('2d');
      try{ ctx.drawImage(v,0,0,c.width,c.height); frames.push({dataUrl:c.toDataURL('image/jpeg',0.78), ts:t}); }catch(e){ console.warn('draw',e); }
    }catch(e){ console.warn('seek',e); }
  }
  URL.revokeObjectURL(u);
  return {frames, duration};
}
async function analyzeSingleFrame(dataUrl, idx, ts, total, fileName, persona){
  const k=getKey(); if(!k) throw new Error('no key');
  const personaMode=persona||currentMode; const sys=enrichSys("Ты — аналитик "+personaMode.toUpperCase()+" для Амина ("+(personaMode==="jarvis"?"холодный британский анализ":personaMode==="friday"?"дерзкая ирландская динамика":"стратег ULTRON — риски/паттерн")+") . Рассмотри кадр "+(idx+1)+"/"+total+" видео на "+ts.toFixed(1)+"с. Опиши досконально: объекты, люди, позы, движение, стиль, паттерн этого момента. 2-3 предложения, по-русски, точно без выдумок.");
  const r=await aiFetch('https://apihub.agnes-ai.com/v1/chat/completions',{method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+k}, body: JSON.stringify({model:'agnes-2.5-flash', messages:[{role:'system',content:sys},{role:'user',content:[{type:'text',text:"Кадр "+(idx+1)+"/"+total+" @"+ts.toFixed(1)+"с видео "+fileName+" — полный разбор этого момента."},{type:'image_url',image_url:{url:dataUrl}}]}], max_tokens:480, temperature:0.36})});
  const j=await r.json(); if(!r.ok) throw new Error(j.error?.message||r.status);
  return (j.choices?.[0]?.message?.content||'').trim();
}
async function synthesizeVideo(perFrameTexts, repFrames, fileName, duration){
  const k=getKey(); if(!k) throw new Error('no key');
  const sys=enrichSys("Ты — главный аналитик JARVIS+FRIDAY+ULTRON для Амина. Тебе даны покадровые разборы "+perFrameTexts.length+" кадров видео "+fileName+" ("+Math.round(duration)+"с, 1 кадр/сек). Сделай: 1) кратко по каждому кадру (учти тексты), 2) общий паттерн — динамика, стиль боя/танца/спорта если есть, ритм, композиция, эволюция, 3) составляющую и итоговое заключение + совет. Структурировано, до 10 предложений, по-русски, будь точным, не галлюцинируй.");
  const perSummary=perFrameTexts.map(p=> "Кадр "+(p.idx+1)+" @"+p.ts.toFixed(1)+"с: "+p.txt).join("\n");
  const content=[{type:'text',text:"Видео "+fileName+" • "+Math.round(duration)+"с • "+perFrameTexts.length+" кадров (1/сек). Покадровые разборы:\n"+perSummary+"\n\nНа основе разборов + кадров ниже найди общий паттерн, стиль (бой, танец, спорт и т.д.), динамику во времени и дай заключение. Если это бой — определи стиль боя, паттерны ударов/движений."}];
  repFrames.forEach(f=> content.push({type:'image_url', image_url:{url:f.dataUrl}}));
  const r=await aiFetch('https://apihub.agnes-ai.com/v1/chat/completions',{method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+k}, body: JSON.stringify({model:'agnes-2.5-flash', messages:[{role:'system',content:sys},{role:'user',content}], max_tokens:1200, temperature:0.42})});
  const j=await r.json(); if(!r.ok) throw new Error(j.error?.message||r.status);
  return (j.choices?.[0]?.message?.content||'').trim();
}
async function handleAnalysisFile(file){
  if(!file) return;
  const k=getKey(); if(!k) return addMsg('sys','🔑 Вставь ключ');
  const stat=document.getElementById('analysisStat'), out=document.getElementById('analysisOut'), logEl=document.getElementById('analysisLog'), preview=document.getElementById('analysisPreview'), imgEl=document.getElementById('analysisImg'), vidEl=document.getElementById('analysisVid'), nameEl=document.getElementById('analysisFileName'), drop=document.getElementById('analysisDrop');
  let thumbs=document.getElementById('analysisThumbs');
  if(!thumbs){ thumbs=document.createElement('div'); thumbs.id='analysisThumbs'; thumbs.style.cssText='display:none;gap:6px;flex-wrap:wrap;margin-top:8px'; if(preview) preview.appendChild(thumbs); }
  let perFrameBox=document.getElementById('perFrameBox');
  if(!perFrameBox){ perFrameBox=document.createElement('div'); perFrameBox.id='perFrameBox'; perFrameBox.style.cssText='margin-top:10px;display:flex;flex-direction:column;gap:6px;max-height:320px;overflow:auto'; if(out) out.parentNode.insertBefore(perFrameBox, out); }
  if(stat) stat.textContent='⏳ Читаю...'; if(logEl) logEl.textContent=''; if(out) out.textContent=''; if(perFrameBox) perFrameBox.innerHTML='';
  const isImg=file.type.startsWith('image/'), isVid=file.type.startsWith('video/'), isPdf=file.name.toLowerCase().endsWith('.pdf');
  if(preview) preview.style.display='block';
  if(nameEl) nameEl.textContent=file.name+' • '+(file.size/1024/1024).toFixed(2)+'MB';
  if(isImg){ try{ if(imgEl._obj) URL.revokeObjectURL(imgEl._obj);}catch{} const u=URL.createObjectURL(file); imgEl._obj=u; imgEl.src=u; imgEl.style.display='block'; vidEl.style.display='none'; thumbs.style.display='none'; }
  else if(isVid){ try{ if(vidEl._obj) URL.revokeObjectURL(vidEl._obj);}catch{} const u=URL.createObjectURL(file); vidEl._obj=u; vidEl.src=u; vidEl.style.display='block'; imgEl.style.display='none'; }
  else { imgEl.style.display='none'; vidEl.style.display='none'; thumbs.style.display='none'; }
  if(drop) drop.style.borderColor='var(--accent)';
  try{
    let textContent='';
    if(isImg){
      const reader=new FileReader(); let dataUrl=await new Promise((res,rej)=>{ reader.onload=()=>res(reader.result); reader.onerror=rej; reader.readAsDataURL(file); });
      dataUrl=await compressImage(dataUrl, 1024);
      if(stat) stat.textContent='🔍 Рассматриваю...'; if(logEl) logEl.textContent='JARVIS рассматривает, понимает, думает...';
      const sys=enrichSys("Ты — JARVIS аналитик для Амина. Рассмотри фото досконально: что видишь, пойми смысл, подумай о скрытых паттернах, сделай ПОЛНЫЙ РАЗБОР (объекты, композиция, свет, лица, эмоции, аномалии, контекст), найди ПАТТЕРН и дай ЗАКЛЮЧЕНИЕ + совет. Структурировано: 1. Рассмотрел 2. Понял 3. Подумал 4. Паттерн 5. Заключение. До 8 предложений, по-русски, точно.");
      const r=await aiFetch('https://apihub.agnes-ai.com/v1/chat/completions',{method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+k}, body: JSON.stringify({model:'agnes-2.5-flash', messages:[{role:'system',content:sys},{role:'user',content:[{type:'text',text:"Фото "+file.name+" — полный разбор: рассмотри, пойми, подумай, найди паттерн, заключение."},{type:'image_url',image_url:{url:dataUrl}}]}], max_tokens:1100, temperature:0.42})});
      const j=await r.json(); if(!r.ok) throw new Error(j.error?.message||r.status);
      const txt=(j.choices?.[0]?.message?.content||'').trim();
      if(out) out.textContent=txt; if(logEl) logEl.textContent='✅ Готово — полный разбор, паттерн, заключение'; if(stat) stat.textContent='✅ Готово';
      lastAnalysisContext={fileName:file.name, duration:0, N:1, perFrameTexts:[{idx:0, ts:0, txt}], finalTxt:txt};
      addMsg('bot',"🔍 Анализ "+file.name+":\n"+txt);
      queueVoice(txt.slice(0,260), currentMode);
      addProject('analysis', file.name+': '+txt.slice(0,60));
      switchTab('analysis');
      return;
    } else if(isVid){
      if(stat) stat.textContent='⏳ Извлекаю кадры 1/сек...'; if(logEl) logEl.textContent='Режу видео покадрово: сколько секунд — столько кадров (макс 40) — понимаю динамику...';
      const cap=await captureFramesPerSecond(file, 40);
      const frames=cap.frames, duration=cap.duration;
      const N=frames.length;
      if(!N) throw new Error('не смог извлечь кадры');
      if(thumbs){ thumbs.innerHTML=frames.slice(0,12).map(f=> "<img src=\""+f.dataUrl+"\" style=\"width:88px;height:50px;object-fit:cover;border-radius:8px;border:1px solid var(--line)\">").join(''); thumbs.style.display='flex'; }
      if(N>12){ const more=document.createElement('div'); more.style.cssText='font-size:10px;color:var(--muted);align-self:center'; more.textContent="+"+(N-12)+" кадров"; thumbs.appendChild(more); }
      if(logEl) logEl.textContent="Извлечено "+N+" кадров (1/сек для "+Math.round(duration)+"с) — начинаю покадровый разбор каждого → потом синтез...";
      // per-frame analysis — ПАРАЛЛЕЛЬНО 5×, смесь JARVIS/FRIDAY/ULTRON, в 4-5 раз быстрее, реальное время
      let perFrameTexts=new Array(N);
      const personas=['jarvis','friday','ultron'];
      const concurrency=5;
      let nextIdx=0;
      let completed=0;
      const cards=[];
      for(let i=0;i<N;i++){
        const f=frames[i];
        const card=document.createElement('div');
        card.style.cssText='padding:8px 10px;border-radius:10px;border:1px solid var(--line);background:rgba(255,255,255,.04);font-size:11px';
        card.innerHTML="<b style='color:var(--accent)'>Кадр "+(i+1)+"/"+N+" @"+f.ts.toFixed(1)+"с</b> <span style='color:var(--muted)'>⏳ очередь</span>";
        perFrameBox.appendChild(card); cards.push(card);
      }
      perFrameBox.scrollTop=0;
      async function worker(){
        while(nextIdx<N){
          const i=nextIdx++;
          const f=frames[i];
          const card=cards[i];
          const persona=personas[i%3];
          card.innerHTML="<b style='color:var(--accent)'>Кадр "+(i+1)+"/"+N+" @"+f.ts.toFixed(1)+"с</b> <span style='color:var(--accent)'>● "+persona.toUpperCase()+" анализирует...</span>";
          if(stat) stat.textContent="🔍 Кадры "+(completed+1)+"-"+Math.min(N, completed+concurrency)+"/"+N+" параллельно...";
          try{
            const txt=await analyzeSingleFrame(f.dataUrl, i, f.ts, N, file.name, persona);
            perFrameTexts[i]={idx:i, ts:f.ts, txt, persona};
            card.innerHTML="<b style='color:var(--accent)'>Кадр "+(i+1)+" @"+f.ts.toFixed(1)+"с <span style='font-size:9px;color:var(--muted)'>"+persona.toUpperCase()+"</span></b><br><span style='color:#CBD5E1'>"+txt+"</span>";
          }catch(e){
            const txt="[ошибка] "+e.message;
            perFrameTexts[i]={idx:i, ts:f.ts, txt, persona};
            card.innerHTML="<b>Кадр "+(i+1)+"</b> <span style='font-size:9px;color:var(--muted)'>"+persona+"</span> ❌ "+e.message;
          }
          completed++;
          if(logEl) logEl.textContent="Прогресс "+completed+"/"+N+" кадров — смесь JARVIS/FRIDAY/ULTRON, параллельно 5× быстрее...";
          if(stat) stat.textContent="🔍 "+completed+"/"+N+" готово • параллельно";
        }
      }
      await Promise.all(Array.from({length:concurrency}, ()=>worker()));
      perFrameTexts=perFrameTexts.filter(Boolean);
      if(stat) stat.textContent='🔍 Синтезирую паттерн...'; if(logEl) logEl.textContent="Все "+N+" кадров разобраны покадрово — синтезирую общий паттерн, стиль боя/движений, заключение...";
      // pick 6 representative frames for synthesis
      const step=Math.max(1, Math.floor(N/6));
      const rep=[]; for(let i=0;i<N;i+=step){ rep.push(frames[i]); if(rep.length>=6) break; }
      let finalTxt='';
      try{
        finalTxt=await synthesizeVideo(perFrameTexts, rep, file.name, duration);
      }catch(e){
        if(logEl) logEl.textContent='Синтез 500 — пробую без кадров...';
        // fallback without images
        const perSummary=perFrameTexts.map(p=>"Кадр "+(p.idx+1)+" @"+p.ts.toFixed(1)+"с: "+p.txt).join("\n");
        const sys2=enrichSys("Ты — JARVIS+FRIDAY+ULTRON для Амина. По покадровым разборам найди паттерн видео.");
        const r2=await aiFetch('https://apihub.agnes-ai.com/v1/chat/completions',{method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+k}, body: JSON.stringify({model:'agnes-2.5-flash', messages:[{role:'system',content:sys2},{role:'user',content:"Видео "+file.name+" • "+Math.round(duration)+"с\n"+perSummary+"\n\nДай паттерн и заключение — стиль боя/движений если есть."}], max_tokens:1000})});
        const j2=await r2.json(); if(!r2.ok) throw new Error(j2.error?.message||r2.status);
        finalTxt=(j2.choices?.[0]?.message?.content||'').trim();
      }
      // Показываем ТОЛЬКО паттерн + заключение (покадровые не спамим, они в details)
      const full="▣ ОБЩИЙ ПАТТЕРН + ЗАКЛЮЧЕНИЕ (анализ "+N+" кадров, смесь JARVIS/FRIDAY/ULTRON):\n"+finalTxt;
      if(out) out.textContent=full;
      // Also keep perFrame details collapsed in details, already filled in cards
      
      if(logEl) logEl.textContent='✅ Готово — '+N+' кадров каждый отдельно + вместе, паттерн найден'; if(stat) stat.textContent='✅ Готово ('+N+' кадров)';
      lastAnalysisContext={fileName:file.name, duration, N, perFrameTexts, finalTxt};
      addMsg('bot',"🔍 Видео "+file.name+" ("+Math.round(duration)+"с, "+N+" кадров):\n"+finalTxt);
      queueVoice(finalTxt.slice(0,280), currentMode);
      addProject('analysis', file.name+': '+finalTxt.slice(0,60));
      switchTab('analysis');
      return;
    } else if(isPdf){
      try{
        if(!window.pdfjsLib){ await new Promise((res,rej)=>{ const s=document.createElement('script'); s.src='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'; s.onload=res; s.onerror=rej; document.head.appendChild(s); }); }
        const buf=await file.arrayBuffer(); const pdf=await pdfjsLib.getDocument({data:buf}).promise;
        for(let i=1;i<=Math.min(pdf.numPages,4);i++){ const pg=await pdf.getPage(i); const c=await pg.getTextContent(); textContent+= c.items.map(it=>it.str).join(' ') + "\n"; }
        textContent=textContent.slice(0,8000);
      }catch(e){ textContent='[PDF fail] '+e.message; }
    } else {
      textContent=await file.text().catch(()=> ''); textContent=textContent.slice(0,8000);
    }
    if(stat) stat.textContent='🔍 Анализирую...'; if(logEl) logEl.textContent='Отправляю в Agnes...';
    const sys=enrichSys("Ты — JARVIS-аналитик. Реально понимай паттерны: для файлов — TL;DR, паттерны, заключение. До 8 предложений, по-русски.");
    const r=await aiFetch('https://apihub.agnes-ai.com/v1/chat/completions',{method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+k}, body: JSON.stringify({model:'agnes-2.5-flash', messages:[{role:'system',content:sys},{role:'user',content:"Файл "+file.name+":\n"+textContent.slice(0,6000)+"\n\nРазбор паттернов, TL;DR."}], max_tokens:900})});
    const j=await r.json(); if(!r.ok) throw new Error(j.error?.message||r.status);
    const txt=(j.choices?.[0]?.message?.content||'').trim();
    if(out) out.textContent=txt; if(logEl) logEl.textContent='✅ Готово'; if(stat) stat.textContent='✅ Готово';
    addMsg('bot',"🔍 Анализ "+file.name+":\n"+txt);
    queueVoice(txt.slice(0,240), currentMode);
    addProject('analysis', file.name+': '+txt.slice(0,60));
    switchTab('analysis');
  }catch(e){
    if(stat) stat.textContent='❌ Ошибка'; if(logEl) logEl.textContent='Ошибка: '+e.message; if(out) out.textContent='❌ '+e.message; addMsg('sys','❌ '+e.message);
  } finally { if(drop) setTimeout(()=>drop.style.borderColor='var(--line)', 900); }
}
function clearAnalysis(){ document.getElementById('analysisOut').textContent=''; document.getElementById('analysisLog').textContent=''; document.getElementById('analysisStat').textContent=''; document.getElementById('analysisPreview').style.display='none'; const th=document.getElementById('analysisThumbs'); if(th) th.style.display='none'; const pf=document.getElementById('perFrameBox'); if(pf) pf.innerHTML=''; }

window.handleAnyFile=handleAnalysisFile;
setTimeout(()=>{ const drop=document.getElementById('analysisDrop'); if(!drop) return; drop.addEventListener('dragover', e=>{ e.preventDefault(); drop.style.borderColor='var(--accent)'; }); drop.addEventListener('dragleave', ()=>drop.style.borderColor='var(--line)'); drop.addEventListener('drop', e=>{ e.preventDefault(); const f=e.dataTransfer.files[0]; if(f) handleAnalysisFile(f); }); },1200);



// ===== WEB SEARCH — как JARVIS в фильме: ищет в инете, читает, создаёт =====
async function webSearch(query){
  const k=getKey(); // not needed but keep
  log('web search: '+query);
  // Try multiple CORS proxies
  const q=encodeURIComponent(query);
  const urls=[
    `https://api.allorigins.win/get?url=${encodeURIComponent('https://html.duckduckgo.com/html/?q='+q)}`,
    `https://corsproxy.io/?https://html.duckduckgo.com/html/?q=`+q
  ];
  for(let u of urls){
    try{
      const r=await fetch(u);
      if(!r.ok) continue;
      const j=await r.json().catch(()=>null);
      let htmlText='';
      if(j && j.contents) htmlText=j.contents;
      else htmlText=await r.text();
      // crude parse: extract result links/titles
      const matches=[...htmlText.matchAll(/<a[^>]+class="result__url"[^>]* href="([^"]+)"[^>]*>([^<]+)<\/a>/g)].slice(0,5);
      // fallback generic links
      if(!matches.length){
        const generic=[...htmlText.matchAll(/<a[^>]+href="([^"]+)"[^>]*>([^<]{10,80})<\/a>/g)].slice(0,5);
        return generic.map(m=> ({url:m[1], title:m[2].replace(/<[^>]+>/g,'').trim()})).filter(x=>x.url.startsWith('http')).slice(0,5).map(x=> x.title+": "+x.url).join("\n") || "нет результатов";
      }
      return matches.map(m=> m[2].trim()+": "+m[1]).join("\n");
    }catch(e){ console.warn('search fail',e); }
  }
  // Fallback: ask Agnes to simulate search via knowledge
  try{
    const kk=getKey();
    if(kk){
      const r=await aiFetch('https://apihub.agnes-ai.com/v1/chat/completions',{method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+kk}, body: JSON.stringify({model:'agnes-2.5-flash', messages:[{role:'system',content:enrichSys('Ты — JARVIS, ищешь в интернете. Пользователь просил найти: '+query+'. Дай 3-5 реальных ссылок/фактов как будто нашёл в сети. Если не знаешь — честно скажи.')},{role:'user',content:query}], max_tokens:500})});
      const j=await r.json(); if(r.ok) return (j.choices?.[0]?.message?.content||'').trim();
    }
  }catch{}
  return "поиск недоступен";
}
async function fetchPage(url){
  try{
    const prox=`https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
    const r=await fetch(prox);
    const j=await r.json();
    const html=j.contents||'';
    // strip tags crudely
    const text=html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<style[^>]*>[\s\S]*?<\/style>/gi,'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').slice(0,6000);
    return text;
  }catch(e){ return "ошибка загрузки "+e.message; }
}

// ===== FULL JARVIS UPGRADE: auto-prompt, voice control, WAKE, LIVE vision, Legion x10, Piper, File Agent, Game Coach =====
// Auto-prompt for image: keeps intent, makes 4K HDR
async function enhancePrompt(prompt){
  const k=getKey(); if(!k) return prompt;
  // If prompt already detailed (>40 chars and has style words), skip
  if(prompt.length>80 && /4k|hdr|8k|cinematic|фото|свет/i.test(prompt)) return prompt;
  try{
    const r=await aiFetch('https://apihub.agnes-ai.com/v1/chat/completions',{method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+k}, body: JSON.stringify({model:'agnes-2.5-flash', messages:[{role:'system',content:enrichSys('Ты — промпт-мастер для agnes-image-2.1. Улучши промпт пользователя для генерации изображения: добавь свет, детали, стиль, 4K, HDR, красиво, но НЕ меняй смысл и объекты. Верни ТОЛЬКО улучшенный промпт, 1 строка, до 200 символов, по-русски или как оригинал.')},{role:'user',content:prompt}], max_tokens:180, temperature:0.45})});
    const j=await r.json(); if(!r.ok) return prompt;
    const enhanced=(j.choices?.[0]?.message?.content||'').trim().replace(/^["']|["']$/g,'').slice(0,220);
    if(enhanced.length>12 && enhanced.length < 300) return enhanced;
  }catch(e){ console.warn('enhance fail',e); }
  // Fallback simple enhancer without API (0 RPM)
  const suffixes=[" естественный свет"," 4K"," красиво"," HDR"," детализация"," cinematic"];
  let p=prompt;
  if(!/свет/i.test(p)) p+=", естественный свет";
  if(!/4k|8k/i.test(p)) p+=", 4K";
  if(!/hdr/i.test(p)) p+=", HDR";
  return p;
}

// Patch genImg2 to use auto-prompt
const _oldGenImg2 = window.genImg2;
window.genImg2 = async function(){
  const inp=document.getElementById('imgPrompt2');
  const orig=inp.value.trim(); if(!orig) return addMsg('sys','🎨 Промпт');
  const stat=document.getElementById('imgGrid'); // keep
  // Show enhancing
  const k=getKey(); if(k){
    addMsg('sys','✨ Улучшаю промпт (без смены смысла)...');
    const better=await enhancePrompt(orig);
    if(better && better!==orig){
      inp.value=better;
      addMsg('sys','✨ Промпт: "'+orig.slice(0,40)+'" → "'+better.slice(0,60)+'"');
      log('prompt enhanced');
    }
  }
  return _oldGenImg2();
};

// Voice control + WAKE
let wakeActive=false, wakeRec=null;
async function initWake(){
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!SR) { log('wake: no SR'); addMsg('sys','❌ WAKE не поддерживается в этом браузере — попробуй Chrome Android'); return; }
  if(wakeActive) return;
  // Request mic permission first (needed for Android)
  try{
    const perm=await navigator.mediaDevices.getUserMedia({audio:true});
    perm.getTracks().forEach(t=>t.stop());
    log('mic permission granted for WAKE');
  }catch(e){
    log('mic perm fail '+e.message);
    addMsg('sys','🎙️ WAKE нужен доступ к микрофону — разреши');
    // still try
  }
  wakeActive=true;
  wakeRec=new SR();
  wakeRec.lang='ru-RU';
  wakeRec.continuous=true;
  wakeRec.interimResults=false;
  wakeRec.maxAlternatives=1;
  wakeRec.onresult=(e)=>{
    const last=e.results[e.results.length-1];
    const txt=last[0].transcript.toLowerCase().trim();
    console.log('wake heard', txt);
    if(txt.includes('джарвис') || txt.includes('жарвис') || txt.includes('jarvis')){
      // WAKE triggered
      log('WAKE: '+txt);
      addMsg('sys','🎙️ WAKE: '+txt);
      // Visual feedback
      const dot=document.getElementById('dot'); if(dot) dot.classList.add('wait');
      setTimeout(()=>{ const d=document.getElementById('dot'); if(d) d.classList.remove('wait'); }, 1200);
      // Extract command after wake
      let cmd=txt.replace(/.*джарвис[, ]*/,'').replace(/.*жарвис[, ]*/,'').replace(/.*jarvis[, ]*/,'').trim();
      if(!cmd) cmd=txt;
      handleVoiceCommand(cmd, txt);
      // Speak ack
      if(document.getElementById('voiceToggle')?.checked) queueVoice('Слушаю, сэр.', 'jarvis');
    } else if(wakeActive && txt.length>3){
      // Also handle direct commands without wake if contains control words
      if(/увеличь|уменьши|солнце|вспышка|камера|код|нарисуй|анализ/i.test(txt)){
        handleVoiceCommand(txt, txt);
      }
    }
  };
  wakeRec.onend=()=>{ if(wakeActive){ setTimeout(()=>{ try{ wakeRec.start(); }catch(e){ log('wake restart fail '+e.message); } }, 600); } };
  wakeRec.onerror=(e)=>{
    if(e.error==='aborted' || e.error==='no-speech'){ log('wake '+e.error+' — restart'); if(wakeActive) setTimeout(()=>{ try{ wakeRec.start(); }catch{} }, 800); return; }
    log('wake err '+e.error);
    if(wakeActive) setTimeout(()=>{ try{ wakeRec.start(); }catch{} }, 1500);
  };
  try{
    wakeRec.start();
    log('WAKE active — скажи "Эй Джарвис"');
    document.getElementById('handStat').textContent='🎙️ WAKE on';
    const b=document.getElementById('wakeBtn'); if(b){ b.classList.add('primary'); b.textContent='🎙️ WAKE ●'; }
    const s=document.getElementById('wakeStat'); if(s) s.textContent='слушает...';
    addMsg('sys','🎙️ WAKE включён — скажи "Эй Джарвис" + команда');
  }catch(e){
    log('wake start fail '+e.message);
    addMsg('sys','🎙️ WAKE ошибка: '+e.message+' — проверь разрешение микрофона');
    const s=document.getElementById('wakeStat'); if(s) s.textContent='ошибка';
  }
}
function stopWake(){ wakeActive=false; try{ if(wakeRec) wakeRec.stop(); }catch{} document.getElementById('handStat').textContent='🖐️ off'; const b=document.getElementById('wakeBtn'); if(b){ b.classList.remove('primary'); b.textContent='🎙️ WAKE'; } const s=document.getElementById('wakeStat'); if(s) s.textContent='off'; log('WAKE off'); }
function toggleWake(){ if(wakeActive) stopWake(); else initWake(); }
function toggleLiveVision(){ if(liveVisionActive) stopLiveVision(); else startLiveVision(); }
function toggleGameCoach(){ if(gameCoachActive) stopGameCoach(); else startGameCoach(); }
function handleVoiceCommand(cmd, raw){
  const low=cmd.toLowerCase();
  if(/увеличь.*солнце|больше солнце|увеличь/i.test(low) && low.includes('солнце')){ scale=Math.min(1.7, scale+0.22); log('voice: scale up'); return; }
  if(/уменьши.*солнце|меньше солнце/i.test(low)){ scale=Math.max(0.6, scale-0.22); log('voice: scale down'); return; }
  if(/вспышка|взорви/i.test(low)){ toggleSunBurst(); return; }
  if(/камера|включи камеру/i.test(low)){ toggleCam(); return; }
  if(/слушай|микрофон/i.test(low)){ toggleMic(); return; }
  if(/нарисуй|сгенери.*картин|изоб/i.test(low)){ switchTab('image'); document.getElementById('imgPrompt2').value=cmd; genImg2(); return; }
  if(/видео|сделай видео/i.test(low)){ switchTab('video'); document.getElementById('vidPrompt2').value=cmd; genVid2(); return; }
  if(/код|сайт|лендинг|сделай.*код/i.test(low)){ switchTab('code'); document.getElementById('codePrompt').value=cmd; genCode(); return; }
  if(/анализ|проанализируй/i.test(low)){ switchTab('analysis'); addMsg('sys','🎙️ Анализ: кинь файл'); return; }
  if(/легион|рой/i.test(low)){ switchTab('legion'); document.getElementById('legionInput').value=cmd; runLegionPane(); return; }
  if(/память|запомни/i.test(low)){ saveAboutMe(); return; }
  if(/что видишь|что там|что видишь сейчас/i.test(low)){
    const last=window.lastLiveSeen || JSON.parse(localStorage.getItem('lastLiveSeen')||'null');
    if(last && last.text){
      addMsg('bot','👁️ LIVE сейчас: '+last.text);
      try{ if(document.getElementById('voiceToggle')?.checked) queueVoice(last.text.slice(0,160), currentMode); }catch{}
    } else {
      addMsg('bot','👁️ LIVE пока не видел — включи LIVE и камеру');
    }
    return;
  }
  // Fallback: chat
  document.getElementById('inp').value=cmd; send();
}

// LIVE vision — every 4s, local first, then Agnes if needed
let liveVisionTimer=null, liveVisionActive=false;
function startLiveVision(){
  if(liveVisionActive) return;
  liveVisionActive=true;
  log('LIVE vision on (1 запрос/4с, RPM-safe)');
  const b=document.getElementById('liveBtn'); if(b){ b.classList.add('primary'); b.textContent='👁️ LIVE ●'; }
  (async()=>{
    // Prefer rear camera for LIVE as user requested — more convenient
    if(!window._camFacing) window._camFacing='environment';
    if(!camStream){
      addMsg('sys','👁️ LIVE нужен доступ к камере (задняя)...');
      window._camFacing='environment';
      const v=document.getElementById('cam'); if(v) v.style.transform='none';
      const fb=document.getElementById('flipBtn'); if(fb) fb.textContent='🤳 Фронт';
      await toggleCam();
      await new Promise(r=>setTimeout(r,900));
      if(!camStream){ addMsg('sys','❌ Камера не доступна для LIVE'); stopLiveVision(); return; }
    }
    addMsg('sys','👁️ LIVE включён — анализирую каждые 4с');
  })();
  liveVisionTimer=setInterval(async()=>{
    if(!camStream || !liveVisionActive) return;
    try{
      const v=document.getElementById('cam');
      if(!v || v.readyState<2) return;
      const c=document.createElement('canvas'); c.width=480; c.height=360;
      const ctx=c.getContext('2d'); ctx.drawImage(v,0,0,c.width,c.height);
      const dataUrl=c.toDataURL('image/jpeg',0.62);
      // Local quick check: if no motion/person, skip? For now always send but throttled 4s
      const k=getKey(); if(!k) return;
      const sys=enrichSys('Ты — FRIDAY LIVE vision. Опиши что видишь на кадре с камеры одним предложением, по-русски, только главное: люди, действия, объекты.');
      const r=await aiFetch('https://apihub.agnes-ai.com/v1/chat/completions',{method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+k}, body: JSON.stringify({model:'agnes-2.5-flash', messages:[{role:'system',content:sys},{role:'user',content:[{type:'text',text:'Что на кадре? LIVE vision.'},{type:'image_url',image_url:{url:dataUrl}}]}], max_tokens:120, temperature:0.35})});
      const j=await r.json(); if(!r.ok) return;
      const txt=(j.choices?.[0]?.message?.content||'').trim();
      if(txt){
        // SILENT live — не спамим в чат и не тратим RPM на голос, только храним для вопроса Тони
        window.lastLiveSeen = {text: txt, ts: Date.now()};
        try{ localStorage.setItem('lastLiveSeen', JSON.stringify(window.lastLiveSeen)); }catch{}
        // Обновляем HUD тихо, без addMsg и без озвучки (экономим RPM)
        try{ const hud=document.getElementById('hudState'); if(hud) hud.textContent=currentMode.toUpperCase()+' • LIVE 👁️ '+txt.slice(0,22); }catch{}
        try{ const logEl=document.getElementById('log'); if(logEl) logEl.textContent=new Date().toLocaleTimeString()+' • LIVE: '+txt.slice(0,60); }catch{}
        // WAVE-1: live в проекты не пишем — не спамим память
      }
    }catch(e){ console.warn('live vision',e); }
  }, 4000);
  document.getElementById('hudState').textContent=currentMode.toUpperCase()+' • LIVE';
}
function stopLiveVision(){ liveVisionActive=false; clearInterval(liveVisionTimer); document.getElementById('hudState').textContent=currentMode.toUpperCase()+' • STANDBY'; const b=document.getElementById('liveBtn'); if(b){ b.classList.remove('primary'); b.textContent='👁️ LIVE'; } log('LIVE off'); addMsg('sys','👁️ LIVE выкл'); }

// Legion x10 upgrade
// File Agent — real like JARVIS
async function fileAgentCreate(filename, content){
  const blob=new Blob([content],{type:'text/plain'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a'); a.href=url; a.download=filename; a.click();
  setTimeout(()=>URL.revokeObjectURL(url), 2000);
  addMsg('sys','📁 Файл создан: '+filename);
  log('file created '+filename);
  // also put into coding if html
  if(filename.endsWith('.html')){
    document.getElementById('codeOut').value=content;
    document.getElementById('codePreview').srcdoc=content;
  }
}
async function fileAgentChat(prompt){
  const k=getKey(); if(!k) return;
  const sys=enrichSys('Ты — файловый агент JARVIS. Пользователь просил: '+prompt+'. Если просит создать файл — верни JSON {"filename":"...","content":"..."} в ```json. Если просит изменить — объясни. По-русски.');
  const r=await aiFetch('https://apihub.agnes-ai.com/v1/chat/completions',{method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+k}, body: JSON.stringify({model:'agnes-2.5-flash', messages:[{role:'system',content:sys},{role:'user',content:prompt}], max_tokens:900})});
  const j=await r.json(); const txt=(j.choices?.[0]?.message?.content||'').trim();
  const m=txt.match(/```json\s*([\s\S]*?)```/); if(m){
    try{ const obj=JSON.parse(m[1]); if(obj.filename && obj.content) await fileAgentCreate(obj.filename, obj.content); }catch{}
  }
  addMsg('bot', txt);
}

// Piper TTS local clone (lazy)
let piperReady=false;
async function initPiper(){
  if(piperReady) return;
  try{
    if(!window.Piper){
      await new Promise((res,rej)=>{ const s=document.createElement('script'); s.src='https://cdn.jsdelivr.net/npm/@mintplex-labs/piper-tts-web@0.1.1/dist/piper.js'; s.onload=res; s.onerror=rej; document.head.appendChild(s); });
    }
    piperReady=true; log('Piper ready');
  }catch(e){ log('Piper fail '+e.message); }
}
async function piperSpeak(text, voice='en_US-lessac-medium'){
  await initPiper();
  if(window.Piper && Piper.speak){
    try{ await Piper.speak(text, voice); return true; }catch(e){ console.warn(e); }
  }
  return false;
}

// Game Coach LIVE — analyzes screen/cam for CS2 etc.
let gameCoachActive=false, gameCoachTimer=null;
function startGameCoach(){
  if(gameCoachActive) return;
  gameCoachActive=true;
  log('Game Coach LIVE on');
  const b=document.getElementById('coachBtn'); if(b){ b.classList.add('primary'); b.textContent='🎮 Коуч ●'; }
  (async()=>{
    if(!window._camFacing) window._camFacing='environment';
    if(!camStream){
      addMsg('sys','🎮 Коуч нужен экран/камера (задняя)...');
      window._camFacing='environment';
      const v=document.getElementById('cam'); if(v) v.style.transform='none';
      const fb=document.getElementById('flipBtn'); if(fb) fb.textContent='🤳 Фронт';
      await toggleCam();
      await new Promise(r=>setTimeout(r,900));
      if(!camStream){ addMsg('sys','❌ Камера нужна для коуча'); stopGameCoach(); return; }
    }
    addMsg('sys','🎮 Коуч включён — подсказки каждые 3.5с');
  })();
  gameCoachTimer=setInterval(async()=>{
    try{
      const v=document.getElementById('cam');
      let dataUrl=null;
      if(v && v.readyState>=2 && camStream){
        const c=document.createElement('canvas'); c.width=640; c.height=360; const ctx=c.getContext('2d'); ctx.drawImage(v,0,0,c.width,c.height); dataUrl=c.toDataURL('image/jpeg',0.62);
      }
      if(!dataUrl) return;
      const k=getKey(); if(!k) return;
      const sys=enrichSys('Ты — игровой коуч FRIDAY для CS2. По кадру подскажи: позиция, оружие, следующий шаг, как Тони Старк. 1-2 предложения, по-русски.');
      const r=await aiFetch('https://apihub.agnes-ai.com/v1/chat/completions',{method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+k}, body: JSON.stringify({model:'agnes-2.5-flash', messages:[{role:'system',content:sys},{role:'user',content:[{type:'text',text:'Коуч: что делать сейчас?'},{type:'image_url',image_url:{url:dataUrl}}]}], max_tokens:180})});
      const j=await r.json(); const txt=(j.choices?.[0]?.message?.content||'').trim();
      if(txt) addMsg('bot','🎮 Коуч: '+txt);
    }catch(e){ console.warn('coach',e); }
  }, 3500);
}
function stopGameCoach(){ gameCoachActive=false; clearInterval(gameCoachTimer); const b=document.getElementById('coachBtn'); if(b){ b.classList.remove('primary'); b.textContent='🎮 Коуч'; } log('Coach off'); addMsg('sys','🎮 Коуч выкл'); }

// Controls static — no auto-add needed



setTimeout(()=>{ log('WAKE/LIVE/COACH ready — жми кнопки'); }, 800);

// LEGION / QUEST with queued distinct voices — не перекрывают, с паузой
let voiceQueue=[], voicePlaying=false;
function queueVoice(text, persona){
  if(!document.getElementById('voiceToggle')?.checked) return;
  if(!text || !text.trim()) return;
  voiceQueue.push({text: text.slice(0,340).replace(/[#*_`]/g,''), persona});
  if(!voicePlaying) playVoiceQueue();
}
async function playVoiceQueue(){
  if(voicePlaying) return; voicePlaying=true;
  // ensure voices loaded
  if(!voices.length) { try{ voices=speechSynthesis.getVoices(); }catch{} await new Promise(r=>setTimeout(r,300)); try{ voices=speechSynthesis.getVoices(); }catch{} }
  while(voiceQueue.length){
    const {text, persona}=voiceQueue.shift();
    const old=currentMode;
    // hud
    const hud=document.getElementById('hudVoice'); if(hud) hud.textContent='VOICE: SPEAKING ('+ (persona||old).toUpperCase()+')';
    const wave=document.getElementById('wave'); if(wave) wave.style.display='flex';
    await new Promise(res=>{
      try{ speechSynthesis.cancel(); }catch{}
      const u=new SpeechSynthesisUtterance(text);
      let v=null;
      if(persona==='jarvis') v=voices.find(x=>x.lang.includes('en-GB')&&/male/i.test(x.name))||voices.find(x=>x.lang.includes('en-GB'))||voices.find(x=>x.lang.includes('en'))||voices[0];
      else if(persona==='friday') v=voices.find(x=>/female/i.test(x.name)&&x.lang.includes('en'))||voices.find(x=>x.lang.includes('en-GB'))||voices[0];
      else if(persona==='ultron') v=voices.find(x=>x.lang.toLowerCase().includes('ru'))||voices.find(x=>x.lang.includes('en-US'))||voices[0];
      else v=pickVoice(persona||old, text);
      if(v) u.voice=v;
      u.lang=v?.lang||(persona==='ultron'? 'ru-RU' : /[а-яё]/i.test(text)? 'ru-RU':'en-GB');
      u.rate=persona==='ultron'?0.86:persona==='friday'?1.07:0.93;
      u.pitch=persona==='ultron'?0.62:persona==='friday'?1.16:0.92;
      u.volume=1;
      let done=false;
      const fin=()=>{ if(done) return; done=true; if(hud) hud.textContent='VOICE: READY'; if(wave) wave.style.display='none'; res(); };
      u.onend=fin; u.onerror=fin;
      try{ speechSynthesis.speak(u); }catch{ fin(); }
      setTimeout(fin, 9000);
    });
    await new Promise(r=>setTimeout(r,420));
  }
  voicePlaying=false;
  const hud=document.getElementById('hudVoice'); if(hud) hud.textContent='VOICE: READY';
  const wave=document.getElementById('wave'); if(wave) wave.style.display='none';
}
window.runLegionPane=async function(){
  const task=document.getElementById('legionInput').value.trim(); if(!task) return;
  const k=getKey(); if(!k) return addMsg('sys','🔑 Ключ');
  const logEl=document.getElementById('legionLog'), outEl=document.getElementById('legionOut');
  logEl.textContent=''; outEl.textContent='⏳ Legion думает...\n'; addMsg('bot',`🦾 Legion: ${task}`);
  const roles={ jarvis:`Ты JARVIS — план 3 шага, британский.`, friday:`Ты FRIDAY — действия, дерзкая.`, ultron:`Ты ULTRON — риски, холодный.` };
  let results={};
  for(let m of ['jarvis','friday','ultron']){
    logEl.textContent+=`→ ${m.toUpperCase()}...\n`;
    const r=await aiFetch('https://apihub.agnes-ai.com/v1/chat/completions',{method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+k}, body: JSON.stringify({model:'agnes-2.5-flash', messages:[{role:'system',content:enrichSys(roles[m])},{role:'user',content:task}], max_tokens:480, temperature:0.55})});
    const j=await r.json(); const txt=(j.choices?.[0]?.message?.content||'...').trim(); results[m]=txt;
    logEl.textContent+=`${m.toUpperCase()}: ${txt.slice(0,90)}\n\n`; outEl.textContent+=`[${m.toUpperCase()}] ${txt}\n\n`;
    queueVoice(txt.slice(0,180), m); await new Promise(r=>setTimeout(r,900));
  }
  logEl.textContent+='→ Синтез...\n';
  const synth=await aiFetch('https://apihub.agnes-ai.com/v1/chat/completions',{method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+k}, body: JSON.stringify({model:'agnes-2.5-flash', messages:[{role:'system',content:enrichSys('Сведи 3 мнения в координированный план.')},{role:'user',content:`Задача: ${task}\nJARVIS: ${results.jarvis}\nFRIDAY: ${results.friday}\nULTRON: ${results.ultron}`}], max_tokens:700})});
  const sj=await synth.json(); const final=(sj.choices?.[0]?.message?.content||'').trim();
  outEl.textContent+=`—— ФИНАЛ ——\n${final}`; logEl.textContent+='✅ Готово\n'; addMsg('bot',`🦾 Legion финал:\n${final}`); queueVoice(final.slice(0,200), currentMode);
};
window.runQuestPane=async function(){
  const topic=document.getElementById('questInput').value.trim(); if(!topic) return;
  const k=getKey(); if(!k) return addMsg('sys','🔑 Ключ');
  const logEl=document.getElementById('questLog'), outEl=document.getElementById('questOut');
  logEl.textContent=''; outEl.innerHTML=''; addMsg('bot',`💬 VisionQuest: ${topic}`);
  const personas=[{id:'jarvis', name:'JARVIS', sys:'Ты JARVIS, британский, 2 предложения.'},{id:'friday', name:'FRIDAY', sys:'Ты FRIDAY, ирландская, 2 предложения.'},{id:'ultron', name:'ULTRON', sys:'Ты ULTRON, холодный, 2 предложения.'}];
  let history=[];
  for(let round=0; round<2; round++){
    for(let p of personas){
      logEl.textContent+=`→ ${p.name}...\n`;
      const r=await aiFetch('https://apihub.agnes-ai.com/v1/chat/completions',{method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+k}, body: JSON.stringify({model:'agnes-2.5-flash', messages:[{role:'system',content:enrichSys(p.sys)},{role:'user',content:`Тема: ${topic}\nИстория:\n${history.join('\n')}\nРеплика:`}], max_tokens:280, temperature:0.78})});
      const j=await r.json(); const txt=(j.choices?.[0]?.message?.content||'...').trim();
      history.push(`${p.name}: ${txt}`);
      const div=document.createElement('div'); div.style.cssText='padding:8px 10px;border-radius:10px;border:1px solid var(--line);background:rgba(255,255,255,.04)'; div.innerHTML=`<b style="color:var(--accent)">${p.name}</b>: ${txt}`; outEl.appendChild(div);
      logEl.textContent+=`${p.name}: ${txt.slice(0,70)}\n`; queueVoice(txt, p.id); await new Promise(r=>setTimeout(r,1100));
    }
  }
  logEl.textContent+='✅ Спор окончен\n';
};
window.startLegion=window.runLegionPane; window.startVisionQuest=window.runQuestPane;
setTimeout(()=>{ const b=document.getElementById('aboutMe'); if(b) b.value=localStorage.getItem('aboutMe')||''; },800);
window.__holoInit=false; function _initHoloOnce(){ if(window.__holoInit) return; window.__holoInit=true; initHolo3D(); }
window.addEventListener('load', ()=> setTimeout(_initHoloOnce, 600));
setTimeout(_initHoloOnce, 900);
