/* MARK II — orchestrator: wires brain, voice, vision, fx, ui. */
import { APP, PERSONAS, PERSONA_IDS, IMG_STYLES } from './config.js';
import * as store from './store.js';
import { friendlyError, genImage, ping, quickChat, lastLatency } from './api.js';
import { answer, fastPath, briefing, council, translateFlow, toolWeather, toolRates, toolNews,
  dushanbeClock, onReminderScheduled, setVisionCtx } from './brain.js';
import { matchPower, POWERS, trapActive } from './powers.js';
import { Voice } from './voice.js';
import { Vision } from './vision.js';
import { Sfx, unlockAudio, BgFX, Reactor, confetti } from './fx.js';
import { $, esc, toast, openModal, openViewer, openCreator, openSettings, openDiag, openHelp,
  addUser, addSys, addAI, addImageMsg, chips, regCommands, openPalette, closePalette,
  setNet, renderTodos, renderReminders, renderGalleryStrip, runBoot, scrollChat, askChoice } from './ui.js';

/* ================= state ================= */
const S = {
  persona: store.get().settings.persona || 'jarvis',
  busy: false, abort: null, interacted: false,
  voice: null, vision: null, reactor: null,
  style: IMG_STYLES[1], lastPrompt: '',
};
const persona = () => PERSONAS[S.persona] || PERSONAS.jarvis;

/* ================= persona ================= */
function applyPersona(id, silent) {
  if (!PERSONAS[id]) id = 'jarvis';
  S.persona = id;
  store.get().settings.persona = id; store.save();
  document.documentElement.dataset.persona = id;
  const p = persona();
  if (S.reactor) S.reactor.setColor(p.color);
  $$('#personaPills button').forEach(b => b.classList.toggle('sel', b.dataset.p === id));
  $('#reactorName').textContent = p.name;
  $('#reactorTitle').textContent = p.title;
  if (!silent) {
    Sfx.open();
    const h = addAI(id); h.set(p.hello); h.done(aiActions(h));
    say(p.hello);
    toast('Персона: ' + p.name, 'ok');
  }
}
const $$ = s => Array.from(document.querySelectorAll(s));

/* ================= speech out ================= */
function say(text) {
  if (!store.get().settings.autoSpeak || !S.interacted) return;
  S.voice.speak(text, S.persona);
}
function aiActions(h) {
  return {
    speak: () => { unlockAudio(); S.voice.speak(h.text(), S.persona); },
    copy: () => { navigator.clipboard.writeText(h.text()).then(() => toast('Скопировано', 'ok')).catch(() => toast('Не скопировалось', 'warn')); },
  };
}

/* ================= messaging ================= */
async function send(raw) {
  const text = String(raw || '').trim();
  if (!text) return;
  unlockAudio();
  if (S.busy) { toast('Я ещё думаю… ⏹ — прервать', 'warn'); return; }
  if (text.startsWith('/')) { routeCommand(text); return; }

  addUser(text);
  store.pushHistory('user', text);
  S.reactor.boom(); Sfx.send();
  $('#input').value = ''; autoresize();

  // offline natural intents (instant, no RPM spent)
  const off = await offlineIntent(text);
  if (off) return;

  const pw = matchPower(text);
  if (pw) { await runPower(pw.p, pw.arg, pw.cmd, pw.trapped); return; }

  const fast = fastPath(text);
  if (fast) {
    const h = addAI(S.persona); h.set(fast); h.done(aiActions(h));
    store.pushHistory('assistant', fast);
    say(fast); Sfx.recv(); afterAnswer();
    return;
  }
  if (!store.hasKey()) {
    const h = addAI(S.persona);
    h.set('⚠ ' + friendlyError({ name: 'x', message: '' }).replace(/^Ошибка: /, '') + '\n\nБез ключа работают: время, счёт, погода, курсы, новости, задачи, напоминания. Остальное — после вставки ключа в ⚙️.');
    h.done(aiActions(h));
    return;
  }
  S.busy = true; setBusy(true);
  S.abort = new AbortController();
  const h = addAI(S.persona);
  try {
    const out = await answer(text, { key: store.getKey(), personaId: S.persona,
      history: store.get().history, onToken: t => h.append(t),
      onTool: (name, _a, phase) => h.tool(phase === 'run' ? name : ''),
      signal: S.abort.signal });
    h.tool('');
    if (out && !h.text()) h.set(out); // direct (non-stream) reply path
    if (!out) h.set('⚠ Пустой ответ от нейросети. Попробуй переформулировать.');
    h.done(aiActions(h));
    store.pushHistory('assistant', h.text());
    say(h.text()); Sfx.recv();
    if (S.voice.listening) S.voice.openDialog(9);
  } catch (e) {
    if (e && e.name === 'AbortError') { h.set('⏹ Остановлено.'); h.done(); }
    else { h.set('⚠ ' + friendlyError(e)); h.done(aiActions(h)); Sfx.error(); }
  } finally {
    S.busy = false; setBusy(false); S.abort = null; afterAnswer();
  }
}
function setBusy(b) { document.body.classList.toggle('busy', b); }
function afterAnswer() { defaultChips(); }

