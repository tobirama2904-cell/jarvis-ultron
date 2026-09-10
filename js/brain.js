/* ============================================================
   JARVIS Brain (Waves 2+5): function-calling tools, локальный
   роутер (0 RPM), факты, todo, напоминания, брифинг, совет,
   новости, перевод, экспорт. Загружается после core.js.
   ============================================================ */
(function(){
'use strict';
function lsGet(k,d){ try{ const v=localStorage.getItem(k); return v==null?d:JSON.parse(v); }catch(e){ return d; } }
function lsSet(k,v){ try{ localStorage.setItem(k,JSON.stringify(v)); }catch(e){} }
function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function dsTime(){ return new Date().toLocaleString('ru-RU',{timeZone:'Asia/Dushanbe',hour:'2-digit',minute:'2-digit',day:'2-digit',month:'2-digit'}); }
function dsDate(){ return new Date().toLocaleString('ru-RU',{timeZone:'Asia/Dushanbe',weekday:'long',day:'numeric',month:'long'}); }
function detectLang(t){ t=t||''; if(/[ғӣқӯҳҷҒӢҚӮҲҶ]/.test(t)) return 'tg'; if(/[а-яё]/i.test(t)) return 'ru'; return 'en'; }
const LANGN={ru:'русском',tg:'таджикском',en:'английском'};

/* ---------- Факты (память 2.0) ---------- */
const Facts={
  key:'core_facts_v1',
  list(){ return lsGet(this.key,[]); },
  add(f){ f=String(f||'').trim().slice(0,200); if(!f) return; const l=this.list(); l.unshift({f,ts:Date.now()}); lsSet(this.key,l.slice(0,40)); renderFacts(); },
  del(i){ const l=this.list(); l.splice(i,1); lsSet(this.key,l); renderFacts(); },
  text(){ const l=this.list(); return l.length?('\nФакты о пользователе (помни и используй):\n'+l.slice(0,12).map(x=>'- '+x.f).join('\n')):''; }
};
function renderFacts(){
  try{
    const box=document.getElementById('factBox'); if(!box) return;
    const l=Facts.list();
    box.innerHTML=l.length?('<div style="font-size:11px;font-weight:800;margin-top:2px">📌 Факты</div>'+l.slice(0,6).map((x,i)=>`<div class="f"><span>${esc(x.f)}</span><button onclick="Brain.Facts.del(${i})">✕</button></div>`).join('')):'';
  }catch(e){}
}

/* ---------- Todo ---------- */
const Todos={
  key:'core_todo_v1',
  list(){ return lsGet(this.key,[]); },
  add(t){ t=String(t||'').trim().slice(0,140); if(!t) return; const l=this.list(); l.unshift({t,done:false,ts:Date.now()}); lsSet(this.key,l.slice(0,30)); },
  done(i){ const l=this.list(); if(l[i]){ l[i].done=true; lsSet(this.key,l); } },
  text(){ const l=this.list().filter(x=>!x.done); return l.length?l.map((x,i)=>(i+1)+'. '+x.t).join('\n'):'пока пусто'; }
};

/* ---------- Напоминания ---------- */
const Reminders={
  key:'core_rem_v1',
  list(){ return lsGet(this.key,[]); },
  add(text,at){ const l=this.list(); const r={id:Date.now(),text:String(text||'пора').slice(0,140),at:+at}; l.push(r); lsSet(this.key,l); renderRem();
    try{ if(window.Notification&&Notification.permission==='default') Notification.requestPermission().catch(()=>{}); }catch(e){}
    return r; },
  del(id){ lsSet(this.key,this.list().filter(r=>r.id!==id)); renderRem(); },
  check(){ const now=Date.now(); let l=this.list(),fired=false;
    l=l.filter(r=>{ if(r.at<=now){ try{fireReminder(r);}catch(e){} fired=true; return false; } return true; });
    if(fired){ lsSet(this.key,l); renderRem(); } }
};
function fireReminder(r){
  try{
    addMsg('bot','⏰ Напоминание: '+r.text);
    try{ queueVoice('Напоминаю. '+r.text, currentMode); }catch(e){}
    if(window.Notification&&Notification.permission==='granted'){ try{ new Notification('JARVIS ⏰',{body:r.text}); }catch(e){} }
    log('reminder fired');
  }catch(e){}
}
function renderRem(){
  try{
    const box=document.getElementById('remList'); if(!box) return;
    const l=Reminders.list();
    box.innerHTML=l.length?l.map(r=>{ const d=new Date(r.at); return `<div class="r"><span>⏰ ${esc(r.text)} • ${d.toLocaleString('ru-RU',{hour:'2-digit',minute:'2-digit',day:'2-digit',month:'2-digit'})}</span><button onclick="Brain.Reminders.del(${r.id})">✕</button></div>`; }).join(''):'<span style="font-size:10px;color:var(--muted)">нет напоминаний</span>';
  }catch(e){}
}
function parseReminder(q){
  q=String(q||'');
  let m=q.match(/через\s+(\d+)\s*(секунд|сек|минут|мин|час)/i);
  if(m){ const n=+m[1]; const u=m[2].toLowerCase(); const mult=u[0]==='с'?1000:(u[0]==='ч'?3600000:60000);
    const text=q.replace(/напомни(ть)?/i,'').replace(m[0],'').replace(/^[\s:,-]+/,'').trim()||'пора!';
    return {text:text.slice(0,140),at:Date.now()+n*mult}; }
  m=q.match(/в\s+(\d{1,2})[:.](\d{2})/);
  if(m){ const d=new Date(); d.setHours(+m[1],+m[2],0,0); let at=d.getTime(); if(at<=Date.now()) at+=86400000;
    const text=q.replace(/напомни(ть)?/i,'').replace(m[0],'').replace(/^[\s:,-]+/,'').trim()||'пора!';
    return {text:text.slice(0,140),at}; }
  return null;
}

/* ---------- Инструменты (function calling) ---------- */
const TOOLS=[
  {type:'function',function:{name:'get_time',description:'Текущее время и дата в Душанбе',parameters:{type:'object',properties:{}}}},
  {type:'function',function:{name:'get_weather',description:'Погода сейчас. Город латиницей, по умолчанию Dushanbe',parameters:{type:'object',properties:{city:{type:'string'}}}}},
  {type:'function',function:{name:'web_search',description:'Поиск в интернете',parameters:{type:'object',properties:{query:{type:'string'}},required:['query']}}},
  {type:'function',function:{name:'calc',description:'Вычислить арифметическое выражение',parameters:{type:'object',properties:{expr:{type:'string',description:'Например (12+8)*3'}},required:['expr']}}},
  {type:'function',function:{name:'get_rates',description:'Курс USD/EUR/RUB к сомони TJS',parameters:{type:'object',properties:{}}}},
  {type:'function',function:{name:'save_fact',description:'Запомнить факт о пользователе',parameters:{type:'object',properties:{fact:{type:'string'}},required:['fact']}}},
  {type:'function',function:{name:'todo_add',description:'Добавить задачу в список',parameters:{type:'object',properties:{task:{type:'string'}},required:['task']}}},
  {type:'function',function:{name:'todo_list',description:'Показать список задач',parameters:{type:'object',properties:{}}}},
  {type:'function',function:{name:'set_reminder',description:'Поставить напоминание',parameters:{type:'object',properties:{text:{type:'string'},minutes:{type:'number',description:'Через сколько минут'},at:{type:'string',description:'Время ЧЧ:ММ'}}}}}
];
function syncCalc(expr){
  expr=String(expr||'').replace(/[^0-9+\-*\/.()\s]/g,'').replace(/,/g,'.');
  if(!expr||expr.length>60||!/[+\-*/]/.test(expr)) throw new Error('bad');
  const v=Function('"use strict";return ('+expr+')')();
  if(typeof v!=='number'||!isFinite(v)) throw new Error('bad');
  return String(Math.round(v*1000)/1000);
}
async function fetchWeather(city){
  city=String(city||'Dushanbe').replace(/[^a-zA-Zа-яёЁ \-]/g,'').trim()||'Dushanbe';
  const r=await fetch('https://wttr.in/'+encodeURIComponent(city)+'?format=j1');
  const j=await r.json(); const c=j.current_condition&&j.current_condition[0];
  if(!c) throw new Error('нет данных');
  const d=c.weatherDesc&&c.weatherDesc[0]&&c.weatherDesc[0].value||'';
  return city+': '+c.temp_C+'°C, '+d+', ветер '+c.windspeedKmph+' км/ч, влажность '+c.humidity+'%';
}
async function fetchRates(){
  const r=await fetch('https://open.er-api.com/v6/latest/USD'); const j=await r.json();
  const t=j.rates&&j.rates.TJS; if(!t) throw new Error('нет данных');
  const e=j.rates.EUR?(t/j.rates.EUR):0, rb=j.rates.RUB?(t/j.rates.RUB):0;
  return '1 USD = '+t.toFixed(2)+' TJS • 1 EUR = '+e.toFixed(2)+' TJS • 1 RUB = '+rb.toFixed(2)+' TJS';
}
async function execTool(name,args){
  args=args||{};
  switch(name){
    case 'get_time': return 'Душанбе: '+dsTime();
    case 'get_weather': return await fetchWeather(args.city||'Dushanbe');
    case 'web_search': return await webSearch(args.query||'');
    case 'calc': return await syncCalc(args.expr||'');
    case 'get_rates': return await fetchRates();
    case 'save_fact': Facts.add(args.fact||''); return 'Запомнил: '+(args.fact||'');
    case 'todo_add': Todos.add(args.task||''); return 'Добавил задачу: '+(args.task||'');
    case 'todo_list': return 'Задачи:\n'+Todos.text();
    case 'set_reminder': {
      let at=null;
      if(args.minutes) at=Date.now()+(+args.minutes)*60000;
      else if(args.at){ const m=String(args.at).match(/(\d{1,2}):(\d{2})/); if(m){ const d=new Date(); d.setHours(+m[1],+m[2],0,0); at=d.getTime(); if(at<=Date.now()) at+=86400000; } }
      if(!at) return 'Не понял время — укажи minutes или at ЧЧ:ММ';
      Reminders.add(args.text||'пора',at); return 'Напомню: '+(args.text||'пора');
    }
    default: return 'Неизвестный инструмент: '+name;
  }
}

/* ---------- Чат с инструментами ---------- */
let toolsOK=null;
function toolsState(){ return toolsOK; }
async function chatWithTools(o){
  o=o||{};
  const k=localStorage.getItem('agnes_key')||'';
  if(!k) throw new Error('Нет ключа Agnes — вставь слева и нажми «Сохранить».');
  const lastQ=(o.hist&&o.hist.length?o.hist[o.hist.length-1].content:'')||'';
  const lang=detectLang(lastQ);
  const sysFull=o.sys+Facts.text()+'\nОтвечай на '+(LANGN[lang]||'русском')+' языке. Сейчас в Душанбе: '+dsTime()+', '+dsDate()+'.';
  const msgs=[{role:'system',content:sysFull}].concat(o.hist||[]);
  if(toolsOK!==false){
    try{
      const r=await aiFetch('https://apihub.agnes-ai.com/v1/chat/completions',{method:'POST',
        headers:{'Content-Type':'application/json','Authorization':'Bearer '+k},
        body:JSON.stringify({model:'agnes-2.5-flash',messages:msgs,tools:TOOLS,tool_choice:'auto',max_tokens:500,temperature:0.4})});
      const j=await r.json(); if(!r.ok) throw new Error((j.error&&j.error.message)||('HTTP '+r.status));
      const msg=j.choices&&j.choices[0]&&j.choices[0].message||{};
      const calls=msg.tool_calls||[];
      toolsOK=true;
      if(calls.length){
        try{ addMsg('sys','🔧 Инструменты: '+calls.map(c=>c.function.name).join(', ')); }catch(e){}
        const results=[];
        for(const c of calls.slice(0,4)){
          let res='';
          try{ res=await execTool(c.function.name,JSON.parse(c.function.arguments||'{}')); }
          catch(e){ res='Ошибка: '+e.message; }
          results.push({role:'tool',tool_call_id:c.id,content:String(res).slice(0,1500)});
        }
        const msgs2=msgs.concat([{role:'assistant',content:msg.content||'',tool_calls:calls}],results);
        return await aiStreamChat({messages:msgs2,max_tokens:800,temperature:0.6,onToken:o.onToken});
      }
      const full=msg.content||'';
      if(o.onToken&&full){ const ch=Math.max(3,Math.floor(full.length/40)); for(let i=0;i<full.length;i+=ch){ o.onToken(full.slice(i,i+ch)); await new Promise(rr=>setTimeout(rr,12)); } }
      return full;
    }catch(e){
      const m=String((e&&e.message)||'');
      if(toolsOK===null&&(e.status===400||/tool|function|unknown|invalid|parameter/i.test(m))){ toolsOK=false; }
      else throw e;
    }
  }
  return await aiStreamChat({messages:msgs,max_tokens:900,temperature:0.62,onToken:o.onToken});
}

/* ---------- Локальный роутер: мгновенно, 0 RPM ---------- */
async function tryLocal(q){
  const t=String(q||'').trim(), low=t.toLowerCase();
  try{
    if(/^(который час|время|сколько времени|время\?*|час\?*)$/.test(low)) return '🕒 В Душанбе сейчас '+dsTime();
    if(/^(какое сегодня число|какая сегодня дата|сегодняшняя дата|день недели|какой сегодня день)/.test(low)) return '📅 Сегодня: '+dsDate();
    let m=low.match(/^(посчитай|вычисли|сколько будет)\s+(.+)/);
    if(m){ try{ return '= '+syncCalc(m[2]); }catch(e){ return null; } }
    if(/^погода(\s|$)(\s*в\s+(.+))?/.test(low)){ const mm=low.match(/^погода\s*(в\s+(.+))?/); const w=await fetchWeather(mm&&mm[2]?mm[2]:'Dushanbe'); return '🌤 '+w; }
    if(/^(курс|валюта|валюты|курс валют|доллар|евро)/.test(low)){ const r=await fetchRates(); return '💱 '+r; }
    if(/^запомни(\s|:)/.test(low)){ const f=t.replace(/^запомни\s*:?\s*/i,'').trim(); if(!f) return '🧠 Что запомнить? Напиши: «запомни: люблю плов»'; Facts.add(f); return '🧠 Запомнил: '+f; }
    if(/напомни/.test(low)){ const p=parseReminder(t); if(!p) return '⏰ Скажи так: «напомни через 20 минут позвонить» или «напомни в 7:30 встать»'; Reminders.add(p.text,p.at); return '⏰ Напомню: '+p.text; }
    if(/^(задачи|список задач|мои задачи|туду|todo)/.test(low)) return '📝 Задачи:\n'+Todos.text();
    m=t.match(/^(добавь задачу|новая задача)\s*:?\s*(.+)/i);
    if(m){ Todos.add(m[2]); return '📝 Добавил: '+m[2].slice(0,120); }
    if(/^совет\s*:/.test(low)){ await councilInChat(t.replace(/^совет\s*:/i,'').trim()); return {silent:true}; }
    if(/^переведи(\s|$)/.test(low)){ await translateFlow(t); return {silent:true}; }
    if(/^(что нового|новости|последние новости)/.test(low)){ await freshNews(t); return {silent:true}; }
    if(/брифинг/.test(low)){ await morningBriefing(); return {silent:true}; }
  }catch(e){ return null; }
  return null;
}

/* ---------- Быстрые действия ---------- */
async function weatherQuick(){ try{ addMsg('user','🌤 Погода'); const w=await fetchWeather('Dushanbe'); addMsg('bot','🌤 '+w); try{queueVoice(w.slice(0,200),currentMode);}catch(e){} }catch(e){ addMsg('sys','🌤 '+e.message); } }
async function ratesQuick(){ try{ addMsg('user','💱 Курс'); const r=await fetchRates(); addMsg('bot','💱 '+r); try{queueVoice('Курс валют: '+r.slice(0,140),currentMode);}catch(e){} }catch(e){ addMsg('sys','💱 '+e.message); } }
function remindQuick(q){ const p=parseReminder(q||''); if(!p){ addMsg('bot','⏰ Скажи так: «напомни через 20 минут позвонить» или «напомни в 7:30 встать»'); return; } Reminders.add(p.text,p.at); addMsg('bot','⏰ Напомню: '+p.text); try{queueVoice('Напомню: '+p.text,currentMode);}catch(e){} }
function chipCouncil(){ try{ const i=document.getElementById('inp'); i.value='совет: '; i.focus(); }catch(e){} }
function chipFix(){ try{ switchTab('code'); const i=document.getElementById('codePrompt'); i.value='Найди и исправь ошибку: '; i.focus(); }catch(e){} }
function chipTranslate(){ try{ const i=document.getElementById('inp'); i.value='переведи на английский: '; i.focus(); }catch(e){} }
function exportChat(){
  try{
    const ms=[...document.querySelectorAll('#msgs .msg')].map(d=>(d.classList.contains('user')?'ТЫ: ':(d.classList.contains('sys')?'SYS: ':'AI: '))+d.textContent).join('\n\n')||'(пусто)';
    const blob=new Blob([ms],{type:'text/plain'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='jarvis-chat.txt'; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),3000);
    addMsg('sys','💾 Чат экспортирован');
  }catch(e){ addMsg('sys','💾 '+e.message); }
}

/* ---------- Совет трёх в чате ---------- */
async function councilInChat(task){
  const k=getKey(); if(!k){ addMsg('sys','🔑 Ключ'); return; }
  if(!task){ addMsg('bot','🧠 Напиши так: «совет: как учить английский»'); return; }
  addMsg('user','🧠 Совет: '+task);
  const list=document.getElementById('msgs'); const div=document.createElement('div'); div.className='msg bot'; div.textContent='🧠 Совет трёх думает…'; list.appendChild(div); list.scrollTop=list.scrollHeight;
  const roles=[['JARVIS','Ты JARVIS — дай план из 3 шагов. По-русски, коротко, по делу.'],['FRIDAY','Ты FRIDAY — дай дерзкие быстрые действия. По-русски, коротко.'],['ULTRON','Ты ULTRON — укажи риски и слабые места. По-русски, коротко.']];
  try{
    const parts=await Promise.all(roles.map(async rn=>{
      const r=await aiFetch('https://apihub.agnes-ai.com/v1/chat/completions',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+k},body:JSON.stringify({model:'agnes-2.5-flash',messages:[{role:'system',content:enrichSys(rn[1])},{role:'user',content:task}],max_tokens:320,temperature:0.6})});
      const j=await r.json(); if(!r.ok) throw new Error((j.error&&j.error.message)||r.status);
      return [rn[0],((j.choices&&j.choices[0]&&j.choices[0].message&&j.choices[0].message.content)||'').trim()];
    }));
    div.textContent=parts.map(p=>'【'+p[0]+'】\n'+p[1]).join('\n\n')+'\n\n⏳ Синтез…'; list.scrollTop=list.scrollHeight;
    const s2=await aiFetch('https://apihub.agnes-ai.com/v1/chat/completions',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+k},body:JSON.stringify({model:'agnes-2.5-flash',messages:[{role:'system',content:enrichSys('Сведи 3 мнения JARVIS, FRIDAY и ULTRON в единый чёткий план. По-русски.')},{role:'user',content:'Задача: '+task+'\n'+parts.map(p=>p[0]+': '+p[1]).join('\n')}],max_tokens:700})});
    const j2=await s2.json(); if(!s2.ok) throw new Error((j2.error&&j2.error.message)||s2.status);
    let fin=((j2.choices&&j2.choices[0]&&j2.choices[0].message&&j2.choices[0].message.content)||'').trim(); if(!fin) fin='(синтез временно недоступен — смотри мнения выше)';
    div.textContent=parts.map(p=>'【'+p[0]+'】\n'+p[1]).join('\n\n')+'\n\n━━━ ФИНАЛ ━━━\n'+fin; list.scrollTop=list.scrollHeight;
    try{ queueVoice(fin.slice(0,300),currentMode); }catch(e){}
  }catch(e){ div.textContent='❌ '+e.message; }
}

