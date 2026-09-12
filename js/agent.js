/* V18 — proactive FRIDAY agent: budgeted background loop + WATCH video analysis.
   RPM discipline: bg calls <= 1 per 4 min, watch <= 1 per 90s, user always first. */
import { quickChat, visionChat } from './api.js';
import { get } from './store.js';
import { addEpisode, extractLLM, digest } from './memory.js';

const BG_GAP = 4 * 60 * 1000, WATCH_GAP = 90 * 1000;
let lastBg = 0, lastWatch = 0, lastInteract = Date.now();
let watchOn = false, watchTimer = null, motionCb = null;
let hooks = {};

['pointerdown', 'keydown'].forEach(ev =>
  window.addEventListener(ev, () => { lastInteract = Date.now(); }, { passive: true }));

export function initAgent(h) {
  hooks = h; // {key, personaId, notify, speak, shot, camLive, mood, historyLen, markExtracted, extractedAt}
  setInterval(tick, 30000);
  setTimeout(tick, 20000);
}
function canSpend() {
  return hooks.key && hooks.key() && (Date.now() - lastBg > BG_GAP) && !document.hidden;
}
async function tick() {
  if (window.__mark2 && window.__mark2.testAuto) return; // deterministic sweeps
  try {
    // 1) memory extraction when conversation grew
    const hl = hooks.historyLen ? hooks.historyLen() : 0;
    if (canSpend() && hl >= 6 && hl - (hooks.extractedAt ? hooks.extractedAt() : 0) >= 6) {
      lastBg = Date.now();
      const ok = await extractLLM(hooks.key(), hooks.convo ? hooks.convo() : '').catch(() => false);
      if (ok && hooks.markExtracted) hooks.markExtracted(hl);
      return;
    }
    // 2) proactive moments
    if (!canSpend() || !hooks.notify) return;
    const idleMin = (Date.now() - lastInteract) / 60000;
    const hr = parseInt(new Intl.DateTimeFormat('ru-RU', { timeZone: 'Asia/Dushanbe', hour: 'numeric' }).format(new Date()), 10);
    let moment = '';
    const dayKey = 'mark2_greet_' + new Date().toDateString();
    if (!localStorage.getItem(dayKey) && hr >= 6 && idleMin > 2) {
      try { localStorage.setItem(dayKey, '1'); } catch (e) {}
      moment = 'first_of_day';
    } else if (idleMin > 25) {
      moment = 'idle_long';
      lastInteract = Date.now(); // remind once per idle stretch
    } else if (hooks.mood && hooks.mood() === 'angry' && idleMin > 3) {
      moment = 'mood_angry';
    }
    if (!moment) return;
    lastBg = Date.now();
    const sys = { first_of_day: 'Коротко (2 предл.) поприветствуй босса по-русски + один дельный вопрос/предложение на сегодня. Учитывай память.',
      idle_long: 'Пользователь давно молчит. Одно короткое живое сообщение по-русски: напомни что ты на связи + предложи что-то полезное. Без занудства.',
      mood_angry: 'Камера видит что босс хмурится. Одно тёплое короткое сообщение поддержки + предложи помощь. По-русски.' }[moment];
    const mem = digest();
    const t = await quickChat({ key: hooks.key(), maxTokens: 160, messages: [
      { role: 'system', content: sys + (mem ? '\nПамять:\n' + mem : '') },
      { role: 'user', content: 'Время: ' + new Date().toLocaleTimeString('ru-RU') } ] }).catch(() => '');
    if (t && t.trim()) {
      hooks.notify(t.trim());
      addEpisode('Проактив (' + moment + '): ' + t.trim().slice(0, 200));
    }
  } catch (e) { /* silent */ }
}

/* ---------- WATCH: motion-triggered camera analysis ---------- */
export function watchActive() { return watchOn; }
export function startWatch({ video, shot, onMotion }) {
  if (watchOn || !video) return false;
  watchOn = true; motionCb = onMotion || null;
  const c = document.createElement('canvas');
  const x = c.getContext('2d', { willReadFrequently: true });
  let prev = null, still = 0;
  watchTimer = setInterval(() => {
    try {
      if (!video.videoWidth || document.hidden) return;
      c.width = 96; c.height = 72;
      x.drawImage(video, 0, 0, 96, 72);
      const d = x.getImageData(0, 0, 96, 72).data;
      let diff = 0;
      if (prev) {
        for (let i = 0; i < d.length; i += 16) diff += Math.abs(d[i] - prev[i]);
        diff /= (d.length / 16);
      }
      prev = d.slice ? Float32Array.from(d) : d;
      if (diff > 14) { still = 0; if (motionCb) motionCb(Math.round(diff)); analyze(shot); }
      else if (++still % 20 === 0) analyze(shot, true);
    } catch (e) {}
  }, 3000);
  return true;
}
export function stopWatch() { watchOn = false; clearInterval(watchTimer); }
async function analyze(shot, quiet) {
  if (!hooks.key || !hooks.key() || Date.now() - lastWatch < WATCH_GAP) return;
  const img = shot ? shot() : null;
  if (!img) return;
  lastWatch = Date.now();
  try {
    const d = await visionChat({ key: hooks.key(), imageDataUrl: img, maxTokens: 220,
      prompt: 'Ты FRIDAY. Коротко по-русски (1-2 предл.): что происходит на кадре с камеры? Люди, действия, изменения. Если ничего нового — ответь одним словом СТАБИЛЬНО.' });
    const t = (d || '').trim();
    if (t && !/^стабильно/i.test(t) && hooks.notify) hooks.notify('👁 WATCH: ' + t);
  } catch (e) {}
}
