/* MARK II — brain: personas, tool-calling executors, fast-path, briefing, council. */
import { chatComplete, quickChat } from './api.js';
import { GEO, WMO, PERSONAS } from './config.js';
import { get, addFact, addTodo, addReminder } from './store.js';

chatComplete.runTool = runTool;
let reminderHook = null;
export function onReminderScheduled(fn) { reminderHook = fn; }

/* ---------- system prompts ---------- */
function baseRules(p) {
  const now = dushanbeNow();
  const facts = get().facts.slice(-12).map(f => '• ' + f.text).join('\n');
  return `Ты — ${p.name}, ${p.title}. AI дворецкий в стиле Тони Старка. Отвечай на русском, коротко и по делу (1-4 предложения, если не просят подробно). Характер: ${personaTrait(p.id)}.
Сейчас: ${now} (Душанбе, UTC+5).
${facts ? 'Ты помнишь о пользователе:\n' + facts + '\n' : ''}Если вопрос просится в инструмент (время, счёт, погода, курсы, факты из вики, новости, заметки, напоминания) — ВЫЗОВИ инструмент, не выдумывай данные. Никогда не показывай chain-of-thought. Форматируй легко: короткие абзацы, \`код\` в бэктиках.`;
}
function personaTrait(id) {
  return { jarvis: 'безупречный британский дворецкий, «сэр», спокойная уверенность',
    friday: 'энергичная, остроумная, по-свойски «босс»',
    ultron: 'саркастичный, грандиозный, снисходительный, но помогает',
    vision: 'философски спокойный, точный, добрый' }[id] || 'умный помощник';
}

/* ---------- time ---------- */
export function dushanbeNow() {
  try {
    return new Intl.DateTimeFormat('ru-RU', { timeZone: GEO.tz, weekday: 'long', day: 'numeric',
      month: 'long', hour: '2-digit', minute: '2-digit' }).format(new Date());
  } catch (e) { return new Date().toLocaleString('ru-RU'); }
}
export function dushanbeClock() {
  try {
    return new Intl.DateTimeFormat('ru-RU', { timeZone: GEO.tz, hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date());
  } catch (e) { return new Date().toLocaleTimeString('ru-RU'); }
}

/* ---------- tools ---------- */
export const TOOLS = [
  { type: 'function', function: { name: 'get_time', description: 'Текущие дата и время в Душанбе', parameters: { type: 'object', properties: {} } } },
  { type: 'function', function: { name: 'calc', description: 'Вычислить арифметическое выражение', parameters: { type: 'object', properties: { expr: { type: 'string', description: 'напр. (12+7)*3, 15% от 200' } }, required: ['expr'] } } },
  { type: 'function', function: { name: 'weather', description: 'Погода в Душанбе сейчас и на сегодня', parameters: { type: 'object', properties: {} } } },
  { type: 'function', function: { name: 'rates', description: 'Курсы валют: USD к TJS, RUB, EUR', parameters: { type: 'object', properties: {} } } },
  { type: 'function', function: { name: 'wiki', description: 'Краткая справка из Википедии', parameters: { type: 'object', properties: { q: { type: 'string' } }, required: ['q'] } } },
  { type: 'function', function: { name: 'tech_news', description: 'Свежие мировые tech-новости (заголовки)', parameters: { type: 'object', properties: {} } } },
  { type: 'function', function: { name: 'remember_fact', description: 'Запомнить факт о пользователе', parameters: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] } } },
  { type: 'function', function: { name: 'add_todo', description: 'Добавить задачу в список', parameters: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] } } },
  { type: 'function', function: { name: 'set_reminder', description: 'Напомнить через N минут', parameters: { type: 'object', properties: { text: { type: 'string' }, minutes: { type: 'number' } }, required: ['text', 'minutes'] } } },
];

export async function runTool(name, args = {}) {
  switch (name) {
    case 'get_time': return dushanbeNow();
    case 'calc': return calcExpr(args.expr || '');
    case 'weather': return toolWeather();
    case 'rates': return toolRates();
    case 'wiki': return toolWiki(args.q || '');
    case 'tech_news': return toolNews();
    case 'remember_fact': return addFact(args.text) ? 'Запомнил: ' + args.text : 'Уже знаю это.';
    case 'add_todo': { const t = addTodo(args.text); return t ? 'Добавил задачу: ' + t.text : 'Пустая задача.'; }
    case 'set_reminder': {
      const mins = Math.max(0.05, Math.min(10080, +args.minutes || 5));
      const r = addReminder(args.text || 'Напоминание', Date.now() + mins * 60000);
      if (reminderHook) reminderHook(r);
      return `Напомню через ${mins} мин: ${r.text}`;
    }
    default: return 'Неизвестный инструмент: ' + name;
  }
}

