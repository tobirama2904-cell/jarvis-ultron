/* ============================================================
   JARVIS Creator (Wave-4): стили картинок, img2img-правки,
   галерея, кино-сториборд, аватар-диктор. После brain.js.
   ============================================================ */
(function(){
'use strict';
function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
const IMODELS=['agnes-image-2.1','agnes-image-2.5-flash','agnes-image-2.0-flash','agnes-image-2.1-flash'];

async function genImageDirect(prompt,size){
  const k=localStorage.getItem('agnes_key')||'';
  if(!k) throw new Error('Нет ключа Agnes');
  let last=null;
  for(const model of IMODELS){
    try{
      const r=await aiFetch('https://apihub.agnes-ai.com/v1/images/generations',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+k},body:JSON.stringify({model,prompt,size:size||'1024x1024',n:1})});
      const j=await r.json(); if(!r.ok) throw new Error((j.error&&j.error.message)||('HTTP '+r.status));
      const d=j.data&&j.data[0];
      const u=d&&(d.url||(d.b64_json?('data:image/png;base64,'+d.b64_json):null));
      if(!u) throw new Error('no url');
      return {url:u,model};
    }catch(e){ last=e; }
  }
  throw last||new Error('no channel');
}
function pushHist(prompt,url){
  try{ imgHistory.unshift({prompt:String(prompt).slice(0,120),url,ts:Date.now()}); localStorage.setItem('amin_img_hist',JSON.stringify(imgHistory.slice(0,20))); renderImgHist(); }catch(e){}
}

/* ---------- Стили ---------- */
function stylePreset(name){
  const P={cyber:', киберпанк, неон, дождь, 4K HDR, ultra detail',anime:', аниме, яркие цвета, детализация, шедевр',marvel:', Marvel cinematic still, epic light, ultra detail',photo:', фотореализм, 85mm, естественный свет, 8K'}[name]||'';
  try{ const i=document.getElementById('imgPrompt2'); if(i&&P&&i.value.indexOf(P.slice(0,12))<0) i.value=(i.value+P).slice(0,300); }catch(e){}
}

/* ---------- img2img правки ---------- */
async function editImageFlow(){
  const fi=document.getElementById('editFile'), pr=document.getElementById('editPrompt').value.trim(), st=document.getElementById('editStat');
  const f=fi&&fi.files&&fi.files[0];
  if(!f) return addMsg('sys','✏️ Сначала выбери картинку (кнопка 📷 Файл)');
  if(!pr) return addMsg('sys','✏️ Напиши что изменить, например: сделай ночь и дождь');
  const k=getKey(); if(!k) return addMsg('sys','🔑 Ключ');
  st.textContent='⏳ Изменяю…'; log('img edit '+pr.slice(0,30));
  try{
    const fd=new FormData(); fd.append('image',f); fd.append('prompt',pr); fd.append('model','agnes-image-2.1-flash'); fd.append('size','1024x1024'); fd.append('n','1');
    const r=await aiFetch('https://apihub.agnes-ai.com/v1/images/edits',{method:'POST',headers:{'Authorization':'Bearer '+k},body:fd,timeout:120000});
    const j=await r.json(); if(!r.ok) throw new Error((j.error&&j.error.message)||('HTTP '+r.status));
    const d=j.data&&j.data[0]; const u=d&&(d.url||(d.b64_json?('data:image/png;base64,'+d.b64_json):null));
    if(!u) throw new Error('no url');
    pushHist('✏️ '+pr,u);
    document.getElementById('imgBox').style.display='block'; document.getElementById('genImg').src=u; document.getElementById('imgCap').textContent='✏️ '+pr;
    st.textContent='✅ Готово'; addMsg('bot','✏️ Изменил: '+pr.slice(0,70)); try{queueVoice('Готово.',currentMode);}catch(e){}
  }catch(e){ st.textContent='❌ '+e.message; addMsg('sys','✏️ Не вышло: '+e.message); }
}

/* ---------- Галерея ---------- */
function openGallery(){ renderGallery(); document.getElementById('galModal').style.display='block'; }
function closeGallery(){ document.getElementById('galModal').style.display='none'; }
function renderGallery(){
  const g=document.getElementById('galGrid'); if(!g) return;
  const h=(typeof imgHistory!=='undefined'?imgHistory:[])||[];
  g.innerHTML=h.length?h.map((o,i)=>`<div class="g"><img src="${o.url}" loading="lazy"><div class="cap">${esc(o.prompt||'')}</div><div class="row"><button onclick="Creator.galDl(${i})">⬇</button><button onclick="Creator.galVar(${i})">🔁</button><button onclick="Creator.galDel(${i})">🗑</button></div></div>`).join(''):'<span style="font-size:12px;color:var(--muted)">Пока пусто — сгенери картинку</span>';
}
function galDl(i){
  const o=imgHistory[i]; if(!o) return;
  fetch(o.url).then(r=>{ if(!r.ok) throw 0; return r.blob(); }).then(b=>{
    const a=document.createElement('a'); a.href=URL.createObjectURL(b); a.download='jarvis-'+Date.now()+'.png'; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),4000);
  }).catch(()=>window.open(o.url,'_blank'));
}
function galVar(i){
  const o=imgHistory[i]; if(!o) return;
  closeGallery(); switchTab('image');
  document.getElementById('imgPrompt2').value=(o.prompt||'').replace(/^✏️ |^🎬 /,'');
  addMsg('sys','🔁 Ещё вариант: '+(o.prompt||'').slice(0,50)); genImg2();
}
function galDel(i){
  imgHistory.splice(i,1);
  try{ localStorage.setItem('amin_img_hist',JSON.stringify(imgHistory.slice(0,20))); }catch(e){}
  renderImgHist(); renderGallery();
}