/* offline intents: weather/rates/news/reminder/todo/remember/image/help — no key needed */
async function offlineIntent(text) {
  const t = text.toLowerCase().trim();
  const emit = (out) => {
    const h = addAI(S.persona); h.set(out); h.done(aiActions(h));
    store.pushHistory('assistant', out); say(out); Sfx.recv(); afterAnswer();
  };
  if (/^(погода|какая погода|что по погоде|прогноз)/.test(t)) {
    emit(await toolWeather().catch(e => '⚠ ' + e.message)); return true;
  }
  if (/(курс|доллар|сколько стоит доллар|tjs)/.test(t) && t.length < 60) {
    emit(await toolRates().catch(e => '⚠ ' + e.message)); return true;
  }
  if (/^(новости|что нового|свежие новости|tech новости)/.test(t)) {
    emit('📰 Сейчас на передовой:\n' + (await toolNews().catch(e => '⚠ ' + e.message))); return true;
  }
  let m = t.match(/напомни( мне)? через (\d+)\s*(секунд|сек|с|s|минут|мин|м|min|час|ч|h)?\s*(.+)?/);
  if (m) {
    const n = +m[2], u = (m[3] || 'мин');
    const mins = /сек|с$|s/.test(u) ? n / 60 : (/час|ч|h/.test(u) ? n * 60 : n);
    const r = store.addReminder((m[4] || 'Напоминание').trim(), Date.now() + mins * 60000);
    confirmReminder(r);
    emit(`⏰ Принято: напомню «${r.text}» через ${n} ${u}.`);
    return true;
  }
  m = text.match(/(?:добавь задачу|запиши в задачи|новая задача)[:\s]+(.+)/i);
  if (m) { const td = store.addTodo(m[1]); refreshTasks(); emit(td ? `✓ Задача записана: ${td.text}` : 'Пустая задача.'); return true; }
  m = text.match(/(?:запомни)[:\s]+(.+)/i);
  if (m) { emit(store.addFact(m[1]) ? `🧠 Запомнил: ${m[1].trim()}` : 'Я уже это знаю.'); return true; }
  m = text.match(/(?:нарисуй|сгенерируй|создай картинку|создай арт|изобрази)\s+(.+)/i);
  if (m) { imageFlow(m[1].trim(), S.style, '1024x1024'); return true; }
  if (/раскадровка|storyboard/i.test(t) && t.length > 12) { storyFlow(text.replace(/раскадровка|storyboard/ig, '').trim()); return true; }
  if (/^(помощь|help|что ты умеешь|команды)/.test(t)) { cmdHelp(''); return true; }
  return false;
}

/* ================= powers ================= */
function buildCtx() {
  return {
    key: store.getKey(), personaId: S.persona, store,
    notify: t => { addSys(t); say(t); toast(String(t).slice(0, 120), 'info', 5000); Sfx.notify(); },
    ask: (q, opts) => askChoice(q, opts),
    toast, download,
    speak: t => say(t), stopSpeak: () => S.voice.stopAll(),
    set: patch => { Object.assign(store.get().settings, patch); store.save(); },
    paintToggles: () => {
      const s = store.get().settings;
      $('#tglWake').classList.toggle('on', !!s.wake);
      $('#tglVoice').classList.toggle('on', !!s.autoSpeak);
      $('#tglSfx').classList.toggle('on', !!s.sfx);
    },
    shot: () => S.vision.snapshot(), camLive: () => S.vision.live,
    lastMood: () => S.vision.lastMood,
    torch: () => S.vision.torch(),
    micToggle: () => toggleMic(),
    camToggle: async () => { $('#btnCam').click(); await new Promise(r => setTimeout(r, 1500)); return S.vision.live; },
    camFlip: () => S.vision.flip(),
    refreshGal: () => refreshGallery(), refreshTasks: () => refreshTasks(),
    fx: { boom: () => S.reactor.boom(), confetti: () => confetti(), sfx: n => { if (Sfx[n]) Sfx[n](); } },
  };
}
async function runPower(p, arg, cmd, trapped) {
  const h = addAI(S.persona);
  const before = document.querySelectorAll('.msg.ai').length;
  h.set(`\u25c8 ${p.title}…`);
  const finish = text => {
    if (document.querySelectorAll('.msg.ai').length > before) {
      h.el.remove();
      const h2 = addAI(S.persona);
      h2.set(text); h2.done(aiActions(h2));
    } else { h.set(text); h.done(aiActions(h)); }
    store.pushHistory('assistant', text);
  };
  try {
    const r = await p.run(arg || '', buildCtx(), !!trapped, cmd || '');
    if (r && typeof r === 'object' && (r.image || r.text)) {
      if (r.text) finish(r.text); else h.el.remove();
      if (r.image) addImageMsg(r.image, String(r.text || p.title).slice(0, 140), persona().name, (u, t) => openViewer(u, t));
      Sfx.recv();
    } else {
      finish(String(r == null ? '' : r) || '\u25c8 Готово.');
      Sfx.recv();
    }
  } catch (e) {
    console.error('power', p.id, e);
    h.set('\u26a0 Не вышло: ' + (e.message || e)); h.done(); Sfx.error();
  }
  afterAnswer();
}
function cmdHelp(arg) {
  const q = (arg || '').toLowerCase().trim();
  const base = [
    ['◈', '/brief — утренний брифинг'], ['📰', '/news — новости'], ['🧠', '/council вопрос — совет троих'],
    ['🌐', '/tr текст — перевод'], ['🎨', '/img описание — нарисовать'], ['🎬', '/story идея — раскадровка'],
    ['⏰', '/remind 10 текст'], ['📝', '/todo текст'], ['◈', '/persona friday'], ['🔍', '/diag'], ['🧹', '/clear'],
  ];
  const list = POWERS.filter(p => p.id !== 'help' && (!q || p.cat.toLowerCase().includes(q) || p.title.toLowerCase().includes(q) || p.id.includes(q) || (p.hint || '').toLowerCase().includes(q)));
  const cats = {};
  list.forEach(p => { (cats[p.cat] = cats[p.cat] || []).push(p); });
  let out = q ? `❓ По «${arg}»:
` : `❓ **${list.length} сил + команды:**
`;
  if (!q) out += '\n**Основное:**\n' + base.map(b => `${b[0]} ${b[1]}`).join('\n');
  for (const [c, arr] of Object.entries(cats)) out += `\n**${c}:**\n` + arr.map(p => `${p.icon} ${p.hint}`).join('\n');
  const h = addAI(S.persona); h.set(out.slice(0, 3800)); h.done(aiActions(h));
  store.pushHistory('assistant', 'help-shown');
}