/* ---------- executors ---------- */
export function calcExpr(raw) {
  let s = String(raw || '').replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-')
    .replace(/,/g, '.').replace(/\^/g, '**').replace(/(\d+(?:\.\d+)?)\s*%\s*от\s*(\d+(?:\.\d+)?)/gi, '($1/100*$2)')
    .replace(/(\d+(?:\.\d+)?)\s*%/g, '($1/100)');
  const m = s.match(/[-+*/().\d\s*%!]+/);
  if (!m) return 'Не понял выражение.';
  s = m[0];
  if (!/^[-+*/().\d\s*]+$/.test(s) || s.length > 80) return 'Не понял выражение.';
  try {
    // eslint-disable-next-line no-new-func
    const v = Function('"use strict";return(' + s + ')')();
    if (typeof v !== 'number' || !isFinite(v)) return 'Не считается.';
    return '= ' + (+v.toFixed(6)).toLocaleString('ru-RU');
  } catch (e) { return 'Не считается.'; }
}

export async function toolWeather() {
  const u = `https://api.open-meteo.com/v1/forecast?latitude=${GEO.lat}&longitude=${GEO.lon}` +
    `&current=temperature_2m,weather_code,wind_speed_10m,relative_humidity_2m&daily=temperature_2m_max,temperature_2m_min` +
    `&timezone=${encodeURIComponent(GEO.tz)}`;
  const r = await fetch(u);
  if (!r.ok) throw new Error('метеосервис недоступен');
  const j = await r.json();
  const c = j.current, d = j.daily;
  const desc = WMO[c.weather_code] || '—';
  return `Душанбе: ${Math.round(c.temperature_2m)}°C, ${desc}, ветер ${Math.round(c.wind_speed_10m)} км/ч, влажность ${c.relative_humidity_2m}%. Сегодня: ${Math.round(d.temperature_2m_min[0])}…${Math.round(d.temperature_2m_max[0])}°C.`;
}

export async function toolRates() {
  const r = await fetch('https://open.er-api.com/v6/latest/USD');
  if (!r.ok) throw new Error('курсы недоступны');
  const j = await r.json();
  const t = j.rates.TJS, b = j.rates.RUB, e = j.rates.EUR;
  return `1 USD = ${t.toFixed(2)} TJS = ${b.toFixed(2)} RUB = ${e.toFixed(2)} EUR. 1000 RUB ≈ ${(1000 / b * t).toFixed(0)} TJS.`;
}

export async function toolWiki(q) {
  q = String(q || '').trim().slice(0, 120);
  if (!q) return 'Пустой запрос.';
  const s = await fetch(`https://ru.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(q)}&srlimit=1&format=json&origin=*`).then(r => r.json());
  const hit = s.query && s.query.search[0];
  if (!hit) return 'В Википедии не нашёл.';
  const p = await fetch(`https://ru.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(hit.title)}`).then(r => r.json());
  return (p.extract || 'Нет описания.').split('. ').slice(0, 3).join('. ') + '.';
}

export async function toolNews() {
  const j = await fetch('https://hn.algolia.com/api/v1/search?tags=front_page').then(r => r.json());
  return (j.hits || []).slice(0, 8).map((h, i) => `${i + 1}. ${h.title}`).join('\n') || 'Новостей нет.';
}

/* ---------- fast path (no LLM needed) ---------- */
export function fastPath(text) {
  const t = text.toLowerCase().trim();
  if (/(который час|сколько времени|^время$|текущее время)/.test(t)) return dushanbeNow();
  if (/(какое (сегодня )?число|какая сегодня дата|какой сегодня день)/.test(t)) return dushanbeNow();
  if (/(посчитай|вычисли|сколько будет|реши пример)/.test(t) || /^[\d\s+\-*/().×÷%^,]+$/.test(t)) {
    const expr = t.replace(/(посчитай|вычисли|сколько будет|реши пример|равно|\?)/g, ' ').trim();
    if (expr) return calcExpr(expr);
  }
  return null;
}