/* ---------- Утренний брифинг ---------- */
async function morningBriefing(){
  addMsg('user','☀️ Утренний брифинг');
  const list=document.getElementById('msgs'); const div=document.createElement('div'); div.className='msg bot'; div.textContent='☀️ Собираю брифинг…'; list.appendChild(div); list.scrollTop=list.scrollHeight;
  try{
    const w=await fetchWeather('Dushanbe').catch(()=> 'погода недоступна');
    const rts=await fetchRates().catch(()=> 'курс недоступен');
    let news=''; try{ news=(await webSearch('новости Таджикистан сегодня')).slice(0,500); }catch(e){}
    const P=(window.PERSONAS&&PERSONAS[currentMode])||{sys:'Ты ассистент. '};
    const r=await aiFetch('https://apihub.agnes-ai.com/v1/chat/completions',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+getKey()},body:JSON.stringify({model:'agnes-2.5-flash',messages:[{role:'system',content:enrichSys(P.sys+Facts.text())},{role:'user',content:'Составь утренний брифинг для пользователя, бодро, по-русски, до 9 строк с эмодзи:\nВремя: '+dsTime()+', '+dsDate()+'\nПогода: '+w+'\nВалюты: '+rts+'\nНовости из поиска: '+news+'\nЗадачи: '+Todos.text()}],max_tokens:700})});
    const j=await r.json(); if(!r.ok) throw new Error((j.error&&j.error.message)||r.status);
    const txt=((j.choices&&j.choices[0]&&j.choices[0].message&&j.choices[0].message.content)||'').trim()||'…';
    const txtF=(!txt||txt==='…')?('🌤 '+w+'\n💱 '+rts+'\n📝 Задачи:\n'+Todos.text()):txt; div.textContent='☀️ Брифинг • '+dsTime()+'\n\n'+txtF; list.scrollTop=list.scrollHeight;
    try{ queueVoice(txtF.slice(0,420),currentMode); }catch(e){}
  }catch(e){ div.textContent='❌ '+e.message; }
}