/* ================= commands ================= */
function routeCommand(line) {
  const [cmd, ...rest] = line.slice(1).split(/\s+/);
  const arg = rest.join(' ').trim();
  addUser(line); store.pushHistory('user', line);
  const c = (cmd || '').toLowerCase();
  ({ img: () => arg ? imageFlow(arg, S.style, '1024x1024') : needArg('Опиши кадр: `/img неоновый Душанбе`'),
     story: () => arg ? storyFlow(arg) : needArg('Опиши идею: `/story погоня по ночному городу`'),
     brief: cmdBrief, news: cmdNews, council: () => arg ? cmdCouncil(arg) : needArg('Вопрос: `/council стоит ли…`'),
     tr: () => arg ? cmdTr(arg) : needArg('Текст: `/tr hello world`'),
     remind: () => cmdRemind(arg), todo: () => { if (!arg) return needArg('`/todo купить молоко`'); store.addTodo(arg); refreshTasks(); sysOk('✓ Задача записана.'); },
     persona: () => switchPersona(arg), diag: cmdDiag, clear: () => { $('#chat').innerHTML = ''; store.clearHistory(); sysOk('Чат очищен.'); },
     help: () => cmdHelp(arg),
  }[c] || (() => { const pw = matchPower(line); if (pw) runPower(pw.p, pw.arg, pw.cmd, pw.trapped); else sysOk('Неизвестная команда. Напиши /help.'); }))();
  $('#input').value = ''; autoresize();
}
function needArg(hint) { sysOk(hint); }
function sysOk(t) { const s = addSys(t); return s; }