/* ---------- main answer ---------- */
export async function answer(userText, { key, personaId, history, onToken, onTool, signal }) {
  const p = PERSONAS[personaId] || PERSONAS.jarvis;
  const ctx = history.slice(-10).map(h => ({ role: h.role === 'user' ? 'user' : 'assistant', content: h.content }));
  const messages = [{ role: 'system', content: baseRules(p) }, ...ctx, { role: 'user', content: userText }];
  const r = await chatComplete({ key, messages, tools: TOOLS, stream: true, onToken, onTool, signal });
  return (r.text || '').trim();
}

/* ---------- briefing ---------- */
export async function briefing({ key, personaId }) {
  const [w, r, n, todos] = await Promise.allSettled([toolWeather(), toolRates(), toolNews(), Promise.resolve(get().todos.filter(t => !t.done).slice(0, 5))]);
  const W = w.status === 'fulfilled' ? w.value : 'погода недоступна';
  const R = r.status === 'fulfilled' ? r.value : 'курсы недоступны';
  const N = n.status === 'fulfilled' ? n.value : '';
  const T = todos.value.length ? todos.value.map(t => '• ' + t.text).join('\n') : 'Задач нет — день свободен.';
  const p = PERSONAS[personaId] || PERSONAS.jarvis;
  const head = `◈ УТРЕННИЙ БРИФИНГ — ${dushanbeNow()}\n\n▸ Погода: ${W}\n▸ Курсы: ${R}\n▸ Задачи:\n${T}`;
  if (!key) return head + '\n\n▸ Совет дня: вставь API-ключ в ⚙️ — и я добавлю живой разбор новостей.';
  try {
    const ai = await quickChat({ key, maxTokens: 400, messages: [
      { role: 'system', content: `Ты ${p.name}. Дай короткий (до 6 строк) разбор дня: 2-3 главные tech-новости из списка + 1 дельный совет. Русский, живой стиль.` },
      { role: 'user', content: 'Новости:\n' + N + '\n\nПогода: ' + W } ] });
    return head + '\n\n▸ Разбор FRIDAY:\n' + ai.trim();
  } catch (e) { return head + '\n\n▸ Разбор: ИИ недоступен.'; }
}

/* ---------- council of three ---------- */
export async function council(question, { key }) {
  if (!key) throw new Error('NO_KEY');
  const roles = [
    ['jarvis', 'Ты JARVIS: холодный расчёт, инженерная точность. Ответ в 2-3 предложения.'],
    ['friday', 'Ты FRIDAY: дерзкая, практичная, по делу. Ответ в 2-3 предложения.'],
    ['ultron', 'Ты ULTRON: мрачный стратег, видишь риски. Ответ в 2-3 предложения.'],
  ];
  const outs = await Promise.all(roles.map(([id, sys]) =>
    quickChat({ key, maxTokens: 350, messages: [{ role: 'system', content: sys }, { role: 'user', content: question }] })
      .then(t => [id, t.trim()]).catch(() => [id, '— нет связи —'])));
  let final = '';
  try {
    final = await quickChat({ key, maxTokens: 250, messages: [
      { role: 'system', content: 'Ты VISION. Синтезируй три мнения в один взвешенный вердикт: 3-4 предложения, русский.' },
      { role: 'user', content: outs.map(([id, t]) => id.toUpperCase() + ': ' + t).join('\n\n') } ] });
  } catch (e) { final = 'Вердикт: смотри на три мнения выше и решай сам, босс.'; }
  return { opinions: outs, final: final.trim() };
}

/* ---------- translate ---------- */
export async function translateFlow(text, { key }) {
  const ru = /[а-яё]/i.test(text);
  if (!key) {
    // offline micro-dictionary for common phrases
    const dict = { 'привет': 'hello', 'спасибо': 'thank you', 'пока': 'goodbye', 'да': 'yes', 'нет': 'no',
      'hello': 'привет', 'thank you': 'спасибо', 'thanks': 'спасибо', 'goodbye': 'пока', 'yes': 'да', 'no': 'нет' };
    const low = text.toLowerCase().trim();
    return dict[low] ? `${text} → ${dict[low]} (офлайн-мини-словарь)` : 'Без ключа доступен только мини-словарь. Добавь ключ в ⚙️.';
  }
  return quickChat({ key, maxTokens: 300, messages: [
    { role: 'system', content: ru ? 'Переведи на английский. Только перевод, без пояснений.' : 'Переведи на русский. Только перевод, без пояснений.' },
    { role: 'user', content: text } ] }).then(t => t.trim());
}
