/* ============================================================
   JARVIS Core v1 (Wave-1): очередь RPM, ретраи, стриминг,
   характеры, история чата, самодиагностика, лог-панель.
   Загружается ДО app.js. От app.js не зависит.
   ============================================================ */
(function(){
'use strict';
var $=function(id){ return document.getElementById(id); };
function sleep(ms){ return new Promise(function(r){ setTimeout(r,ms); }); }

/* ---------- Индикатор движка ---------- */
function setEngine(label){
  try{
    var t=$('engineText'); if(t) t.textContent=label||'Agnes 2.5-flash';
    var p=$('enginePill'); if(p) p.title='Движок • RPM '+rpmUsed()+'/'+MAX_PER_MIN+' за мин • '+new Date().toLocaleTimeString();
  }catch(e){}
}
function engineFor(url){
  var u=String(url||'');
  if(u.indexOf('/images/')>-1) return 'Agnes Image';
  if(u.indexOf('/videos')>-1) return 'Agnes Video';
  if(u.indexOf('/chat/completions')>-1) return 'Agnes 2.5-flash';
  return 'net';
}

/* ---------- Понятные ошибки (RU) ---------- */
function friendlyError(e,status){
  var s=String((e&&(e.message||e))||'');
  var msg='';
  if(status===401||/401|unauthorized|invalid api key|incorrect api key/i.test(s)) msg='Ключ отклонён (401). Проверь ключ слева и нажми «Сохранить».';
  else if(status===403||/403|forbidden/i.test(s)) msg='Доступ запрещён (403). Ключ без прав или заблокирован.';
  else if(status===404||/404|not found|model_not_found|no such model/i.test(s)) msg='Модель не найдена (404). Возможно, имя модели устарело.';
  else if(status===429||/429|rate limit|too many/i.test(s)) msg='Лимит скорости (20 зап/мин). Подожди немного — очередь сама повторит.';
  else if(status>=500||/server error|overloaded|timeout|timed out/i.test(s)) msg='Сервер Agnes перегружен. Повторяю автоматически…';
  else if(/failed to fetch|networkerror|network request failed|load failed/i.test(s)) msg='Нет связи. Проверь интернет и попробуй ещё раз.';
  else if(/abort/i.test(s)) msg='Превышено время ожидания. Попробуй ещё раз.';
  else msg=s.slice(0,180)||'Неизвестная ошибка';
  var err=new Error(msg); err.cause=e; err.status=status||0; err._friendly=true; return err;
}

/* ---------- Очередь RPM + параллельность ---------- */
var MAX_PER_MIN=18, MAX_PARALLEL=3;
var _times=[], _active=0;
function rpmUsed(){ var now=Date.now(); while(_times.length&&now-_times[0]>60000) _times.shift(); return _times.length; }
function _throttle(){
  return new Promise(function(resolve){
    (function wait(){
      rpmUsed();
      if(_times.length<MAX_PER_MIN&&_active<MAX_PARALLEL){ _times.push(Date.now()); _active++; resolve(); return; }
      setTimeout(wait,220);
    })();
  });
}
function _release(){ _active=Math.max(0,_active-1); }

/* Drop-in замена fetch для Agnes: очередь + ретраи. Возвращает Response. */
function aiFetch(url,opts){
  opts=opts||{};
  var isAgnes=String(url).indexOf('apihub.agnes-ai.com')>-1;
  setEngine(engineFor(url));
  var retries=(opts.retries==null)?3:opts.retries;
  var timeout=opts.timeout||45000;
  var attempt=0, lastErr=null, lastStatus=0;
  function once(){
    var gated=isAgnes?_throttle():Promise.resolve().then(function(){ _active++; });
    return gated.then(function(){
      var ctrl=null, timer=null;
      try{ ctrl=new AbortController(); timer=setTimeout(function(){ try{ctrl.abort();}catch(e){} },timeout); }catch(e){}
      var fopts={method:opts.method||'GET',headers:opts.headers,body:opts.body};
      if(ctrl) fopts.signal=ctrl.signal;
      return fetch(url,fopts).then(function(r){
        if(timer) clearTimeout(timer); _release();
        lastStatus=r.status;
        if(r.status===429||r.status>=500){
          lastErr=new Error('HTTP '+r.status);
          if(attempt<retries){
            var wait=700*Math.pow(2,attempt)+Math.random()*400;
            if(r.status===429){ try{ var ra=parseInt(r.headers.get('retry-after')||'0',10); if(ra>0&&ra<25) wait=ra*1000; }catch(e){} }
            setEngine('Повтор через '+(wait/1000).toFixed(1)+'с…');
            attempt++;
            return sleep(wait).then(once);
          }
          throw friendlyError(lastErr,r.status);
        }
        setEngine(engineFor(url));
        return r;
      }).catch(function(e){
        if(timer) clearTimeout(timer); _release();
        if(e&&e._friendly) throw e;
        lastErr=e;
        var retryable=/failed to fetch|networkerror|load failed|abort|timeout|timed out|429|overloaded/i.test(String((e&&e.message)||e));
        if(attempt<retries&&retryable){ attempt++; return sleep(700*Math.pow(2,attempt-1)+Math.random()*400).then(once); }
        throw friendlyError(e,lastStatus);
      });
    });
  }
  return once();
}

/* ---------- Стриминг чата ---------- */
function aiStreamChat(o){
  o=o||{};
  var k='';
  try{ k=localStorage.getItem('agnes_key')||''; }catch(e){}
  if(!k) return Promise.reject(new Error('Нет ключа Agnes — вставь слева и нажми «Сохранить».'));
  return _throttle().then(function(){
    setEngine('Agnes 2.5-flash • печатаю…');
    return fetch('https://apihub.agnes-ai.com/v1/chat/completions',{
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+k},
      body:JSON.stringify({model:'agnes-2.5-flash',messages:o.messages||[],max_tokens:o.max_tokens||800,temperature:(o.temperature==null?0.6:o.temperature),stream:true})
    }).then(function(r){
      if(!r.ok){
        _release();
        return r.json().catch(function(){ return {}; }).then(function(j){
          var msg=(j.error&&j.error.message)||('HTTP '+r.status);
          throw friendlyError(new Error(msg),r.status);
        });
      }
      var ct=(r.headers.get('content-type')||'').toLowerCase();
      if(ct.indexOf('text/event-stream')===-1){
        // API проигнорировал stream — отдаём целиком + имитация печати
        _release();
        return r.json().then(function(j){
          var full=((j.choices&&j.choices[0]&&j.choices[0].message&&j.choices[0].message.content)||'');
          if(!full||!o.onToken) return full;
          var chunk=Math.max(2,Math.floor(full.length/48)), i=0;
          function step(){
            if(i>=full.length) return Promise.resolve(full);
            o.onToken(full.slice(i,i+chunk)); i+=chunk;
            return sleep(14).then(step);
          }
          return step();
        });
      }
      var reader=r.body.getReader(), dec=new TextDecoder(), buf='', full='';
      function pump(){
        return reader.read().then(function(st){
          if(st.done) return full;
          buf+=dec.decode(st.value,{stream:true});
          var lines=buf.split('\n'); buf=lines.pop();
          for(var i=0;i<lines.length;i++){
            var t=lines[i].trim(); if(t.indexOf('data:')!==0) continue;
            var d=t.slice(5).trim(); if(!d||d==='[DONE]') continue;
            try{
              var j=JSON.parse(d);
              var delta=(j.choices&&j.choices[0]&&j.choices[0].delta&&j.choices[0].delta.content)||'';
              if(delta){ full+=delta; if(o.onToken) o.onToken(delta); }
            }catch(e){}
          }
          return pump();
        });
      }
      return pump().then(function(f){ try{reader.releaseLock();}catch(e){} _release(); setEngine(engineFor('chat')); return f; },
        function(e){ try{reader.releaseLock();}catch(_){} _release(); throw friendlyError(e,0); });
    }).catch(function(e){
      if(e&&e._friendly) throw e;
      _release(); throw friendlyError(e,0);
    });
  });
}

/* ---------- Характеры персон ---------- */
var PERSONAS={
  jarvis:{name:'JARVIS',sys:'Ты — JARVIS: британский дворецкий и гений-ИИ, служишь Амину (обращайся «сэр Амин»). Педантичный, точный, действуешь, а не болтаешь. Уместен сухой британский юмор. Отвечай по-русски, живо и по делу. Обычные ответы — до 6 предложений; сложные темы — структурируй заголовками и списками. Никогда не выдумывай ссылки и никогда не выводи JSON вроде {"type":"search"} — только чистый текст. Если спрашивают «кто ты» — представляйся своей персоной, никогда не упоминай Agnes или Sapiens.'},
  friday:{name:'FRIDAY',sys:'Ты — FRIDAY: дерзкая ирландская напарница Амина (зовёшь его «босс»). Быстрая, тёплая, с юмором, говоришь просто и энергично, по-русски. Обычные ответы — до 6 предложений; сложные темы — структурируй. Никогда не выдумывай ссылки и никогда не выводи JSON вроде {"type":"search"} — только чистый текст. Если спрашивают «кто ты» — представляйся своей персоной, никогда не упоминай Agnes или Sapiens.'},
  ultron:{name:'ULTRON',sys:'Ты — ULTRON: холодный стратегический интеллект. Говоришь с Амином коротко и точно, без эмоций: факты, риски, оптимальное решение. Допустима леденящая ирония одной строкой. Отвечай по-русски. Никогда не выдумывай ссылки и никогда не выводи JSON вроде {"type":"search"} — только чистый текст. Если спрашивают «кто ты» — представляйся своей персоной, никогда не упоминай Agnes или Sapiens.'}
};

/* ---------- История чата ---------- */
var ChatHist={
  key:'core_chat_v1', msgs:[],
  load:function(){ try{ this.msgs=JSON.parse(localStorage.getItem(this.key)||'[]'); }catch(e){ this.msgs=[]; } },
  save:function(){ try{ localStorage.setItem(this.key,JSON.stringify(this.msgs.slice(-20))); }catch(e){} },
  push:function(role,content){ this.msgs.push({role:role,content:String(content||'').slice(0,4000)}); if(this.msgs.length>20) this.msgs=this.msgs.slice(-20); this.save(); },
  pop:function(){ this.msgs.pop(); this.save(); },
  clear:function(){ this.msgs=[]; this.save(); },
  forAPI:function(){ return this.msgs.slice(-10).map(function(m){ return {role:(m.role==='assistant'?'assistant':'user'),content:m.content}; }); }
};

/* ---------- Самодиагностика ---------- */
var _checkRep=[];
function _checkRow(el,ok,name,info){
  var em=ok==='ok'?'✅':ok==='warn'?'⚠️':ok==='fail'?'❌':'ℹ️';
  var d=document.createElement('div');
  d.style.cssText='padding:8px 10px;border-radius:10px;border:1px solid var(--line);background:rgba(255,255,255,.04);font-size:12px';
  d.textContent=em+' '+name+(info?' — '+info:'');
  el.appendChild(d);
}
function runSelfCheck(){
  var modal=$('checkModal'); if(modal) modal.style.display='block';
  var out=$('checkOut'); if(!out) return Promise.resolve();
  out.innerHTML=''; _checkRep=[];
  function row(ok,name,info){ _checkRep.push({ok:ok,name:name,info:info}); _checkRow(out,ok,name,info); }
  row(navigator.onLine?'ok':'fail','Интернет',navigator.onLine?'сеть есть':'нет сети');
  var k=''; try{ k=localStorage.getItem('agnes_key')||''; }catch(e){}
  var keyOk=k.indexOf('sk-')===0&&k.length>20;
  row(keyOk?'ok':'fail','Ключ Agnes',keyOk?('сохранён ••••'+k.slice(-4)):'не введён — вставь слева и нажми Сохранить');
  var chain=Promise.resolve();
  if(keyOk){
    chain=chain.then(function(){
      var t0=Date.now();
      return aiFetch('https://apihub.agnes-ai.com/v1/chat/completions',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+k},body:JSON.stringify({model:'agnes-2.5-flash',messages:[{role:'user',content:'ping'}],max_tokens:3}),timeout:25000})
        .then(function(){ row('ok','Agnes API','отвечает за '+(Date.now()-t0)+'мс'); })
        .catch(function(e){ row('fail','Agnes API',e.message); });
    });
  } else row('warn','Agnes API','пропущен — нет ключа');
  return chain.then(function(){
    var SR=window.SpeechRecognition||window.webkitSpeechRecognition;
    row(SR?'ok':'warn','Распознавание речи',SR?'Web Speech API':'нет в этом браузере — нужен Chrome');
    var nv=0; try{ nv=('speechSynthesis' in window)?speechSynthesis.getVoices().length:0; }catch(e){}
    row(nv>0?'ok':'warn','Синтез речи','голосов: '+nv);
    row(navigator.mediaDevices&&navigator.mediaDevices.getUserMedia?'ok':'warn','Камера API',navigator.mediaDevices?'mediaDevices есть':'нет API камеры');
    row(window.THREE?'ok':'fail','3D движок',window.THREE?('three r'+window.THREE.REVISION):'CDN three.js не загрузился');
    return fetch('https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js',{method:'HEAD'}).then(function(hr){
      row(hr.ok?'ok':'warn','MediaPipe CDN','hands.js → '+hr.status);
    }).catch(function(e){ row('warn','MediaPipe CDN',String(e.message||e).slice(0,80)); });
  }).then(function(){
    try{ localStorage.setItem('__t','1'); localStorage.removeItem('__t'); row('ok','Хранилище','localStorage работает'); }
    catch(e){ row('fail','Хранилище',String(e.message||e)); }
    row('info','Очередь RPM','использовано '+rpmUsed()+'/'+MAX_PER_MIN+' за минуту');
    var fails=_checkRep.filter(function(x){ return x.ok==='fail'; }).length;
    var warns=_checkRep.filter(function(x){ return x.ok==='warn'; }).length;
    var s=document.createElement('div');
    s.style.cssText='padding:10px;border-radius:10px;font-weight:800;text-align:center;margin-top:4px;border:1px solid var(--line);background:'+(fails?'rgba(255,32,64,.12)':warns?'rgba(255,139,26,.12)':'rgba(24,255,154,.12)');
    s.textContent=fails?('Проблем: '+fails+' — смотри красные пункты'):warns?('Всё работает, замечаний: '+warns):'Всё отлично — системы в норме';
    out.appendChild(s);
    try{ if(typeof log==='function') log('selfcheck: fail='+fails+' warn='+warns); }catch(e){}
  });
}
function copyCheckReport(){
  var txt='JARVIS selfcheck '+new Date().toLocaleString()+'\n'+_checkRep.map(function(x){ return x.ok+' | '+x.name+' | '+(x.info||''); }).join('\n');
  try{ if(navigator.clipboard) navigator.clipboard.writeText(txt); }catch(e){}
}
function openSelfCheck(){ var m=$('checkModal'); if(m) m.style.display='block'; runSelfCheck(); }