/* ================= images ================= */
async function toEnglish(prompt) {
  if (!/[а-яё]/i.test(prompt) || !store.hasKey()) return prompt;
  try {
    const en = await quickChat({ key: store.getKey(), maxTokens: 150, messages: [
      { role: 'system', content: 'Translate the image prompt to English, single line, rich visual detail, no quotes.' },
      { role: 'user', content: prompt } ] });
    return en.trim().replace(/^["']|["']$/g, '') || prompt;
  } catch (e) { return prompt; }
}
async function imageFlow(prompt, style, size) {
  if (!store.hasKey()) { sysOk('⚠ Генерация картинок требует API-ключ (⚙️ Настройки).'); return; }
  S.lastPrompt = prompt;
  const h = addAI(S.persona);
  h.set('🎨 Готовлю кадр…'); S.reactor.boom(); Sfx.open();
  try {
    const en = await toEnglish(prompt);
    h.set('🎨 Рисую: ' + prompt);
    const { url } = await genImage({ key: store.getKey(), prompt: en + (style.suffix || ''), size });
    store.addImage(url, prompt); refreshGallery();
    h.el.remove();
    addImageMsg(url, prompt, persona().name, (u, p) => openViewer(u, p));
    Sfx.confirm();
    chips([{ label: '🎨 Ещё вариант', run: () => imageFlow(prompt, style, size) },
      { label: '🎬 Раскадровка', run: () => storyFlow(prompt) }, ...defaultChipDefs().slice(0, 4)]);
  } catch (e) { h.set('⚠ ' + friendlyError(e)); h.done(); Sfx.error(); }
}
async function storyFlow(idea) {
  if (!store.hasKey()) { sysOk('⚠ Раскадровка требует API-ключ (⚙️ Настройки).'); return; }
  const h = addAI(S.persona);
  h.set('🎬 Пишу сценарий…'); Sfx.open();
  try {
    let frames = [idea + ' — establishing shot', idea + ' — action close-up', idea + ' — epic finale'];
    try {
      const sc = await quickChat({ key: store.getKey(), maxTokens: 300, messages: [
        { role: 'system', content: 'Expand the idea into exactly 3 numbered cinematic shot prompts in English, one per line, no extra text.' },
        { role: 'user', content: idea } ] });
      const lines = sc.split('\n').map(s => s.replace(/^\d+[.)]\s*/, '').trim()).filter(Boolean);
      if (lines.length >= 3) frames = lines.slice(0, 3);
    } catch (e) {}
    for (let i = 0; i < 3; i++) {
      h.set(`🎬 Кадр ${i + 1}/3: рисую…\n${frames[i]}`);
      const { url } = await genImage({ key: store.getKey(), prompt: frames[i] + ', cinematic film still', size: '1792x1024' });
      store.addImage(url, `Кадр ${i + 1}: ${idea}`); refreshGallery();
      addImageMsg(url, `Кадр ${i + 1}/3 — ${idea}`, persona().name, (u, p) => openViewer(u, p));
    }
    h.el.remove();
    const done = addAI(S.persona);
    done.set(`🎬 Раскадровка готова: 3 кадра по идее «${idea}». Нажми на кадр, чтобы рассмотреть.`);
    done.done(aiActions(done)); Sfx.confirm();
  } catch (e) { h.set('⚠ ' + friendlyError(e)); h.done(); Sfx.error(); }
}

/* ================= briefing / news / council / translate / remind ================= */
async function cmdBrief() {
  const h = addAI(S.persona); h.set('◈ Собираю брифинг…'); Sfx.open();
  try { const b = await briefing({ key: store.getKey(), personaId: S.persona }); h.set(b || '⚠ Пустой ответ, попробуй ещё раз.'); h.done(aiActions(h)); store.pushHistory('assistant', b); say(String(b).slice(0, 500)); }
  catch (e) { h.set('⚠ ' + friendlyError(e)); h.done(); }
}
async function cmdNews() {
  const h = addAI(S.persona); h.set('📰 Читаю ленты…');
  try {
    const raw = await toolNews();
    let out = '📰 Сейчас на передовой:\n' + raw;
    if (store.hasKey()) {
      try {
        const d = await quickChat({ key: store.getKey(), maxTokens: 350, messages: [
          { role: 'system', content: `Ты ${persona().name}. Выбери 3 главные новости и подай живо по-русски, 5-6 строк.` },
          { role: 'user', content: raw } ] });
        out = '📰 Дайджест:\n' + d.trim();
      } catch (e) {}
    }
    h.set(out || '⚠ Пустой ответ, попробуй ещё раз.'); h.done(aiActions(h)); store.pushHistory('assistant', out); say(String(out).slice(0, 400));
  } catch (e) { h.set('⚠ ' + e.message); h.done(); }
}
async function cmdCouncil(q) {
  if (!store.hasKey()) { sysOk('⚠ Совет троих требует API-ключ (⚙️ Настройки).'); return; }
  const h = addAI(S.persona); h.set('🧠 Созываю совет…'); Sfx.open();
  try {
    const { opinions, final } = await council(q, { key: store.getKey() });
    const t = '🧠 СОВЕТ ТРОИХ\n\n' + opinions.map(([id, x]) => `**${id.toUpperCase()}**: ${x}`).join('\n\n') + `\n\n◈ **ВЕРДИКТ VISION**: ${final}`;
    h.set(t || '⚠ Пустой ответ, попробуй ещё раз.'); h.done(aiActions(h)); store.pushHistory('assistant', t); say(final);
  } catch (e) { h.set('⚠ ' + friendlyError(e)); h.done(); }
}
async function cmdTr(text) {
  const h = addAI(S.persona); h.set('🌐 Перевожу…');
  try { const t = await translateFlow(text, { key: store.getKey() }); h.set('🌐 ' + (t || 'пустой ответ')); h.done(aiActions(h)); }
  catch (e) { h.set('⚠ ' + friendlyError(e)); h.done(); }
}
function cmdRemind(arg) {
  const m = arg.match(/(\d+)\s*(сек|с|min|мин|м|час|ч|h)?\s+(.+)/i);
  if (!m) { needArg('`/remind 10 позвонить маме` — минуты по умолчанию'); return; }
  const n = +m[1], u = (m[2] || 'мин').toLowerCase();
  const mins = /сек|^с$/.test(u) ? n / 60 : (/час|ч|h/.test(u) ? n * 60 : n);
  const r = store.addReminder(m[3].trim(), Date.now() + mins * 60000);
  confirmReminder(r);
  sysOk(`⏰ Напомню «${r.text}» через ${n} ${u}.`);
}
function confirmReminder(r) {
  refreshTasks();
  toast(`⏰ Напомню: ${r.text}`, 'ok');
  if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission().catch(() => {});
}
function switchPersona(arg) {
  const a = (arg || '').toLowerCase();
  const hit = PERSONA_IDS.find(id => id === a || PERSONAS[id].name.toLowerCase() === a) ||
    (a.includes('пятн') || a.includes('friday') || a.includes('фрайди') ? 'friday' : null) ||
    (a.includes('джарв') || a.includes('jarv') ? 'jarvis' : null) ||
    (a.includes('ультр') || a.includes('ultr') ? 'ultron' : null) ||
    (a.includes('виж') || a.includes('vis') ? 'vision' : null);
  if (!hit) { sysOk('Персоны: jarvis · friday · ultron · vision'); return; }
  applyPersona(hit);
}
function cmdDiag() {
  openDiag(async () => {
    const rows = [];
    rows.push({ name: 'Сеть', ok: navigator.onLine, info: navigator.onLine ? 'online' : 'offline' });
    rows.push({ name: 'API-ключ', ok: store.hasKey(), info: store.hasKey() ? 'введён' : 'нет — вставь в ⚙️' });
    if (store.hasKey()) {
      try { const p = await ping(store.getKey()); rows.push({ name: 'Agnes API', ok: true, info: `${p.ms} мс · моделей: ${p.models.length}` }); }
      catch (e) { rows.push({ name: 'Agnes API', ok: false, info: friendlyError(e).slice(0, 60) }); }
    }
    const ru = S.voice.listVoices().filter(v => (v.lang || '').toLowerCase().startsWith('ru')).length;
    rows.push({ name: 'Распознавание речи', ok: S.voice.sttOK, info: S.voice.sttOK ? 'Web Speech' : 'не поддерживается' });
    rows.push({ name: 'Озвучка', ok: S.voice.ttsOK, info: `русских голосов: ${ru}` });
    rows.push({ name: 'Камера', ok: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia), info: S.vision.live ? 'включена' : 'готова' });
    rows.push({ name: 'Уведомления', ok: !('Notification' in window) || Notification.permission !== 'denied', info: 'Notification' in window ? Notification.permission : 'n/a' });
    rows.push({ name: 'Микрофон', ok: true, info: (S.voice.listening ? 'слушает' : 'выкл') + ' · слышал: ' + (S.voice.lastHeard || '—') + (S.voice.lastErr ? ' · err: ' + S.voice.lastErr : '') });
    rows.push({ name: 'Силы', ok: true, info: POWERS.length + ' команд · /help' });
    rows.push({ name: 'Память', ok: true, info: `фактов: ${store.get().facts.length} · история: ${store.get().history.length}` });
    rows.push({ name: 'Движок', ok: true, info: `${APP.name} v${APP.version} · пинг LLM: ${lastLatency()} мс` });
    return rows;
  });
}