/* ---------- Новости с пересказом ---------- */
async function freshNews(topic){
  const k=getKey(); if(!k){ addMsg('sys','🔑 Ключ'); return; }
  addMsg('user','📰 '+(topic||'Новости'));
  const list=document.getElementById('msgs'); const div=document.createElement('div'); div.className='msg bot'; div.textContent='📰 Ищу новости…'; list.appendChild(div); list.scrollTop=list.scrollHeight;
  try{
    const raw=await webSearch((topic&&topic.replace(/^(что нового|новости)\s*/i,''))||'главные новости сегодня');
    div.textContent='📰 Пересказываю…';
    const P=(window.PERSONAS&&PERSONAS[currentMode])||{sys:'Ты ассистент. '};
    const r=await aiFetch('https://apihub.agnes-ai.com/v1/chat/completions',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+k},body:JSON.stringify({model:'agnes-2.5-flash',messages:[{role:'system',content:enrichSys(P.sys+' Кратко пересказывай новости по-русски, главное — первыми.')},{role:'user',content:'Перескажи коротко:\n'+String(raw).slice(0,2500)}],max_tokens:600})});
    const j=await r.json(); if(!r.ok) throw new Error((j.error&&j.error.message)||r.status);
    const txt=((j.choices&&j.choices[0]&&j.choices[0].message&&j.choices[0].message.content)||'').trim()||'…';
    div.textContent='📰 '+((!txt||txt==='…')?String(raw).slice(0,800):txt); list.scrollTop=list.scrollHeight;
    try{ queueVoice(txt.slice(0,380),currentMode); }catch(e){}
  }catch(e){ div.textContent='❌ '+e.message; }
}