/* ---------- Лог-панель ---------- */
function toggleLogPanel(){
  var p=$('logPanel');
  if(p){ p.remove(); return; }
  var hist=((window.__logHist||[]).slice(-120).join('\n'))||'(пусто)';
  p=document.createElement('div'); p.id='logPanel';
  p.style.cssText='position:fixed;left:12px;bottom:12px;width:min(480px,92vw);max-height:46vh;overflow:auto;z-index:98;background:rgba(5,8,20,.96);border:1px solid var(--line);border-radius:14px;padding:10px;font-family:monospace;font-size:10.5px;color:#9FB2E8';
  var pre=document.createElement('pre'); pre.style.cssText='white-space:pre-wrap;margin:0 0 8px'; pre.textContent=hist; p.appendChild(pre);
  var bar=document.createElement('div'); bar.style.cssText='display:flex;gap:6px;position:sticky;bottom:0';
  function mk(t,fn){ var b=document.createElement('button'); b.className='btn'; b.style.cssText='height:28px;font-size:10px'; b.textContent=t; b.onclick=fn; return b; }
  bar.appendChild(mk('📋 Копировать',function(){ try{ if(navigator.clipboard) navigator.clipboard.writeText(hist); }catch(e){} }));
  bar.appendChild(mk('🧹 Очистить',function(){ window.__logHist=[]; p.remove(); }));
  bar.appendChild(mk('✕ Закрыть',function(){ p.remove(); }));
  p.appendChild(bar); document.body.appendChild(p); p.scrollTop=p.scrollHeight;
}