/* ================= chips ================= */
function defaultChipDefs() {
  return [
    { label: '◈ Брифинг', run: () => routeCommand('/brief') },
    { label: '🌤 Погода', run: () => send('погода') },
    { label: '💱 Курсы', run: () => send('курс доллара') },
    { label: '📰 Новости', run: () => routeCommand('/news') },
    { label: '🎨 Нарисуй…', run: () => openCreatorSheet() },
    { label: '🧠 Совет троих', run: () => { $('#input').value = '/council '; $('#input').focus(); } },
  ];
}
function defaultChips() { chips(defaultChipDefs()); }

/* ================= widgets / tasks ================= */
async function refreshWidgets() {
  const w = $('#wWeather'), r = $('#wRates');
  if (w) w.textContent = '…';
  if (r) r.textContent = '…';
  try { const t = await toolWeather(); if (w) w.textContent = '🌤 ' + t.split('. ')[0]; }
  catch (e) { if (w) w.textContent = '🌤 недоступно'; }
  try { const t = await toolRates(); if (r) r.textContent = '💱 ' + t.split('. ')[0]; }
  catch (e) { if (r) r.textContent = '💱 недоступно'; }
}
function refreshTasks() {
  renderTodos(store.get().todos, i => { store.toggleTodo(i); refreshTasks(); }, () => { store.clearTodos(true); refreshTasks(); });
  renderReminders(store.get().reminders, id => { store.dropReminder(id); refreshTasks(); });
}
function refreshGallery() {
  renderGalleryStrip(store.get().gallery, (u, p) => openViewer(u, p));
}

/* ================= reminders scheduler ================= */
setInterval(() => {
  const due = store.dueReminders();
  due.forEach(r => {
    store.fireReminder(r.id);
    Sfx.alarm();
    toast('⏰ ' + r.text, 'warn', 8000);
    addSys(`⏰ **Напоминание:** ${r.text}`);
    say('Напоминаю: ' + r.text);
    try { if ('Notification' in window && Notification.permission === 'granted') new Notification('MARK II', { body: r.text }); } catch (e) {}
  });
  if (due.length) refreshTasks();
}, 10000);
onReminderScheduled(() => refreshTasks());

/* ================= creator ================= */
function openCreatorSheet() {
  unlockAudio();
  openCreator({ gallery: () => store.get().gallery,
    onGenerate: ({ prompt, style, size, story, status, refresh }) => {
      S.style = style;
      status.textContent = story ? '🎬 Сценарий + 3 кадра… следи за чатом.' : '🎨 Рисую… следи за чатом.';
      (story ? storyFlow(prompt) : imageFlow(prompt, style, size)).finally(() => { status.textContent = ''; refresh(); });
    } });
}

