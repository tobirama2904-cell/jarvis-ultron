/* MARK II — UI kit: toast, modal, chat, chips, palette, widgets, gallery, boot. */
import { PERSONAS, IMG_STYLES, GEO } from './config.js';

/* ---------- tiny DOM ---------- */
export const $ = s => document.querySelector(s);
export const $$ = s => Array.from(document.querySelectorAll(s));
export function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
export function mdLite(src) {
  let s = esc(src);
  s = s.replace(/```([\s\S]*?)```/g, (_, c) => `<pre class="code">${c.replace(/^\n/, '')}</pre>`);
  s = s.replace(/`([^`\n]+)`/g, '<code>$1</code>');
  s = s.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
  s = s.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');
  s = s.replace(/\n/g, '<br>');
  return s;
}
export function timeHM(ts) {
  const d = new Date(ts);
  try { return new Intl.DateTimeFormat('ru-RU', { timeZone: GEO.tz, hour: '2-digit', minute: '2-digit' }).format(d); }
  catch (e) {}
  try { return new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' }).format(d); }
  catch (e) { return ''; }
}

/* ---------- toast ---------- */
export function toast(msg, type = 'info', ms = 3400) {
  const box = $('#toasts');
  if (!box) return;
  const d = document.createElement('div');
  d.className = 'toast ' + type;
  d.innerHTML = `<span class="t-ic">${{ info: '◈', ok: '✓', warn: '⚠', err: '✖' }[type] || '◈'}</span><span>${esc(msg)}</span>`;
  box.appendChild(d);
  requestAnimationFrame(() => d.classList.add('show'));
  setTimeout(() => { d.classList.remove('show'); setTimeout(() => d.remove(), 350); }, ms);
  while (box.children.length > 4) box.firstChild.remove();
}

/* ---------- modal ---------- */
export function openModal({ title, body, wide, onClose }) {
  const root = $('#modalRoot');
  const wrap = document.createElement('div');
  wrap.className = 'modal-wrap';
  wrap.innerHTML = `<div class="modal${wide ? ' wide' : ''}" role="dialog">
      <div class="m-head"><span class="m-title">${esc(title)}</span>
      <button class="icon-btn m-x" aria-label="Закрыть">✕</button></div>
      <div class="m-body"></div></div>`;
  const bodyEl = wrap.querySelector('.m-body');
  if (typeof body === 'string') bodyEl.innerHTML = body; else if (body) bodyEl.appendChild(body);
  const close = () => { wrap.classList.remove('show'); setTimeout(() => wrap.remove(), 200); if (onClose) try { onClose(); } catch (e) {} };
  wrap.querySelector('.m-x').onclick = close;
  wrap.addEventListener('mousedown', e => { if (e.target === wrap) close(); });
  root.appendChild(wrap);
  requestAnimationFrame(() => wrap.classList.add('show'));
  return { close, body: bodyEl };
}

/* ---------- chat ---------- */
function nearBottom(el) { return el.scrollHeight - el.scrollTop - el.clientHeight < 140; }
export function scrollChat(force) {
  const c = $('#chat');
  if (c && (force || nearBottom(c))) c.scrollTop = c.scrollHeight;
}
export function addUser(text) {
  const c = $('#chat');
  const d = document.createElement('div');
  d.className = 'msg user';
  d.innerHTML = `<div class="m-tag">ВЫ · ${timeHM(Date.now())}</div><div class="m-bub">${mdLite(text)}</div>`;
  c.appendChild(d); scrollChat(true);
  return d;
}
export function addSys(text) {
  const c = $('#chat');
  const d = document.createElement('div');
  d.className = 'msg sys';
  d.innerHTML = `<div class="m-bub">${mdLite(text)}</div>`;
  c.appendChild(d); scrollChat(true);
  return d;
}
export function addAI(personaId) {
  const p = PERSONAS[personaId] || PERSONAS.jarvis;
  const c = $('#chat');
  const d = document.createElement('div');
  d.className = 'msg ai';
  d.innerHTML = `<div class="m-tag"><span class="dot"></span>${p.name} · <span class="m-time">${timeHM(Date.now())}</span> <span class="m-tool"></span></div>
    <div class="m-bub"><span class="m-txt"></span><span class="caret"></span></div>
    <div class="m-acts" hidden></div>`;
  c.appendChild(d); scrollChat(true);
  const txt = d.querySelector('.m-txt'), tool = d.querySelector('.m-tool');
  let raw = '', rendered = 0, timer = 0;
  const paint = () => { txt.innerHTML = mdLite(raw); scrollChat(false); };
  return {
    el: d,
    append(t) {
      raw += t; rendered++;
      if (!timer) timer = setTimeout(() => { timer = 0; paint(); }, 160);
      else if (rendered % 12 === 0) paint();
    },
    tool(name) {
      tool.textContent = name ? `⚙ ${name}…` : '';
      tool.classList.toggle('on', !!name);
    },
    set(text) { raw = text; paint(); },
    done({ speak, copy } = {}) {
      clearTimeout(timer); paint();
      d.querySelector('.caret').remove();
      const acts = d.querySelector('.m-acts');
      acts.hidden = false;
      if (speak) { const b = document.createElement('button'); b.className = 'mini-btn'; b.textContent = '🔊 Озвучить'; b.onclick = speak; acts.appendChild(b); }
      if (copy) { const b = document.createElement('button'); b.className = 'mini-btn'; b.textContent = '📋 Копировать'; b.onclick = copy; acts.appendChild(b); }
      scrollChat(false);
    },
    text: () => raw,
  };
}
export function addImageMsg(url, prompt, personaName, onOpen) {
  const c = $('#chat');
  const d = document.createElement('div');
  d.className = 'msg ai';
  d.innerHTML = `<div class="m-tag"><span class="dot"></span>${esc(personaName)} · ${timeHM(Date.now())}</div>
    <div class="m-bub img"><img loading="lazy" alt="${esc(prompt)}"><div class="img-cap">${esc(prompt)}</div></div>`;
  const img = d.querySelector('img');
  img.src = url;
  img.onclick = () => onOpen && onOpen(url, prompt);
  c.appendChild(d); scrollChat(true);
  return d;
}

/* ---------- chips ---------- */
export function chips(list) {
  const box = $('#chips');
  box.innerHTML = '';
  list.slice(0, 8).forEach(item => {
    const b = document.createElement('button');
    b.className = 'chip'; b.textContent = item.label;
    b.onclick = () => item.run();
    box.appendChild(b);
  });
}

/* ---------- command palette ---------- */
const commands = [];
export function regCommands(list) { commands.push(...list); }
export function openPalette() {
  const p = $('#palette'), inp = $('#palInput'), lst = $('#palList');
  p.hidden = false; inp.value = '';
  requestAnimationFrame(() => p.classList.add('show'));
  const draw = (filter = '') => {
    const f = filter.toLowerCase();
    const hits = commands.filter(c => !f || c.title.toLowerCase().includes(f) || (c.hint || '').toLowerCase().includes(f)).slice(0, 12);
    lst.innerHTML = hits.map((c, i) => `<div class="pal-item${i === 0 ? ' sel' : ''}" data-i="${commands.indexOf(c)}">
      <span class="pal-ic">${c.icon || '◈'}</span><span class="pal-t">${esc(c.title)}</span><span class="pal-h">${esc(c.hint || '')}</span></div>`).join('')
      || '<div class="pal-empty">Ничего не найдено</div>';
    lst.querySelectorAll('.pal-item').forEach(el => {
      el.onclick = () => { closePalette(); commands[+el.dataset.i].run(); };
    });
  };
  inp.oninput = () => draw(inp.value);
  inp.onkeydown = e => {
    const items = Array.from(lst.querySelectorAll('.pal-item'));
    let si = items.findIndex(x => x.classList.contains('sel'));
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      si = e.key === 'ArrowDown' ? Math.min(items.length - 1, si + 1) : Math.max(0, si - 1);
      items.forEach(x => x.classList.remove('sel'));
      if (items[si]) items[si].classList.add('sel');
    } else if (e.key === 'Enter') {
      const sel = lst.querySelector('.pal-item.sel') || items[0];
      if (sel) { closePalette(); commands[+sel.dataset.i].run(); }
    } else if (e.key === 'Escape') closePalette();
  };
  draw('');
  setTimeout(() => inp.focus(), 50);
}
export function closePalette() {
  const p = $('#palette');
  p.classList.remove('show');
  setTimeout(() => { p.hidden = true; }, 150);
}

/* ---------- widgets ---------- */
export function setNet(ok, text) {
  const d = $('#netDot'), t = $('#netTxt');
  if (d) d.className = 'net-dot ' + (ok ? 'ok' : 'bad');
  if (t) t.textContent = text;
}
export function renderTodos(todos, onToggle, onClear) {
  const box = $('#todoList');
  if (!todos.length) { box.innerHTML = '<div class="empty">Задач нет. Скажи: «добавь задачу …»</div>'; return; }
  box.innerHTML = '';
  todos.slice(-6).reverse().forEach(t => {
    const idx = todos.indexOf(t);
    const d = document.createElement('div');
    d.className = 'todo' + (t.done ? ' done' : '');
    d.innerHTML = `<button class="t-check">${t.done ? '✓' : ''}</button><span>${esc(t.text)}</span>`;
    d.querySelector('.t-check').onclick = () => onToggle(idx);
    box.appendChild(d);
  });
  if (todos.some(t => t.done)) {
    const b = document.createElement('button');
    b.className = 'mini-btn'; b.textContent = '✕ Очистить выполненные';
    b.onclick = onClear; box.appendChild(b);
  }
}
export function renderReminders(list, onDrop) {
  const box = $('#remList');
  const act = list.filter(r => !r.fired);
  if (!act.length) { box.innerHTML = '<div class="empty">Нет активных напоминаний</div>'; return; }
  box.innerHTML = '';
  act.slice(0, 5).forEach(r => {
    const d = document.createElement('div');
    d.className = 'rem';
    const mins = Math.max(0, Math.round((r.at - Date.now()) / 60000));
    d.innerHTML = `<span class="r-t">⏰ ${mins < 1 ? 'меньше минуты' : 'через ' + mins + ' мин'}</span><span class="r-x">${esc(r.text)}</span>`;
    d.title = 'Нажми, чтобы удалить';
    d.onclick = () => onDrop(r.id);
    box.appendChild(d);
  });
}
export function renderGalleryStrip(gallery, onOpen) {
  const box = $('#galStrip');
  if (!gallery.length) { box.innerHTML = '<div class="empty">Пока пусто — «нарисуй …»</div>'; return; }
  box.innerHTML = '';
  gallery.slice(0, 6).forEach(g => {
    const im = document.createElement('img');
    im.src = g.url; im.alt = g.prompt; im.loading = 'lazy';
    im.onclick = () => onOpen(g.url, g.prompt);
    box.appendChild(im);
  });
}

/* ---------- image viewer ---------- */
export function openViewer(url, prompt) {
  const { close } = openModal({ title: 'Просмотр', wide: true,
    body: `<img class="viewer-img" src="${esc(url)}" alt=""><div class="viewer-cap">${esc(prompt || '')}</div>
      <div class="row gap"><a class="btn" href="${esc(url)}" download="mark2.png" target="_blank" rel="noopener">⬇ Скачать</a></div>` });
  return close;
}

/* ---------- creator modal ---------- */
export function openCreator({ onGenerate, gallery }) {
  const div = document.createElement('div');
  div.innerHTML = `
    <label class="fld"><span>Описание кадра</span>
      <textarea id="crPrompt" rows="3" placeholder="Неоновый Душанбе ночью, кинокадр…"></textarea></label>
    <label class="fld"><span>Стиль</span><div class="row wrap" id="crStyles"></div></label>
    <label class="fld"><span>Размер</span>
      <select id="crSize"><option value="1024x1024">Квадрат 1024</option>
      <option value="1792x1024">Широкий 16:9</option><option value="1024x1792">Вертикальный 9:16</option></select></label>
    <div class="row gap"><button class="btn hot" id="crGo">🎨 Создать</button>
      <button class="btn" id="crStory">🎬 Раскадровка ×3</button></div>
    <div class="cr-status" id="crStatus"></div>
    <div class="cr-grid" id="crGrid"></div>`;
  const { close } = openModal({ title: 'Творец — студия образов', wide: true, body: div });
  let style = IMG_STYLES[1];
  const box = div.querySelector('#crStyles');
  IMG_STYLES.forEach(s => {
    const b = document.createElement('button');
    b.className = 'chip' + (s.id === style.id ? ' sel' : '');
    b.textContent = s.label;
    b.onclick = () => { style = s; box.querySelectorAll('.chip').forEach(x => x.classList.remove('sel')); b.classList.add('sel'); };
    box.appendChild(b);
  });
  const paintGrid = () => {
    const g = div.querySelector('#crGrid');
    g.innerHTML = '';
    gallery().slice(0, 9).forEach(item => {
      const im = document.createElement('img');
      im.src = item.url; im.title = item.prompt; im.loading = 'lazy';
      im.onclick = () => openViewer(item.url, item.prompt);
      g.appendChild(im);
    });
  };
  paintGrid();
  div.querySelector('#crGo').onclick = () => {
    const v = div.querySelector('#crPrompt').value.trim();
    if (!v) { toast('Опиши кадр сначала', 'warn'); return; }
    onGenerate({ prompt: v, style, size: div.querySelector('#crSize').value, story: false, status: div.querySelector('#crStatus'), refresh: paintGrid });
  };
  div.querySelector('#crStory').onclick = () => {
    const v = div.querySelector('#crPrompt').value.trim();
    if (!v) { toast('Опиши идею истории сначала', 'warn'); return; }
    onGenerate({ prompt: v, style, size: div.querySelector('#crSize').value, story: true, status: div.querySelector('#crStatus'), refresh: paintGrid });
  };
  return close;
}

/* ---------- settings modal ---------- */
export function openSettings({ key, settings, voices, onSaveKey, onSave, onExport, onWipe, onForget }) {
  const div = document.createElement('div');
  div.innerHTML = `
    <label class="fld"><span>🔑 Ключ Agnes AI ${key ? '<b class="ok">● введён</b>' : '<b class="err">● нет ключа</b>'}</span>
      <div class="row gap"><input type="password" id="sKey" placeholder="sk-..." value="${esc(key)}">
      <button class="btn" id="sKeySave">Сохранить</button></div>
      <small>Ключ хранится только в этом браузере. Взять: platform.agnes-ai.com</small></label>
    <div class="grid2">
      <label class="fld"><span>🗣 Голос озвучки</span><select id="sVoice"></select></label>
      <label class="fld"><span>⏩ Темп речи (${settings.rate.toFixed(2)}×)</span>
        <input type="range" id="sRate" min="0.7" max="1.4" step="0.05" value="${settings.rate}"></label>
    </div>
    <div class="grid2">
      <label class="chk"><input type="checkbox" id="sWake" ${settings.wake ? 'checked' : ''}> Wake-word (Джарвис/Пятница…)</label>
      <label class="chk"><input type="checkbox" id="sSpeak" ${settings.autoSpeak ? 'checked' : ''}> Авто-озвучка ответов</label>
      <label class="chk"><input type="checkbox" id="sSfx" ${settings.sfx ? 'checked' : ''}> Звуки интерфейса</label>
    </div>
    <div class="row gap wrap">
      <button class="btn" id="sExport">⬇ Экспорт памяти</button>
      <button class="btn" id="sForget">🧠 Забыть факты</button>
      <button class="btn danger" id="sWipe">🗑 Стереть всё</button>
    </div>`;
  const { close } = openModal({ title: 'Настройки', body: div });
  const sel = div.querySelector('#sVoice');
  sel.innerHTML = '<option value="">— авто —</option>' + voices.map(v =>
    `<option value="${esc(v.uri)}" ${v.uri === settings.voiceURI ? 'selected' : ''}>${esc(v.name)} (${esc(v.lang)})</option>`).join('');
  div.querySelector('#sKeySave').onclick = () => { onSaveKey(div.querySelector('#sKey').value.trim()); close(); };
  div.querySelector('#sRate').onchange = e => onSave({ rate: +e.target.value });
  sel.onchange = e => onSave({ voiceURI: e.target.value });
  div.querySelector('#sWake').onchange = e => onSave({ wake: e.target.checked });
  div.querySelector('#sSpeak').onchange = e => onSave({ autoSpeak: e.target.checked });
  div.querySelector('#sSfx').onchange = e => onSave({ sfx: e.target.checked });
  div.querySelector('#sExport').onclick = onExport;
  div.querySelector('#sForget').onclick = () => { onForget(); close(); };
  div.querySelector('#sWipe').onclick = () => { if (confirm('Стереть память, задачи, историю?')) { onWipe(); close(); } };
  return close;
}

/* ---------- diagnostics modal ---------- */
export function openDiag(runChecks) {
  const div = document.createElement('div');
  div.innerHTML = '<div class="diag-list"><div class="empty">Запускаю проверки…</div></div><div class="row gap"><button class="btn" id="dRe">↻ Повторить</button></div>';
  openModal({ title: 'Диагностика', wide: true, body: div });
  const paint = async () => {
    const list = div.querySelector('.diag-list');
    list.innerHTML = '<div class="empty">Запускаю проверки…</div>';
    const rows = await runChecks();
    list.innerHTML = rows.map(r =>
      `<div class="diag ${r.ok ? 'ok' : 'bad'}"><span>${r.ok ? '✓' : '✖'}</span><b>${esc(r.name)}</b><span>${esc(r.info || '')}</span></div>`).join('');
  };
  div.querySelector('#dRe').onclick = paint;
  paint();
}

/* ---------- help modal ---------- */
export function openHelp() {
  openModal({ title: 'Команды и приёмы', body: `
    <div class="help">
    <p><b>/img</b> описание — нарисовать · <b>/story</b> идея — раскадровка из 3 кадров · <b>/brief</b> — утренний брифинг</p>
    <p><b>/news</b> — свежие tech-новости · <b>/council</b> вопрос — совет троих · <b>/tr</b> текст — перевод</p>
    <p><b>/remind</b> 10 позвонить маме — напоминание · <b>/todo</b> текст — задача · <b>/persona</b> friday — смена персоны</p>
    <p><b>/diag</b> — диагностика · <b>/clear</b> — очистить чат · <b>/help</b> — эта справка</p>
    <p>Голосом: «Джарвис, …» — команда. ✋ ладонь — замолчи. ✊ кулак — микрофон вкл/выкл. Ctrl+K — палитра команд.</p>
    </div>` });
}

/* ---------- boot ---------- */
export function runBoot(lines) {
  const ov = $('#boot'), log = $('#bootLog'), bar = $('#bootBar');
  return (async () => {
    for (let i = 0; i < lines.length; i++) {
      const d = document.createElement('div');
      d.className = 'boot-line';
      d.innerHTML = `<span class="b-ok">✓</span> ${esc(lines[i])}`;
      log.appendChild(d);
      bar.style.width = Math.round(((i + 1) / lines.length) * 100) + '%';
      await new Promise(r => setTimeout(r, 130 + Math.random() * 160));
    }
    await new Promise(r => setTimeout(r, 350));
    ov.classList.add('done');
    setTimeout(() => ov.remove(), 700);
  })();
}