/* ---------- Перевод ---------- */
async function translateFlow(q){
  const k=getKey(); if(!k){ addMsg('sys','🔑 Ключ'); return; }
  const m=String(q||'').match(/^переведи\s+(?:на\s+)?([а-яa-zё\s]+?)\s*:\s*(.+)/i);
  if(!m){ addMsg('bot','🌐 Напиши так: «переведи на английский: привет, как дела»'); return; }
  addMsg('user','🌐 Перевод на '+m[1].trim());
  const list=document.getElementById('msgs'); const div=document.createElement('div'); div.className='msg bot'; div.textContent='🌐 Перевожу…'; list.appendChild(div); list.scrollTop=list.scrollHeight;
  try{
    const r=await aiFetch('https://apihub.agnes-ai.com/v1/chat/completions',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+k},body:JSON.stringify({model:'agnes-2.5-flash',messages:[{role:'system',content:'Ты — точный переводчик. Верни ТОЛЬКО перевод, без пояснений.'},{role:'user',content:'Переведи на '+m[1].trim()+': '+m[2]}],max_tokens:600})});
    const j=await r.json(); if(!r.ok) throw new Error((j.error&&j.error.message)||r.status);
    const txt=((j.choices&&j.choices[0]&&j.choices[0].message&&j.choices[0].message.content)||'').trim()||'…';
    div.textContent='🌐 '+((!txt||txt==='…')?'❌ Пустой ответ — попробуй ещё раз':txt); list.scrollTop=list.scrollHeight;
    try{ queueVoice(txt.slice(0,300),currentMode); }catch(e){}
  }catch(e){ div.textContent='❌ '+e.message; }
}

/* ---------- init ---------- */
function brainInit(){ try{ renderFacts(); renderRem(); }catch(e){} setInterval(()=>{ try{Reminders.check();}catch(e){} },5000); }
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',brainInit); else brainInit();

window.Brain={chatWithTools,tryLocal,councilInChat,morningBriefing,freshNews,translateFlow,exportChat,weatherQuick,ratesQuick,remindQuick,chipCouncil,chipFix,chipTranslate,Facts,Todos,Reminders,detectLang,execTool,toolsOK:toolsState};
window.chipCouncil=chipCouncil; window.chipFix=chipFix; window.chipTranslate=chipTranslate;
})();