/* ================= camera ================= */
function wireCamera() {
  const panel = $('#camPanel'), video = $('#camVideo');
  S.vision = new Vision(video);
  S.vision.onStatus = (msg, kind) => {
    $('#camState').textContent = msg;
    $('#visionState').textContent = msg;
    $('#visionState').className = 'val ' + (kind === 'ok' ? 'ok' : kind === 'err' ? 'err' : '');
    if (kind === 'err') toast(msg, 'err'); else if (kind === 'warn') toast(msg, 'warn');
  };
  S.vision.onGesture = (name, info) => {
    S.reactor.boom();
    if (name === 'palm') { S.voice.stopAll(); if (S.abort) S.abort.abort(); Sfx.close(); toast('✋ Тихо. Всё остановил.', 'info'); }
    else if (name === 'fist') { toggleMic(); toast('✊ Микрофон: ' + (S.voice.listening ? 'ВКЛ' : 'ВЫКЛ'), 'info'); }
    else if (name === 'victory') { toast('✌️ Фото!', 'info'); send('/photo'); }
    else if (name === 'point') { toast('☝️ Смотрю…', 'info'); send('что ты видишь'); }
    else if (name === 'thumb' || name === 'nod') { Sfx.confirm(); addSys(name === 'nod' ? '👍 Кивок: принято!' : '👍 Принято, босс!'); }
    else if (name === 'shake') { S.voice.stopAll(); toast('🚫 Понял: нет. Остановил.', 'warn'); }
    else if (name === 'pinch' || name === 'ok') {
      const hist = store.get().history.filter(h => h.role === 'assistant').pop();
      if (hist) navigator.clipboard.writeText(hist.content).then(() => toast('🤏 Последний ответ скопирован!', 'ok')).catch(() => toast('Не скопировалось', 'warn'));
      else toast('🤏 Пока нечего копировать', 'warn');
    }
  };
  S.vision.onFace = () => {
    toast('👋 Вижу тебя, босс', 'ok');
    addSys('👋 Камера: вижу лицо. Рад тебя видеть.');
    say('Рад тебя видеть, босс.');
  };
  S.vision.onMood = mood => {
    if (mood === 'smile') toast('😊 Отличная улыбка!', 'ok');
    else if (mood === 'wow') { S.voice.stopAll(); toast('😮 Ого! Остановил речь.', 'info'); }
    else if (mood === 'wink') { Sfx.confirm(); toast('😉 Подмигивание засчитано!', 'ok'); }
    else if (mood === 'angry') toast('😠 Не хмурься, босс. Всё под контролем.', 'warn');
  };
  $('#btnCam').onclick = async () => {
    unlockAudio(); Sfx.click();
    if (S.vision.live) { S.vision.stop(); panel.hidden = true; $('#btnCam').classList.remove('on'); return; }
    panel.hidden = false;
    const ok = await S.vision.start();
    $('#btnCam').classList.toggle('on', ok);
    if (!ok) panel.hidden = true;
    if (ok && $('#camAI').checked) S.vision.enableAI(true);
  };
  $('#camClose').onclick = () => { S.vision.stop(); panel.hidden = true; $('#btnCam').classList.remove('on'); };
  $('#camFlip').onclick = async () => {
    const f = await S.vision.flip();
    video.classList.toggle('mirror', f === 'user');
    Sfx.click();
  };
  $('#camAI').onchange = e => S.vision.enableAI(e.target.checked);
  video.classList.add('mirror');
}

/* ================= voice wiring ================= */
function toggleMic() {
  unlockAudio();
  if (!S.voice.sttOK) { toast('Браузер не умеет распознавать речь. Попробуй Chrome.', 'err'); return S.voice.listening; }
  const on = S.voice.toggleListen();
  if (on) { S.voice.openDialog(30); toast('🎙 Слушаю… говори. «Джарвис» — позвать.', 'ok'); }
  Sfx.click();
  return on;
}
function wireVoice() {
  S.voice = new Voice();
  S.voice.onInterim = t => { const i = $('#input'); if (document.activeElement !== i) i.value = t; $('#interim').textContent = '… ' + t; };
  S.voice.onFinal = t => {
    $('#interim').textContent = '🎙 «' + t.slice(0, 80) + '»';
    setTimeout(() => { const el = $('#interim'); if (el && el.textContent.charCodeAt(0) === 0xD83C) el.textContent = ''; }, 4000);
    if (S.voice.speaking) { toast('🎙 Услышал, но я говорю — жми ⏹ чтобы прервать', 'warn'); return; }
    send(t);
  };
  S.voice.onWake = kind => {
    Sfx.wake(); S.reactor.boom();
    if (kind === 'name') { toast('Слушаю, босс — говори!', 'ok'); say('Слушаю, босс.'); }
    else toast('Слушаю, босс', 'info');
  };
  S.voice.onState = st => {
    $('#btnMic').classList.toggle('on', st.listening);
    $('#btnMic').classList.toggle('rec', st.listening);
    $('#micState').textContent = !st.stt ? 'STT н/д' : st.listening ? (st.dialog ? '◉ диалог' : '◉ слушаю') : '○ выкл';
    $('#vuFill').style.width = Math.round((st.speaking ? st.level : st.listening ? 0.12 : 0) * 100) + '%';
    if (S.reactor) S.reactor.setLevel(st.speaking ? st.level : st.listening ? 0.15 : 0.06);
    if (st.lastErr && st.lastErr !== S._micErrShown) {
      S._micErrShown = st.lastErr;
      if (/not-allowed/.test(st.lastErr)) toast('🎙 Нет доступа к микрофону — разреши в браузере', 'err', 6000);
      else if (st.lastErr === 'audio-capture') toast('🎙 Микрофон занят другим приложением', 'warn');
    }
    if (!st.listening && !st.lastErr) S._micErrShown = '';
  };
  $('#btnMic').onclick = toggleMic;
  $('#btnStop').onclick = () => {
    S.voice.stopAll();
    if (S.abort) S.abort.abort();
    Sfx.close(); toast('⏹ Остановлено', 'info');
  };
}