/* ---------- Кино за минуту: сценарий → 3 кадра → озвучка ---------- */
async function storyboard(){
  const pr=document.getElementById('storyPrompt').value.trim();
  if(!pr) return addMsg('sys','🎬 Опиши идею кино, например: погоня по ночному Душанбе');
  const k=getKey(); if(!k) return addMsg('sys','🔑 Ключ');
  const out=document.getElementById('storyOut'); out.innerHTML='<div style="font-size:12px">⏳ Пишу сценарий…</div>';
  log('story '+pr.slice(0,30));
  try{
    const r=await aiFetch('https://apihub.agnes-ai.com/v1/chat/completions',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+k},body:JSON.stringify({model:'agnes-2.5-flash',messages:[{role:'system',content:'Ты — сценарист. По идее выдай РОВНО 3 сцены. Формат строго, каждая с новой строки:\n1) [описание кадра для художника: место, герой, действие, свет — 1 предложение]\n2) [...]\n3) [...]\nТолько эти 3 строки, по-русски, кинематографично.'},{role:'user',content:pr}],max_tokens:400,temperature:0.8})});
    const j=await r.json(); if(!r.ok) throw new Error((j.error&&j.error.message)||r.status);
    const txt=((j.choices&&j.choices[0]&&j.choices[0].message&&j.choices[0].message.content)||'');
    const scenes=txt.split('\n').map(s=>s.replace(/^\s*\d+\)\s*/,'').trim()).filter(s=>s.length>10).slice(0,3);
    if(!scenes.length) throw new Error('пустой сценарий — попробуй ещё');
    out.innerHTML=scenes.map((s,i)=>`<div class="stcard" id="stc${i}"><div>🎬 Кадр ${i+1}: ${esc(s)}<br>⏳ рисую…</div></div>`).join('');
    for(let i=0;i<scenes.length;i++){
      const card=document.getElementById('stc'+i);
      try{
        const ru=await genImageDirect(scenes[i]+', cinematic film still, dramatic light, 4K','1792x1024');
        card.innerHTML=`<img src="${ru.url}"><div>🎬 Кадр ${i+1}: ${esc(scenes[i])}</div>`;
        pushHist('🎬 '+scenes[i].slice(0,60),ru.url);
      }catch(e){ if(card) card.innerHTML=`<div>🎬 Кадр ${i+1}: ❌ ${esc(e.message)}</div>`; }
    }
    addMsg('bot','🎬 Кино готово: 3 кадра по «'+pr.slice(0,50)+'». Озвучиваю…');
    try{ queueVoice('Кино готово. Показываю три кадра.',currentMode); }catch(e){}
    scenes.forEach((s,i)=>{ setTimeout(()=>{ try{
      document.querySelectorAll('.stcard').forEach(c=>c.classList.remove('live'));
      const c=document.getElementById('stc'+i); if(c) c.classList.add('live');
      queueVoice('Кадр '+(i+1)+'. '+s,currentMode);
    }catch(e){} }, 4000+i*11000); });
  }catch(e){ out.innerHTML='<div style="font-size:12px">❌ '+esc(e.message)+'</div>'; addMsg('sys','🎬 '+e.message); }
}

/* ---------- Аватар-диктор ---------- */
const AVA_P={jarvis:'British gentleman AI butler hologram portrait, blue neon glow, cinematic, centered',friday:'Irish young woman AI hologram portrait, orange neon glow, cinematic, centered',ultron:'cold robot AI overlord portrait, red neon glow, dark cinematic, centered'};
const _avaCache={};
async function ensurePortrait(persona){
  if(_avaCache[persona]) return _avaCache[persona];
  try{ const sv=localStorage.getItem('ava_'+persona); if(sv){ _avaCache[persona]=sv; return sv; } }catch(e){}
  const ru=await genImageDirect(AVA_P[persona]||AVA_P.jarvis,'1024x1024');
  _avaCache[persona]=ru.url;
  try{ localStorage.setItem('ava_'+persona,ru.url); }catch(e){}
  return ru.url;
}
async function avatarSpeak(){
  const last=[...document.querySelectorAll('#msgs .msg.bot')].pop();
  const text=((last&&last.textContent)||'Привет! Я к твоим услугам.').slice(0,300);
  const m=document.getElementById('avaModal'); m.style.display='block';
  const img=document.getElementById('avaImg'); img.removeAttribute('src');
  document.getElementById('avaCap').textContent='⏳ Рисую персону… '+text.slice(0,100);
  try{ img.src=await ensurePortrait(currentMode); }
  catch(e){ document.getElementById('avaCap').textContent='❌ '+e.message; }
  document.getElementById('avaCap').textContent=text.slice(0,220);
  try{ queueVoice(text,currentMode); }catch(e){}
}
function closeAvatar(){ document.getElementById('avaModal').style.display='none'; }

window.Creator={genImageDirect,stylePreset,editImageFlow,openGallery,closeGallery,renderGallery,galDl,galVar,galDel,storyboard,avatarSpeak,closeAvatar};
})();