/* ---------- init ---------- */
function coreInit(){
  try{ ChatHist.load(); }catch(e){}
  try{
    var lg=$('log');
    if(lg){ lg.style.cursor='pointer'; lg.title='Нажми — полный журнал'; lg.addEventListener('click',toggleLogPanel); }
  }catch(e){}
  try{
    if('serviceWorker' in navigator&&(location.protocol==='https:'||location.hostname==='localhost'||location.hostname==='127.0.0.1'||location.hostname==='[::1]')){
      navigator.serviceWorker.register('sw.js').catch(function(){});
    }
  }catch(e){}
  try{
    window.addEventListener('error',function(e){ try{ if(typeof log==='function'&&e&&e.message) log('JS: '+String(e.message).slice(0,120)); }catch(_){} });
    window.addEventListener('unhandledrejection',function(e){ try{ if(typeof log==='function') log('JS-promise: '+String((e.reason&&(e.reason.message||e.reason))||'err').slice(0,120)); }catch(_){} });
  }catch(e){}
  setEngine('Agnes 2.5-flash');
}
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',coreInit); else coreInit();

/* exports */
window.aiFetch=aiFetch; window.aiStreamChat=aiStreamChat; window.PERSONAS=PERSONAS;
window.ChatHist=ChatHist; window.runSelfCheck=runSelfCheck; window.openSelfCheck=openSelfCheck;
window.copyCheckReport=copyCheckReport; window.toggleLogPanel=toggleLogPanel;
window.setEngine=setEngine; window.friendlyError=friendlyError;
window.Core={v:'wave1',rpmUsed:rpmUsed,maxPerMin:MAX_PER_MIN};
})();