/* ================= composer ================= */
function autoresize() {
  const i = $('#input');
  i.style.height = 'auto';
  i.style.height = Math.min(120, Math.max(44, i.scrollHeight)) + 'px';
}
function wireComposer() {
  const form = $('#composer'), input = $('#input');
  input.addEventListener('input', autoresize);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input.value); }
  });
  form.addEventListener('submit', e => { e.preventDefault(); send(input.value); });
  $('#btnSend').onclick = () => send(input.value);
  $('#btnArt').onclick = () => openCreatorSheet();
}

/* ================= header / panels ================= */
function wireChrome() {
  // persona pills
  const box = $('#personaPills');
  PERSONA_IDS.forEach(id => {
    const b = document.createElement('button');
    b.dataset.p = id; b.textContent = PERSONAS[id].name;
    b.style.setProperty('--pc', PERSONAS[id].color);
    b.onclick = () => applyPersona(id);
    box.appendChild(b);
  });
  $('#btnPalette').onclick = () => { Sfx.click(); openPalette(); };
  $('#btnDiag').onclick = () => { Sfx.click(); cmdDiag(); };
  $('#btnHelp').onclick = () => { Sfx.click(); openHelp(); };
  $('#btnSettings').onclick = () => {
    Sfx.click(); unlockAudio();
    openSettings({ key: store.getKey(), settings: store.get().settings, voices: S.voice.listVoices(),
      onSaveKey: k => { store.setKey(k); updateNet(); toast(k ? '🔑 Ключ сохранён' : '🔑 Ключ удалён', k ? 'ok' : 'warn'); },
      onSave: patch => { Object.assign(store.get().settings, patch); store.save(); },
      onExport: () => download('mark2-memory.json', store.exportJSON(), 'application/json'),
      onForget: () => { store.forgetFacts(); toast('Факты забыты', 'ok'); },
      onWipe: () => { store.wipeAll(); location.reload(); } });
  };
  $('#btnFull').onclick = () => {
    Sfx.click();
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else document.documentElement.requestFullscreen().catch(() => toast('Fullscreen недоступен', 'warn'));
  };
  // toggles
  const tW = $('#tglWake'), tV = $('#tglVoice'), tS = $('#tglSfx');
  const paint = () => {
    const s = store.get().settings;
    tW.classList.toggle('on', s.wake); tV.classList.toggle('on', s.autoSpeak); tS.classList.toggle('on', s.sfx);
  };
  tW.onclick = () => { const s = store.get().settings; s.wake = !s.wake; store.save(); paint(); Sfx.click(); };
  tV.onclick = () => { const s = store.get().settings; s.autoSpeak = !s.autoSpeak; store.save(); paint(); Sfx.click(); if (!s.autoSpeak) S.voice.stopAll(); };
  tS.onclick = () => { const s = store.get().settings; s.sfx = !s.sfx; store.save(); paint(); Sfx.click(); };
  paint();
  // palette
  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openPalette(); }
    if (e.key === 'Escape') closePalette();
  });
  $('#palette').addEventListener('mousedown', e => { if (e.target.id === 'palette') closePalette(); });
  regCommands([
    { icon: '◈', title: 'Утренний брифинг', hint: '/brief', run: () => routeCommand('/brief') },
    { icon: '📰', title: 'Новости', hint: '/news', run: () => routeCommand('/news') },
    { icon: '🎨', title: 'Творец — нарисовать', run: () => openCreatorSheet() },
    { icon: '🎬', title: 'Раскадровка', hint: '/story', run: () => { $('#input').value = '/story '; $('#input').focus(); } },
    { icon: '🧠', title: 'Совет троих', hint: '/council', run: () => { $('#input').value = '/council '; $('#input').focus(); } },
    { icon: '🌐', title: 'Перевод', hint: '/tr', run: () => { $('#input').value = '/tr '; $('#input').focus(); } },
    { icon: '⏰', title: 'Напомнить', hint: '/remind', run: () => { $('#input').value = '/remind 10 '; $('#input').focus(); } },
    { icon: '📷', title: 'Камера вкл/выкл', run: () => $('#btnCam').click() },
    { icon: '🎙', title: 'Микрофон вкл/выкл', run: () => toggleMic() },
    ...PERSONA_IDS.map(id => ({ icon: '◈', title: 'Персона: ' + PERSONAS[id].name, run: () => applyPersona(id) })),
    { icon: '⚙', title: 'Настройки', run: () => $('#btnSettings').click() },
    { icon: '🔍', title: 'Диагностика', run: () => cmdDiag() },
    { icon: '?', title: 'Помощь', run: () => cmdHelp('') },
    { icon: '🧹', title: 'Очистить чат', run: () => routeCommand('/clear') },
  ]);
  POWERS.filter(p => p.id !== 'help').forEach(p => regCommands([{ icon: p.icon,
    title: (p.cmds[0] || p.title) + ' — ' + p.title, hint: p.cat, run: () => send(p.sample) }]));
  // net status
  window.addEventListener('online', updateNet);
  window.addEventListener('offline', updateNet);
}
function updateNet() {
  const on = navigator.onLine, key = store.hasKey();
  setNet(on && key, !on ? 'OFFLINE' : key ? 'ONLINE · KEY ✓' : 'ONLINE · НЕТ КЛЮЧА');
}
function download(name, text, mime) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: mime }));
  a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

/* ================= clock ================= */
setInterval(() => { const c = $('#clock'); if (c) c.textContent = dushanbeClock(); }, 1000);
setInterval(refreshWidgets, 10 * 60 * 1000);

/* ================= boot ================= */
function restoreHistory() {
  const hist = store.get().history.slice(-8);
  hist.forEach(m => {
    if (m.role === 'user') addUser(m.content);
    else { const h = addAI(S.persona); h.set(m.content); h.done(aiActions(h)); }
  });
  if (hist.length) scrollChat(true);
}

async function init() {
  document.documentElement.dataset.persona = S.persona;
  window.__mark2boot = Date.now();
  new BgFX($('#bg')).start();
  S.reactor = new Reactor($('#reactor'));
  S.reactor.setColor(persona().color);
  S.reactor.setLevel(0.06);

  wireChrome(); wireComposer(); wireVoice(); wireCamera();
  setVisionCtx({ shot: () => S.vision.snapshot(), live: () => S.vision.live });
  const paintPills = () => $$('#personaPills button').forEach(b => b.classList.toggle('sel', b.dataset.p === S.persona));
  paintPills();
  $('#reactorName').textContent = persona().name;
  $('#reactorTitle').textContent = persona().title;
  $('#clock').textContent = dushanbeClock();
  updateNet();
  refreshTasks(); refreshGallery(); refreshWidgets();
  restoreHistory();
  defaultChips();

  window.addEventListener('pointerdown', () => { S.interacted = true; unlockAudio(); }, { once: true, passive: true });
  window.addEventListener('keydown', () => { S.interacted = true; unlockAudio(); }, { once: true });

  // boot overlay (skippable)
  const bootP = runBoot(['Ядро MARK II … OK', 'Нейролинк Agnes … ' + (store.hasKey() ? 'KEY ✓' : 'NO KEY'),
    'Голосовой модуль … ' + (S.voice.sttOK ? 'OK' : 'НЕ ПОДДЕРЖИВАЕТСЯ'),
    'Зрение … READY', 'Память … ' + store.get().facts.length + ' фактов', 'Интерфейс AURORA … OK', 'Силы … ' + POWERS.length + ' шт']);
  $('#boot').addEventListener('click', () => { const b = $('#boot'); if (b) { b.classList.add('done'); setTimeout(() => b.remove(), 650); } });
  Sfx.boot();
  await bootP;

  if (!store.get().history.length) {
    const h = addAI(S.persona);
    const hr = parseInt(new Intl.DateTimeFormat('ru-RU', { timeZone: 'Asia/Dushanbe', hour: 'numeric' }).format(new Date()), 10);
    const daypart = hr >= 5 && hr < 12 ? 'Доброе утро' : hr >= 12 && hr < 18 ? 'Добрый день' : hr >= 18 && hr < 23 ? 'Добрый вечер' : 'Доброй ночи';
    const greet = `${daypart}! ${persona().hello}\n\nВо мне **${POWERS.length}+ сил**: рисую 🎨, брифинги ◈, викторины 🧠, крипта ₿, МКС 🛰, мемы 🤣, жесты 🤟 и мимика 🙂. Напиши /help или нажми Ctrl+K.${store.hasKey() ? '' : '\n\n⚠ Вставь API-ключ в ⚙️ — без него часть сил спит.'}`;
    h.set(greet); h.done(aiActions(h));
    store.pushHistory('assistant', greet);
  }
  toast(`${APP.name} v${APP.version} — все системы в норме`, 'ok');
}

/* test hooks */
window.__mark2 = { send, routeCommand, store, get persona() { return S.persona; },
  get voice() { return S.voice; }, get vision() { return S.vision; }, version: APP.version,
  powers: () => POWERS.map(p => ({ id: p.id, sample: p.sample, expect: p.expect || '', skip: !!p.skipSweep })),
  testAuto: false, trapActive: () => trapActive() };

init().catch(e => {
  console.error(e);
  document.body.insertAdjacentHTML('beforeend', `<div class="fatal">Ошибка запуска: ${esc(e.message)}</div>`);
});
