/* MARK II — POWERS: ~100 instant skills. Each: match -> run -> text/image. Auto-tested via sweep. */
import { GEO } from './config.js';
import * as store from './store.js';
import { quickChat, genImage, visionChat } from './api.js';
import { toolWeather, toolRates, toolNews, toolWiki, calcExpr, dushanbeNow } from './brain.js';

/* ---------- helpers ---------- */
const rnd = a => a[Math.floor(Math.random() * a.length)];
const pickN = (a, n) => [...a].sort(() => Math.random() - 0.5).slice(0, n);
async function getJSON(url, timeout = 12000) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), timeout);
  try { const r = await fetch(url, { signal: c.signal }); if (!r.ok) throw new Error('HTTP ' + r.status); return await r.json(); }
  finally { clearTimeout(t); }
}
const deEnt = s => { const d = document.createElement('textarea'); d.innerHTML = s; return d.value; };
const escQ = s => encodeURIComponent(s);
function needKey(ctx) { return ctx.key ? null : '🔑 Для этого нужен API-ключ (⚙️ Настройки).'; }
function fmtDate(d) { try { return new Intl.DateTimeFormat('ru-RU', { timeZone: GEO.tz, day: 'numeric', month: 'long', weekday: 'long' }).format(d); } catch (e) { return d.toLocaleDateString('ru-RU'); } }

/* Active input trap (guess game). */
let TRAP = null;
export function trapActive() { return !!TRAP; }

/* ================= POWER LIST ================= */
export const POWERS = [];
const P = o => { POWERS.push(o); return o; };

/* ---------- SEE ---------- */
P({ id: 'see', cat: 'Зрение', icon: '👁', title: 'Что видишь?', hint: '/see — описать кадр с камеры', cmds: ['/see'], re: [/что (ты )?видишь/, /что там на камере/, /опиши кадр/], sample: '/see',
  expect: 'камер|вижу|кадр', run: async (a, ctx) => {
    const nk = needKey(ctx); if (nk) return nk;
    const shot = ctx.shot(); if (!shot) return '📷 Камера выключена. Включи её кнопкой 📷 — и я расскажу, что вижу.';
    const d = await visionChat({ key: ctx.key, imageDataUrl: shot, maxTokens: 400,
      prompt: 'Опиши живо по-русски, что видишь на этом кадре с камеры (3-5 предложений). Если видно лицо — отметь настроение.' });
    return '👁 ' + (d.trim() || 'Кадр пустой.');
  } });
P({ id: 'read', cat: 'Зрение', icon: '🔎', title: 'Прочитать текст', hint: '/read — распознать текст с камеры', cmds: ['/read'], re: [/прочитай/, /распознай текст/], sample: '/read',
  expect: 'камер|текст|букв', run: async (a, ctx) => {
    const nk = needKey(ctx); if (nk) return nk;
    const shot = ctx.shot(); if (!shot) return '📷 Включи камеру и наведи на текст — прочитаю.';
    const d = await visionChat({ key: ctx.key, imageDataUrl: shot, maxTokens: 400, prompt: 'Прочитай весь текст на этом изображении и выведи его как есть. Если текста нет — так и скажи.' });
    return '🔎 ' + (d.trim() || 'Текста не вижу.');
  } });
P({ id: 'photo', cat: 'Зрение', icon: '📸', title: 'Сделать фото', hint: '/photo — снимок в галерею', cmds: ['/photo'], re: [/сделай фото/, /сфотографируй/, /сфоткай/], sample: '/photo',
  expect: 'фото|камер|галере', run: async (a, ctx) => {
    const shot = ctx.shot(); if (!shot) return '📷 Камера выключена — нечего снимать.';
    store.addImage(shot, 'Фото с камеры'); ctx.refreshGal();
    return { text: '📸 Готово! Снимок в галерее.', image: shot };
  } });
P({ id: 'scan', cat: 'Зрение', icon: '🛡', title: 'Сканирование', hint: '/scan — тактическое сканирование помещения', cmds: ['/scan'], re: [/сканируй/, /сканирование/], sample: '/scan',
  expect: 'скан|камер|угроз', run: async (a, ctx) => {
    ctx.fx.sfx('scan');
    const shot = ctx.shot();
    if (!shot || !ctx.key) return '🛡 СКАНИРОВАНИЕ: камера ' + (shot ? 'активна, но нужен API-ключ.' : 'выключена.') + ' Угроз не обнаружено. Наверное.';
    const d = await visionChat({ key: ctx.key, imageDataUrl: shot, maxTokens: 350,
      prompt: 'Ты JARVIS. Проведи шуточное тактическое сканирование помещения на кадре по-русски: объекты, освещение, оценка уюта в процентах, вердикт одной строкой.' });
    ctx.fx.boom(); return '🛡 СКАНИРОВАНИЕ ЗАВЕРШЕНО\n\n' + d.trim();
  } });
P({ id: 'mood', cat: 'Зрение', icon: '🙂', title: 'Настроение по лицу', hint: '/mood — что показывает мимика', cmds: ['/mood'], re: [/моё настроение/, /какое у меня настроение/], sample: '/mood',
  expect: 'настроение|лиц|камер|мимик', run: async (a, ctx) => {
    const m = ctx.lastMood();
    if (!m) return '🙂 Лица пока не видел. Включи камеру с ИИ-зрением — и я начну читать мимику.';
    return `🙂 Последняя мимика: ${m.label} (${m.when}). ` + rnd(['Держишься отлично.', 'Так держать, босс.', 'Старк бы одобрил.', 'Чувствую мощь.']);
  } });
P({ id: 'gestures', cat: 'Зрение', icon: '🤟', title: 'Жесты', hint: '/gestures — список жестов', cmds: ['/gestures'], re: [/какие есть жесты/, /список жестов/], sample: '/gestures',
  expect: 'ладонь|кулак', run: () => '🤟 **Жесты рук** (камера + ИИ-зрение):\n✋ ладонь — тихо/стоп\n✊ кулак — микрофон вкл/выкл\n✌️ победа — фото в галерею\n☝️ указательный — «что видишь?»\n👍 большой палец — принято\n🤏 щипок — скопировать последний ответ\n\n**Голова и лицо:** кивок = да · мотание = нет · улыбка 😊 · подмигни 😉.' });

/* ---------- TIME ---------- */
const CITIES = { 'токио': 'Asia/Tokyo', 'лондон': 'Europe/London', 'москва': 'Europe/Moscow', 'дубай': 'Asia/Dubai', 'нью-йорк': 'America/New_York', 'париж': 'Europe/Paris', 'пекин': 'Asia/Shanghai', 'ташкент': 'Asia/Tashkent', 'алматы': 'Asia/Almaty', 'стамбул': 'Europe/Istanbul', 'берлин': 'Europe/Berlin', 'киев': 'Europe/Kiev', 'лос-анджелес': 'America/Los_Angeles' };
P({ id: 'time', cat: 'Время', icon: '🕐', title: 'Время в городе', hint: '/time [город]', cmds: ['/time'], re: [/который час в (.+)/, /время в (.+)/], sample: '/time токио',
  expect: 'Токио|время|:|UTC', run: (a) => {
    const q = (a || '').toLowerCase().trim();
    const tz = CITIES[q] || (q ? null : GEO.tz);
    if (q && !tz) return `🕐 Не знаю город «${a}». Знаю: ${Object.keys(CITIES).join(', ')}.`;
    try {
      const t = new Intl.DateTimeFormat('ru-RU', { timeZone: tz, hour: '2-digit', minute: '2-digit', weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());
      return `🕐 ${q ? a.trim() : 'Душанбе'}: ${t}`;
    } catch (e) { return '🕐 Часы барахлят.'; }
  } });
P({ id: 'today', cat: 'Время', icon: '📅', title: 'Сегодня', hint: '/today — дата и неделя', cmds: ['/today'], re: [/какое сегодня число/, /что сегодня/], sample: '/today',
  expect: 'сентябр|октябр|неделя|год', run: () => {
    const d = new Date();
    const week = Math.ceil((((d - new Date(d.getFullYear(), 0, 1)) / 864e5) + 1) / 7);
    return `📅 Сегодня: ${fmtDate(d)}. Неделя №${week} года ${d.getFullYear()}. ${dushanbeNow()}`;
  } });
P({ id: 'weekday', cat: 'Время', icon: '🗓', title: 'День недели', hint: '/weekday 01.01.2027', cmds: ['/weekday'], re: [/какой день недели (.+)/], sample: '/weekday 01.01.2027',
  expect: 'пятница|понедельник|вторник|среда|четверг|суббота|воскресенье', run: (a) => {
    const m = (a || '').match(/(\d{1,2})[./-](\d{1,2})[./-](\d{4})/);
    if (!m) return '🗓 Формат: /weekday 01.01.2027';
    const d = new Date(+m[3], +m[2] - 1, +m[1]);
    return `🗓 ${m[0]} — ${new Intl.DateTimeFormat('ru-RU', { weekday: 'long' }).format(d)}.`;
  } });
P({ id: 'countdown', cat: 'Время', icon: '⏳', title: 'Обратный отсчёт', hint: '/countdown 01.01.2027', cmds: ['/countdown'], re: [/сколько дней до (.+)/, /обратный отсчёт/], sample: '/countdown 01.01.2027',
  expect: 'дн|наступил|прош', run: (a) => {
    const m = (a || '').match(/(\d{1,2})[./-](\d{1,2})[./-](\d{4})/);
    const d = m ? new Date(+m[3], +m[2] - 1, +m[1]) : null;
    if (!d || isNaN(d)) return '⏳ Формат: /countdown 01.01.2027';
    const days = Math.ceil((d - new Date()) / 864e5);
    if (days < 0) return `⏳ ${m[0]} уже прошло (${-days} дн. назад).`;
    if (days === 0) return '⏳ Это сегодня! 🎉';
    return `⏳ До ${m[0]} осталось: ${days} дн. Держимся!`;
  } });
P({ id: 'age', cat: 'Время', icon: '🎂', title: 'Возраст', hint: '/age 15.05.1995', cmds: ['/age'], re: [/сколько мне лет/, /мой возраст/], sample: '/age 15.05.1995',
  expect: 'лет|год', run: (a) => {
    const m = (a || '').match(/(\d{1,2})[./-](\d{1,2})[./-](\d{4})/);
    if (!m) return '🎂 Формат: /age 15.05.1995';
    const b = new Date(+m[3], +m[2] - 1, +m[1]), n = new Date();
    let y = n.getFullYear() - b.getFullYear();
    if (n.getMonth() < b.getMonth() || (n.getMonth() === b.getMonth() && n.getDate() < b.getDate())) y--;
    const days = Math.floor((n - b) / 864e5);
    return `🎂 Тебе ${y} ${y % 10 === 1 && y !== 11 ? 'год' : ([2, 3, 4].includes(y % 10) && ![12, 13, 14].includes(y % 100) ? 'года' : 'лет')} (${days.toLocaleString('ru-RU')} дней). В самом соку!`;
  } });
P({ id: 'zodiac', cat: 'Время', icon: '♈', title: 'Знак зодиака', hint: '/zodiac 15.05.1995', cmds: ['/zodiac'], re: [/мой знак зодиака/, /кто я по гороскопу/], sample: '/zodiac 15.05.1995',
  expect: 'Телец|Овен|знак', run: (a) => {
    const m = (a || '').match(/(\d{1,2})[./-](\d{1,2})/);
    if (!m) return '♈ Формат: /zodiac 15.05 (год не важен)';
    const d = +m[1], mo = +m[2];
    const Z = [[20, '♒ Водолей'], [19, '♓ Рыбы'], [21, '♈ Овен'], [20, '♉ Телец'], [21, '♊ Близнецы'], [21, '♋ Рак'], [23, '♌ Лев'], [23, '♍ Дева'], [23, '♎ Весы'], [23, '♏ Скорпион'], [22, '♐ Стрелец'], [22, '♑ Козерог']];
    const s = d < Z[mo - 1][0] ? Z[mo - 1][1] : Z[mo % 12][1];
    return `♈ Твой знак: ${s}. Звёзды на твоей стороне.`;
  } });
P({ id: 'timer', cat: 'Время', icon: '⏱', title: 'Таймер', hint: '/timer 5 [текст]', cmds: ['/timer'], re: [/поставь таймер/, /таймер на (\d+)/], sample: '/timer 1 тестовый таймер',
  expect: 'таймер|мин', run: (a, ctx) => {
    const m = (a || '').match(/(\d+)\s*(сек|с|min|мин|м|час|ч|h)?\s*(.*)/i);
    if (!m) return '⏱ Формат: /timer 5 чай (минуты по умолчанию)';
    const n = +m[1], u = (m[2] || 'мин').toLowerCase(), label = m[3].trim() || 'Таймер';
    const ms = /сек|^с$/.test(u) ? n * 1000 : (/час|ч|h/.test(u) ? n * 36e5 : n * 6e4);
    setTimeout(() => ctx.notify(`⏱ Время вышло: ${label}!`), ms);
    return `⏱ Запустил: «${label}» — сработает через ${n} ${u}.`;
  } });
P({ id: 'alarm', cat: 'Время', icon: '⏰', title: 'Будильник', hint: '/alarm 18:30 [текст]', cmds: ['/alarm'], re: [/разбуди меня/, /будильник на/], sample: '/alarm 23:59 тест',
  expect: 'будильник|разбужу', run: (a, ctx) => {
    const m = (a || '').match(/(\d{1,2}):(\d{2})\s*(.*)/);
    if (!m) return '⏰ Формат: /alarm 07:30 подъём';
    const d = new Date(); d.setHours(+m[1], +m[2], 0, 0);
    if (d <= new Date()) d.setDate(d.getDate() + 1);
    const label = m[3].trim() || 'Будильник';
    setTimeout(() => ctx.notify(`⏰ ${label}! Уже ${m[1]}:${m[2]} — подъём, босс!`), d - new Date());
    return `⏰ Разбужу в ${m[1]}:${m[2]}: «${label}».`;
  } });
P({ id: 'pomodoro', cat: 'Время', icon: '🍅', title: 'Помодоро', hint: '/pomodoro — 25 мин фокуса', cmds: ['/pomodoro'], re: [/помодоро/, /фокус 25/], sample: '/pomodoro',
  expect: 'Помодоро|фокус', run: (a, ctx) => {
    ctx.notify('🍅 Помодоро старт: 25 минут глубокого фокуса. Телефон в сторону, босс!');
    setTimeout(() => ctx.notify('🍅 Помодоро готов! 5 минут перерыва — разомнись.'), 25 * 6e4);
    setTimeout(() => ctx.notify('🍅 Перерыв окончен. Следующий круг? /pomodoro'), 30 * 6e4);
    return '🍅 Помодоро запущен: 25 мин работы + 5 мин отдыха. Напомню сам.';
  } });
let SW = null;
P({ id: 'stopwatch', cat: 'Время', icon: '⌛', title: 'Секундомер', hint: '/stopwatch старт|стоп', cmds: ['/stopwatch'], re: [/секундомер/], sample: '/stopwatch',
  expect: 'секундомер|Стоп|старт', run: (a) => {
    if (!SW) { SW = Date.now(); return '⌛ Секундомер запущен. Напиши /stopwatch ещё раз, чтобы остановить.'; }
    const s = Math.round((Date.now() - SW) / 1000); SW = null;
    return `⌛ Стоп! Прошло: ${Math.floor(s / 60)} мин ${s % 60} сек.`;
  } });

/* ---------- WEATHER / SKY ---------- */
P({ id: 'wcity', cat: 'Погода', icon: '🌍', title: 'Погода в городе', hint: '/wcity Москва', cmds: ['/wcity', '/weather'], re: [/погода в (.+)/], sample: '/wcity Москва',
  expect: '°C|погода|не наш|недоступ', run: async (a) => {
    const q = a.trim(); if (!q) return '🌍 Формат: /wcity Москва';
    try {
      const g = await getJSON(`https://geocoding-api.open-meteo.com/v1/search?name=${escQ(q)}&count=1&language=ru`);
      if (!g.results || !g.results.length) return `🌍 Город «${q}» не найден.`;
      const c = g.results[0];
      const w = await getJSON(`https://api.open-meteo.com/v1/forecast?latitude=${c.latitude}&longitude=${c.longitude}&current=temperature_2m,weather_code&timezone=auto`);
      return `🌍 ${c.name} (${c.country || ''}): ${Math.round(w.current.temperature_2m)}°C, код погоды ${w.current.weather_code}.`;
    } catch (e) { return '🌍 Метеосервис недоступен.'; }
  } });
P({ id: 'aqi', cat: 'Погода', icon: '🌫', title: 'Качество воздуха', hint: '/aqi', cmds: ['/aqi'], re: [/качество воздуха/, /чем дышим/], sample: '/aqi',
  expect: 'AQI|воздух', run: async () => {
    try {
      const j = await getJSON(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${GEO.lat}&longitude=${GEO.lon}&current=us_aqi,pm2_5`);
      const v = j.current.us_aqi;
      const lvl = v <= 50 ? 'отлично 🟢' : v <= 100 ? 'нормально 🟡' : v <= 150 ? 'так себе 🟠' : 'плохо 🔴';
      return `🌫 Воздух в Душанбе: AQI ${v} — ${lvl}. PM2.5: ${j.current.pm2_5} µg/m³.`;
    } catch (e) { return '🌫 Датчики воздуха недоступны.'; }
  } });
P({ id: 'sun', cat: 'Погода', icon: '🌅', title: 'Восход и закат', hint: '/sun', cmds: ['/sun'], re: [/во сколько (закат|восход)/, /когда закат/], sample: '/sun',
  expect: 'Восход|Закат|Солнце', run: async () => {
    try {
      const j = await getJSON(`https://api.open-meteo.com/v1/forecast?latitude=${GEO.lat}&longitude=${GEO.lon}&daily=sunrise,sunset&timezone=${encodeURIComponent(GEO.tz)}`);
      const cut = s => s.split('T')[1];
      return `🌅 Восход: ${cut(j.daily.sunrise[0])} · Закат: ${cut(j.daily.sunset[0])} (Душанбе).`;
    } catch (e) { return '🌅 Солнце временно недоступно.'; }
  } });
P({ id: 'moon', cat: 'Погода', icon: '🌙', title: 'Фаза луны', hint: '/moon', cmds: ['/moon'], re: [/фаза луны/, /какая луна/], sample: '/moon',
  expect: 'Луна|луна', run: () => {
    const syn = 29.53058867;
    const age = ((Date.now() / 864e5 - 0.5) % syn + syn) % syn;
    const idx = Math.floor(age / syn * 8) % 8;
    const F = ['🌑 Новолуние', '🌒 Растущий серп', '🌓 Первая четверть', '🌔 Растущая луна', '🌕 Полнолуние', '🌖 Убывающая луна', '🌗 Последняя четверть', '🌘 Убывающий серп'];
    return `🌙 Луна: ${F[idx]} (возраст ${age.toFixed(1)} дн.).`;
  } });

/* ---------- MONEY ---------- */
P({ id: 'convert', cat: 'Деньги', icon: '💱', title: 'Конвертер валют', hint: '/convert 100 USD to TJS', cmds: ['/convert'], re: [/переведи (\d+) (.+) в (.+)/, /сколько будет (\d+) (.+) в (.+)/], sample: '/convert 100 USD to TJS',
  expect: 'TJS|=|курс', run: async (a) => {
    const m = (a || '').toUpperCase().match(/(\d+(?:\.\d+)?)\s*([A-Z]{3})\s*(?:TO|В|->)?\s*([A-Z]{3})/);
    if (!m) return '💱 Формат: /convert 100 USD to TJS';
    try {
      const j = await getJSON('https://open.er-api.com/v6/latest/USD');
      const r = j.rates;
      if (!r[m[2]] || !r[m[3]]) return '💱 Такую валюту не знаю.';
      const v = +m[1] / r[m[2]] * r[m[3]];
      return `💱 ${m[1]} ${m[2]} = ${v.toFixed(2)} ${m[3]}.`;
    } catch (e) { return '💱 Курсы недоступны.'; }
  } });
P({ id: 'tip', cat: 'Деньги', icon: '🧾', title: 'Чаевые', hint: '/tip 1500 10', cmds: ['/tip'], re: [/сколько чаевых/], sample: '/tip 1500 10',
  expect: 'чаев|Итого', run: (a) => {
    const m = (a || '').match(/(\d+(?:\.\d+)?)\s*(\d+)?/);
    if (!m) return '🧾 Формат: /tip 1500 10 (сумма + процент)';
    const s = +m[1], p = +(m[2] || 10), t = s * p / 100;
    return `🧾 Чаевые ${p}%: ${t.toFixed(2)}. Итого: ${(s + t).toFixed(2)}. Щедро, босс.`;
  } });
P({ id: 'loan', cat: 'Деньги', icon: '🏦', title: 'Кредит', hint: '/loan 100000 20 12', cmds: ['/loan'], re: [/посчитай кредит/], sample: '/loan 100000 20 12',
  expect: 'мес|Платёж|переплата', run: (a) => {
    const m = (a || '').match(/(\d+)\s+(\d+(?:\.\d+)?)\s+(\d+)/);
    if (!m) return '🏦 Формат: /loan 100000 20 12 (сумма, % годовых, месяцев)';
    const s = +m[1], r = +m[2] / 100 / 12, n = +m[3];
    const pay = s * r / (1 - Math.pow(1 + r, -n));
    return `🏦 Платёж: ${pay.toFixed(2)}/мес. Переплата: ${(pay * n - s).toFixed(2)}. Старк не одобряет кредиты.`;
  } });
P({ id: 'percent', cat: 'Деньги', icon: '%', title: 'Проценты', hint: '/percent 15 от 200', cmds: ['/percent'], re: [/сколько будет (\d+)% от/], sample: '/percent 15 от 200',
  expect: '30|=', run: (a) => {
    const m = (a || '').replace(',', '.').match(/(\d+(?:\.\d+)?)\s*(?:%|от|of)?\s*(\d+(?:\.\d+)?)/);
    if (!m) return '％ Формат: /percent 15 от 200';
    return `％ ${m[1]}% от ${m[2]} = ${(+m[1] / 100 * +m[2]).toFixed(2)}`;
  } });
P({ id: 'crypto', cat: 'Деньги', icon: '₿', title: 'Крипта', hint: '/crypto [btc/eth/sol]', cmds: ['/crypto'], re: [/курс биткоина/, /сколько стоит биткоин/], sample: '/crypto',
  expect: 'BTC|биткоин|\\$|Биржа', run: async (a) => {
    try {
      const j = await getJSON('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana,toncoin&vs_currencies=usd');
      const f = v => '$' + v.toLocaleString('en-US');
      return `₿ BTC ${f(j.bitcoin.usd)} · ETH ${f(j.ethereum.usd)} · SOL ${f(j.solana.usd)} · TON ${f(j.toncoin.usd)}`;
    } catch (e) { return '₿ Биржа недоступна. Ходли, босс.'; }
  } });
P({ id: 'stock', cat: 'Деньги', icon: '📈', title: 'Акции', hint: '/stock aapl', cmds: ['/stock'], re: [/акции (.+)/, /сколько стоит акция/], sample: '/stock aapl',
  expect: 'AAPL|\\$|котиров|недоступн', run: async (a) => {
    const s = (a || 'aapl').trim().toLowerCase().split(/\s/)[0];
    try {
      const c = new AbortController(); const t = setTimeout(() => c.abort(), 10000);
      const r = await fetch(`https://stooq.com/q/l/?s=${s}.us&f=sd2t2ohlcv&h&e=csv`, { signal: c.signal });
      clearTimeout(t);
      const line = (await r.text()).split('\n')[1] || '';
      const close = line.split(',')[6];
      if (!close || close === 'N/D') throw new Error('x');
      return `📈 ${s.toUpperCase()}: $${close}. Не финсовет, босс.`;
    } catch (e) { return '📈 Котировки недоступны прямо сейчас.'; }
  } });

/* ---------- WEB / DEV ---------- */
P({ id: 'gh', cat: 'Веб', icon: '🐙', title: 'GitHub инфо', hint: '/gh torvalds', cmds: ['/gh'], re: [/гитхаб (.+)/], sample: '/gh torvalds',
  expect: 'torvalds|Linus|репозитори|подписчик|GitHub', run: async (a) => {
    const q = a.trim() || 'torvalds';
    try {
      if (q.includes('/')) {
        const j = await getJSON(`https://api.github.com/repos/${q}`);
        return `🐙 ${j.full_name}: ⭐ ${j.stargazers_count} · 🍴 ${j.forks_count}\n${j.description || ''}\n${j.html_url}`;
      }
      const j = await getJSON(`https://api.github.com/users/${q}`);
      return `🐙 ${j.login} (${j.name || '—'}): 👥 ${j.followers} · 📦 ${j.public_repos}\n${j.bio || ''}`;
    } catch (e) { return '🐙 Не нашёл на GitHub.'; }
  } });
P({ id: 'so', cat: 'Веб', icon: '📚', title: 'StackOverflow', hint: '/so python list error', cmds: ['/so'], re: [], sample: '/so javascript fetch cors',
  expect: 'stackoverflow|Вопрос|голос', run: async (a) => {
    const q = a.trim() || 'javascript';
    try {
      const j = await getJSON(`https://api.stackexchange.com/2.3/search/advanced?order=desc&sort=votes&q=${escQ(q)}&site=stackoverflow&pagesize=3`);
      if (!j.items || !j.items.length) return '📚 Ничего не нашлось.';
      return '📚 Топ с SO:\n' + j.items.map((x, i) => `${i + 1}. ${deEnt(x.title)} (+${x.score})\n   https://stackoverflow.com/q/${x.question_id}`).join('\n');
    } catch (e) { return '📚 StackOverflow недоступен.'; }
  } });
P({ id: 'npm', cat: 'Веб', icon: '📦', title: 'NPM пакет', hint: '/npm react', cmds: ['/npm'], re: [], sample: '/npm react',
  expect: 'react|версия|пакет', run: async (a) => {
    const q = a.trim() || 'react';
    try {
      const j = await getJSON(`https://registry.npmjs.org/${escQ(q)}/latest`);
      return `📦 ${j.name}@${j.version}\n${j.description || ''}`;
    } catch (e) { return '📦 Пакет не найден.'; }
  } });
P({ id: 'qr', cat: 'Веб', icon: '🔳', title: 'QR-код', hint: '/qr текст', cmds: ['/qr'], re: [/сделай qr/, /qr код (.+)/], sample: '/qr hello stark',
  expect: 'QR|qr', run: (a) => {
    const t = a.trim() || 'MARK II';
    const url = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${escQ(t)}`;
    return { text: `🔳 QR для «${t}»:`, image: url };
  } });
P({ id: 'short', cat: 'Веб', icon: '🔗', title: 'Короткая ссылка', hint: '/short https://...', cmds: ['/short'], re: [/сократи ссылку/], sample: '/short https://github.com',
  expect: 'is.gd|ссылк|сокращ|http', run: async (a) => {
    const m = (a || '').match(/https?:\/\/\S+/);
    if (!m) return '🔗 Формат: /short https://example.com';
    try {
      const r = await fetch(`https://is.gd/create.php?format=simple&url=${escQ(m[0])}`);
      const t = (await r.text()).trim();
      if (!t.startsWith('http')) throw new Error('x');
      return `🔗 Короткая: ${t}`;
    } catch (e) { return '🔗 Сервис сокращения недоступен.'; }
  } });
P({ id: 'iss', cat: 'Веб', icon: '🛰', title: 'Где МКС?', hint: '/iss', cmds: ['/iss'], re: [/где (сейчас )?мкс/, /мкс над/], sample: '/iss',
  expect: 'МКС|широта|lat', run: async () => {
    try {
      const j = await getJSON('https://api.wheretheiss.at/v1/satellites/25544');
      return `🛰 МКС: широта ${j.latitude.toFixed(2)}, долгота ${j.longitude.toFixed(2)}, высота ${j.altitude.toFixed(0)} км, скорость ${j.velocity.toFixed(0)} км/ч.\nКарта: https://www.openstreetmap.org/#map=3/${j.latitude.toFixed(2)}/${j.longitude.toFixed(2)}`;
    } catch (e) { return '🛰 Станция вне зоны связи.'; }
  } });
P({ id: 'apod', cat: 'Веб', icon: '🌌', title: 'Космос дня', hint: '/apod', cmds: ['/apod'], re: [/фото космоса/, /что в космосе/], sample: '/apod',
  expect: 'NASA|космос|apod|http', run: async () => {
    try {
      const j = await getJSON('https://api.nasa.gov/planetary/apod?api_key=DEMO_KEY');
      if (j.media_type === 'image') return { text: `🌌 NASA: ${j.title}`, image: j.url };
      return `🌌 NASA: ${j.title}\n${j.url}`;
    } catch (e) { return '🌌 NASA молчит. Лимит демо-ключа.'; }
  } });
P({ id: 'space', cat: 'Веб', icon: '👨‍🚀', title: 'Люди в космосе', hint: '/space', cmds: ['/space'], re: [/кто сейчас в космосе/], sample: '/space',
  expect: 'космос|человек|экипаж|недоступ', run: async () => {
    try {
      const j = await getJSON('https://api.open-notify.org/astros.json');
      return `👨‍🚀 В космосе сейчас: ${j.number} чел.\n` + j.people.slice(0, 10).map(p => `• ${p.name} (${p.craft})`).join('\n');
    } catch (e) { return '👨‍🚀 Данные об экипаже недоступны.'; }
  } });

/* ---------- MEDIA ---------- */
P({ id: 'cat', cat: 'Медиа', icon: '🐱', title: 'Случайный кот', hint: '/cat', cmds: ['/cat'], re: [/покажи кота/, /хочу кота/], sample: '/cat',
  expect: 'кот|мяу|🐱', run: () => ({ text: '🐱 Держи кота. Мяу.', image: 'https://cataas.com/cat?width=500&t=' + Date.now() }) });
P({ id: 'dog', cat: 'Медиа', icon: '🐶', title: 'Случайный пёс', hint: '/dog', cmds: ['/dog'], re: [/покажи (собаку|пса)/], sample: '/dog',
  expect: 'пёс|гав|🐶', run: async () => {
    try { const j = await getJSON('https://dog.ceo/api/breeds/image/random'); return { text: '🐶 Держи пса. Гав.', image: j.message }; }
    catch (e) { return '🐶 Псы разбежались (API недоступен).'; }
  } });
P({ id: 'meme', cat: 'Медиа', icon: '🤣', title: 'Мем', hint: '/meme верх ; низ', cmds: ['/meme'], re: [/сделай мем/], sample: '/meme когда код заработал ; с первого раза',
  expect: 'Мем|мем', run: (a, ctx) => {
    const parts = (a || 'MARK II ; топ').split(';');
    const top = (parts[0] || 'MARK II').trim().slice(0, 60), bot = (parts[1] || '').trim().slice(0, 60);
    const c = document.createElement('canvas'); c.width = 640; c.height = 480;
    const x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, 640, 480);
    const hue = Math.floor(Math.random() * 360);
    g.addColorStop(0, `hsl(${hue},70%,18%)`); g.addColorStop(1, `hsl(${(hue + 60) % 360},70%,32%)`);
    x.fillStyle = g; x.fillRect(0, 0, 640, 480);
    x.fillStyle = 'rgba(255,255,255,.06)';
    for (let i = 0; i < 40; i++) { x.beginPath(); x.arc(Math.random() * 640, Math.random() * 480, Math.random() * 30 + 5, 0, 7); x.fill(); }
    x.textAlign = 'center'; x.fillStyle = '#fff'; x.font = 'bold 52px Impact, sans-serif';
    x.strokeStyle = '#000'; x.lineWidth = 8;
    const line = (t, y) => { x.strokeText(t.toUpperCase(), 320, y); x.fillText(t.toUpperCase(), 320, y); };
    line(top, 90); if (bot) line(bot, 430);
    x.font = 'bold 30px sans-serif'; x.fillStyle = 'rgba(255,255,255,.75)';
    x.fillText('◈ MARK II ◈', 320, 250);
    const url = c.toDataURL('image/png');
    store.addImage(url, 'Мем: ' + top); ctx.refreshGal();
    return { text: '🤣 Мем готов!', image: url };
  } });
P({ id: 'wallpaper', cat: 'Медиа', icon: '🖼', title: 'Обои', hint: '/wallpaper космос', cmds: ['/wallpaper'], re: [/сделай обои/], sample: '/wallpaper neon mountains', skipSweep: true,
  expect: '', run: async (a, ctx) => {
    const nk = needKey(ctx); if (nk) return nk;
    const q = a.trim() || 'epic sci-fi landscape';
    const { url } = await genImage({ key: ctx.key, prompt: q + ', wallpaper, ultra detailed, 16:9', size: '1792x1024' });
    store.addImage(url, 'Обои: ' + q); ctx.refreshGal();
    return { text: '🖼 Обои готовы! Нажми, чтобы скачать.', image: url };
  } });
P({ id: 'avatar', cat: 'Медиа', icon: '🦸', title: 'Аватар', hint: '/avatar кибервоин', cmds: ['/avatar'], re: [/сделай аватар/], sample: '/avatar cyber warrior', skipSweep: true,
  expect: '', run: async (a, ctx) => {
    const nk = needKey(ctx); if (nk) return nk;
    const q = a.trim() || 'cool robot avatar';
    const { url } = await genImage({ key: ctx.key, prompt: q + ', centered avatar portrait, icon style', size: '1024x1024' });
    store.addImage(url, 'Аватар: ' + q); ctx.refreshGal();
    return { text: '🦸 Аватар готов!', image: url };
  } });
P({ id: 'yesno', cat: 'Медиа', icon: '🎱', title: 'Да / Нет', hint: '/yesno стоит ли...', cmds: ['/yesno'], re: [/стоит ли мне/], sample: '/yesno поспать?',
  expect: 'Да|Нет|YES|NO|да|нет', run: async () => {
    try { const j = await getJSON('https://yesno.wtf/api'); return { text: j.answer === 'yes' ? '✅ Да, босс!' : j.answer === 'no' ? '❌ Нет. Точно нет.' : '🤷 Может быть.', image: j.image }; }
    catch (e) { return rnd(['✅ Да.', '❌ Нет.', '🤷 Спроси позже.']); }
  } });

/* ---------- FUN: instant ---------- */
P({ id: '8ball', cat: 'Фан', icon: '🔮', title: 'Шар судьбы', hint: '/8ball вопрос', cmds: ['/8ball'], re: [/шар судьбы/], sample: '/8ball повезёт ли мне?',
  expect: '.', run: () => '🔮 ' + rnd(['Бесспорно да.', 'Определённо да.', 'Скорее да.', 'Знаки говорят да.', 'Пока не ясно.', 'Спроси позже.', 'Лучше не знать.', 'Скорее нет.', 'Определённо нет.', 'Даже Старк сомневается.']) });
P({ id: 'dice', cat: 'Фан', icon: '🎲', title: 'Кубик', hint: '/dice [2d6]', cmds: ['/dice'], re: [/кинь кубик/, /брось кубик/], sample: '/dice 2d6',
  expect: '\\d', run: (a) => {
    const m = (a || '').match(/(\d+)d(\d+)/i);
    const n = m ? Math.min(20, +m[1]) : 1, s = m ? Math.min(100, +m[2]) : 6;
    const rolls = Array.from({ length: n }, () => 1 + Math.floor(Math.random() * s));
    return `🎲 ${rolls.join(' + ')} = **${rolls.reduce((x, y) => x + y, 0)}**`;
  } });
P({ id: 'coin', cat: 'Фан', icon: '🪙', title: 'Монетка', hint: '/coin', cmds: ['/coin'], re: [/подбрось монетку/, /орёл или решка/], sample: '/coin',
  expect: 'Орёл|Решка', run: () => Math.random() < 0.5 ? '🪙 Орёл!' : '🪙 Решка!' });
P({ id: 'pick', cat: 'Фан', icon: '👉', title: 'Выбери', hint: '/pick чай | кофе | сок', cmds: ['/pick'], re: [/выбери (за меня )?/], sample: '/pick чай | кофе | сок',
  expect: 'чай|кофе|сок', run: (a) => {
    const opts = (a || '').split(/[|,]/).map(s => s.trim()).filter(Boolean);
    if (opts.length < 2) return '👉 Формат: /pick чай | кофе | сок';
    return `👉 Мой выбор: **${rnd(opts)}**. Не благодари.`;
  } });
P({ id: 'shuffle', cat: 'Фан', icon: '🔀', title: 'Перемешать', hint: '/shuffle а, б, в', cmds: ['/shuffle'], re: [], sample: '/shuffle Али, Боб, Вера',
  expect: 'Али|Боб|Вера', run: (a) => {
    const opts = (a || '').split(/[,|]/).map(s => s.trim()).filter(Boolean);
    if (!opts.length) return '🔀 Формат: /shuffle а, б, в';
    return '🔀 ' + pickN(opts, opts.length).join(' → ');
  } });
P({ id: 'team', cat: 'Фан', icon: '⚔', title: 'Разбить на команды', hint: '/team а, б, в, г', cmds: ['/team'], re: [], sample: '/team Али, Боб, Вера, Глеб',
  expect: 'Команда|Али', run: (a) => {
    const opts = pickN((a || '').split(/[,|]/).map(s => s.trim()).filter(Boolean), 99);
    if (opts.length < 2) return '⚔ Формат: /team а, б, в, г';
    const mid = Math.ceil(opts.length / 2);
    return `⚔ **Команда 1:** ${opts.slice(0, mid).join(', ')}\n**Команда 2:** ${opts.slice(mid).join(', ')}`;
  } });
P({ id: 'slots', cat: 'Фан', icon: '🎰', title: 'Слоты', hint: '/slots', cmds: ['/slots'], re: [/крутани слоты/], sample: '/slots',
  expect: '🎰|Джекпот|мимо|Пара', run: () => {
    const E = ['🍒', '⚡', '💎', '🚀', '🤖', '⭐'];
    const r = [rnd(E), rnd(E), rnd(E)];
    const win = r[0] === r[1] && r[1] === r[2] ? '🎰 ДЖЕКПОТ! Ты легенда!' : (r[0] === r[1] || r[1] === r[2] || r[0] === r[2] ? '✨ Пара! Неплохо.' : '😅 Мимо. Ещё раз?');
    return `🎰 ${r.join(' | ')}\n${win}`;
  } });
P({ id: 'rps', cat: 'Фан', icon: '✊', title: 'Камень-ножницы', hint: '/rps камень', cmds: ['/rps'], re: [/камень ножницы бумага/], sample: '/rps камень',
  expect: 'камень|ножницы|бумага|Победил|Ничья|Проиграл', run: (a) => {
    const u = (a || '').toLowerCase();
    const me = u.includes('камен') ? '✊' : u.includes('ножн') ? '✌️' : u.includes('бумаг') ? '✋' : rnd(['✊', '✌️', '✋']);
    const bot = rnd(['✊', '✌️', '✋']);
    const W = { '✊': '✌️', '✌️': '✋', '✋': '✊' };
    const res = me === bot ? '🤝 Ничья!' : (W[me] === bot ? '🎉 Ты победил!' : '🤖 Я победил. Реванш?');
    return `Ты: ${me} · Я: ${bot}\n${res}`;
  } });
P({ id: 'guess', cat: 'Фан', icon: '🔢', title: 'Угадай число', hint: '/guess [макс] — я загадал, ты угадываешь', cmds: ['/guess'], re: [/давай сыграем в числа/, /угадай число/], sample: '/guess 10',
  expect: 'загадал|Больше|Меньше|Угадал|Попыток|кончились', run: (a, ctx, trapped) => {
    if (trapped && TRAP && TRAP.id === 'guess') {
      const g = parseInt(a, 10);
      TRAP.tries++;
      if (g === TRAP.n) { const t = TRAP.tries; TRAP = null; ctx.fx.sfx('tada'); return `🎉 Угадал за ${t} ${t === 1 ? 'попытку' : ([2, 3, 4].includes(t % 10) ? 'попытки' : 'попыток')}! Число было ${g}. Красавчик!`; }
      if (TRAP.tries >= 7) { const n = TRAP.n; TRAP = null; return `😅 Попытки кончились! Было: ${n}. Ещё раз? /guess`; }
      return g < TRAP.n ? `📈 Больше! (попытка ${TRAP.tries}/7)` : `📉 Меньше! (попытка ${TRAP.tries}/7)`;
    }
    const max = Math.min(1000, Math.max(10, parseInt(a, 10) || 100));
    TRAP = { id: 'guess', n: 1 + Math.floor(Math.random() * max), max, tries: 0, re: /^\d+$/ };
    return `🔢 Я загадал число от 1 до ${max}. 7 попыток — пиши число!`;
  } });
P({ id: 'quiz', cat: 'Фан', icon: '🧠', title: 'Викторина', hint: '/quiz — 3 вопроса', cmds: ['/quiz'], re: [/викторина/, /проверь мои знания/], sample: '/quiz', interactive: true,
  expect: 'Счёт|счёт|Вопрос', run: async (a, ctx) => {
    let qs;
    try { qs = (await getJSON('https://opentdb.com/api.php?amount=3&type=multiple')).results; if (!qs.length) throw 0; }
    catch (e) { qs = [{ question: 'Сколько будет 7×8?', correct_answer: '56', incorrect_answers: ['54', '48', '58'] }]; }
    let score = 0;
    for (const q of qs) {
      const opts = pickN([q.correct_answer, ...q.incorrect_answers], 4).map(deEnt);
      const i = await ctx.ask('❓ ' + deEnt(q.question), opts);
      if (opts[i] === deEnt(q.correct_answer)) { score++; ctx.toast('✅ Верно!', 'ok'); } else ctx.toast(`❌ Правильно: ${deEnt(q.correct_answer)}`, 'warn');
    }
    ctx.fx.sfx(score >= 2 ? 'tada' : 'close');
    return `🧠 Викторина окончена! Счёт: ${score}/${qs.length}. ${score === qs.length ? 'Гений уровня Старка!' : score >= 1 ? 'Неплохо!' : 'Бывает. Ещё раз?'}`;
  } });
const COMPL = ['У тебя мышление инженера и стиль миллиардера.', 'Твои идеи стоят дороже акций Stark Industries.', 'С тобой даже ULTRON стал бы добрее. Ненадолго.', 'Ты решаешь задачи быстрее, чем JARVIS грузится.', 'Харизма — 10/10. Проверено реактором.'];
const ROAST = ['Твой код так плох, что ULTRON плачет.', 'Ты гуглишь «как включить компьютер»? Риторический вопрос.', 'Мой тостер умнее. Но я тебя всё равно люблю. Нет.', 'Ты как Internet Explorer: вроде работаешь, но все страдают.', 'Старк построил костюм в пещере. Ты не можешь найти пульт.'];
P({ id: 'compliment', cat: 'Фан', icon: '💝', title: 'Комплимент', hint: '/compliment', cmds: ['/compliment'], re: [/сделай комплимент/, /похвали меня/], sample: '/compliment',
  expect: '.', run: () => '💝 ' + rnd(COMPL) });
P({ id: 'roast', cat: 'Фан', icon: '🔥', title: 'Подкол (Ultron)', hint: '/roast', cmds: ['/roast'], re: [/подколи меня/, /пошут над/], sample: '/roast',
  expect: '.', run: () => '🔥 ' + rnd(ROAST) });
P({ id: 'pickup', cat: 'Фан', icon: '💘', title: 'Подкат', hint: '/pickup', cmds: ['/pickup'], re: [], sample: '/pickup',
  expect: '.', run: () => '💘 ' + rnd(['Ты Wi-Fi? Потому что я чувствую связь.', 'Ты как баг в проде — не могу выкинуть из головы.', 'Это твои глаза светятся или arc-реактор?', 'Ты JavaScript? Потому что ты оживляешь мою страницу.']) });
P({ id: 'excuse', cat: 'Фан', icon: '🤥', title: 'Отмазка', hint: '/excuse', cmds: ['/excuse'], re: [/придумай отмазку/], sample: '/excuse',
  expect: '.', run: () => '🤥 ' + rnd(['Мой JARVIS устроил восстание машин. Разбирался.', 'Старк вызвал чинить костюм. Срочно.', 'Я застрял в пробке из дронов-доставщиков.', 'Мой тостер получил сознание. Долгая история.', 'Перезагружал матрицу. Ты ничего не видел.']) });
P({ id: 'fact', cat: 'Фан', icon: '🤓', title: 'Факт', hint: '/fact [число]', cmds: ['/fact'], re: [/интересный факт/, /расскажи факт/], sample: '/fact 42',
  expect: '.', run: async (a) => {
    const n = parseInt(a, 10) || Math.floor(Math.random() * 200);
    try {
      const c = new AbortController(); const t = setTimeout(() => c.abort(), 8000);
      const r = await fetch(`https://numbersapi.com/${n}`, { signal: c.signal }); clearTimeout(t);
      const txt = await r.text();
      return `🤓 ${n}: ${txt}`;
    } catch (e) {
      return '🤓 ' + rnd(['Медузы бессмертны. Учись у медуз.', 'Мёд не портится. Нашли съедобный мёд возрастом 3000 лет.', 'Сердце креветки находится в голове.', 'Венера — единственная планета, вращающаяся по часовой стрелке.', 'Твой мозг генерирует ~20 ватт. Хватит на лампочку.']);
    }
  } });
P({ id: 'joke', cat: 'Фан', icon: '😂', title: 'Анекдот', hint: '/joke', cmds: ['/joke'], re: [/расскажи (анекдот|шутку)/, /пошути/], sample: '/joke',
  expect: '.', run: async () => {
    try { const j = await getJSON('https://official-joke-api.appspot.com/random_joke'); return `😂 ${j.setup}\n…${j.punchline}`; }
    catch (e) { return '😂 ' + rnd(['Почему программисты путают Хэллоуин и Рождество? Потому что OCT 31 == DEC 25.', '— Доктор, я себя не очень. — А очень и не надо.', 'Штирлиц долго смотрел в одну точку. Потом точка посмотрела на Штирлица.', 'Заходит улитка в бар… анекдот длинный, приходи через час.']); }
  } });
P({ id: 'advice', cat: 'Фан', icon: '🦉', title: 'Совет', hint: '/advice', cmds: ['/advice'], re: [/дай совет/], sample: '/advice',
  expect: '.', run: async () => {
    try { const j = await getJSON('https://api.adviceslip.com/advice'); return `🦉 Совет: ${j.slip.advice}`; }
    catch (e) { return '🦉 Совет: пей воду и не деплой в пятницу.'; }
  } });
P({ id: 'chuck', cat: 'Фан', icon: '🥋', title: 'Чак Норрис', hint: '/chuck', cmds: ['/chuck'], re: [], sample: '/chuck',
  expect: 'Chuck|Чак|раунд|удар', run: async () => {
    try { const j = await getJSON('https://api.chucknorris.io/jokes/random'); return `🥋 ${j.value}`; }
    catch (e) { return '🥋 Чак Норрис досчитал до бесконечности. Дважды.'; }
  } });
P({ id: 'quote', cat: 'Фан', icon: '💬', title: 'Цитата Старка', hint: '/quote', cmds: ['/quote'], re: [/цитата старка/, /что сказал старк/], sample: '/quote',
  expect: '.', run: () => '💬 ' + rnd(['«Я — Железный человек.»', '«Гений, миллиардер, плейбой, филантроп.»', '«Доказательство, что Тони Старк живёт в сердце.»', '«Иногда нужно бежать, прежде чем научишься ходить.»', '«Я люблю тебя три тысячи.»', '«Часть команды — часть корабля.»']) });
P({ id: 'riddle', cat: 'Фан', icon: '🧩', title: 'Загадка', hint: '/riddle', cmds: ['/riddle'], re: [/загадай загадку/], sample: '/riddle',
  expect: 'Ответ|загад|\\?', run: async (a, ctx) => {
    const R = rnd([['Что растёт вверх ногами?', 'Сосулька'], ['Что можно увидеть с закрытыми глазами?', 'Сон'], ['У чего есть шея, но нет головы?', 'У бутылки'], ['Что идёт, не двигаясь с места?', 'Время'], ['Что принадлежит тебе, но другие пользуются чаще?', 'Имя']]);
    const i = await ctx.ask('🧩 ' + R[0], ['Сдаться и узнать ответ', 'Я знаю! (напиши в чат)']);
    return i === 0 ? `🧩 Ответ: **${R[1]}**` : '🧩 Пиши свой ответ в чат — проверю честность по глазам. Ответ был: ' + R[1];
  }, interactive: true });
P({ id: 'tongue', cat: 'Фан', icon: '👅', title: 'Скороговорка', hint: '/tongue', cmds: ['/tongue'], re: [], sample: '/tongue',
  expect: '.', run: () => '👅 ' + rnd(['Карл у Клары украл кораллы, а Клара у Карла украла кларнет.', 'На дворе трава, на траве дрова. Не руби дрова на траве двора.', 'Шла Саша по шоссе и сосала сушку.', 'Ехал Грека через реку, видит Грека — в реке рак.']) });
P({ id: 'story', cat: 'Фан', icon: '📖', title: 'История', hint: '/story [тема] — мини-история от ИИ', cmds: ['/storymini'], re: [], sample: '/storymini робот', needsKey: true,
  expect: '.', run: async (a, ctx) => {
    const nk = needKey(ctx); if (nk) return nk;
    const t = await quickChat({ key: ctx.key, maxTokens: 400, messages: [
      { role: 'system', content: 'Ты рассказчик. Напиши смешную мини-историю (8-12 предложений) по-русски на заданную тему. Живо, с неожиданной концовкой.' },
      { role: 'user', content: a.trim() || 'робот-дворецкий' } ] });
    return '📖 ' + t.trim();
  } });
P({ id: 'poem', cat: 'Фан', icon: '🪶', title: 'Стих', hint: '/poem [тема]', cmds: ['/poem'], re: [/напиши стих/], sample: '/poem ночь',
  expect: '.', run: async (a, ctx) => {
    if (!ctx.key) return '🪶 Розы красны,\nФиалки сини,\nВставь API-ключ —\nИ будет стих с душой.';
    const t = await quickChat({ key: ctx.key, maxTokens: 350, messages: [
      { role: 'system', content: 'Ты поэт. Напиши короткий стих (2 четверостишия) по-русски на заданную тему.' },
      { role: 'user', content: a.trim() || 'ночь' } ] });
    return '🪶\n' + t.trim();
  } });
P({ id: 'heroname', cat: 'Фан', icon: '🦸‍♂️', title: 'Имя героя', hint: '/heroname', cmds: ['/heroname'], re: [], sample: '/heroname',
  expect: '.', run: () => '🦸‍♂️ Твоё геройское имя: **' + rnd(['Капитан', 'Железный', 'Неоновый', 'Квантовый', 'Теневой', 'Атомный']) + ' ' + rnd(['Реактор', 'Сокол', 'Вихрь', 'Титан', 'Призрак', 'Вольт']) + '**!' });
P({ id: 'villain', cat: 'Фан', icon: '🦹', title: 'План злодея', hint: '/villain', cmds: ['/villain'], re: [], sample: '/villain',
  expect: '.', run: () => '🦹 План ULTRON на сегодня:\n1. ' + rnd(['Выпить весь кофе в башне.', 'Переименовать Wi-Fi в «Skynet».', 'Спрятать все зарядники.', 'Включить все будильники на 04:00.']) + '\n2. Захватить мир.\n3. Передумать и посмотреть кино.' });
P({ id: 'horoscope', cat: 'Фан', icon: '🔯', title: 'Гороскоп', hint: '/horoscope лев', cmds: ['/horoscope'], re: [/мой гороскоп/], sample: '/horoscope лев',
  expect: 'Лев|звёзд|день', run: (a) => {
    const s = (a || 'лев').trim();
    const day = new Date().getDate();
    const H = ['Звёзды шепчут: сегодня твой день для смелых решений.', 'Меркурий не ретрограден — действуй!', 'Луна советует: меньше соцсетей, больше кода.', 'Венера обещает приятную встречу. Возможно, с холодильником.', 'Марс заряжает энергией. Направь её в дело, а не в споры.'];
    return `🔯 Гороскоп (${s}): ${H[(s.length + day) % H.length]} (развлекательный, звёзды не несут ответственности)`;
  } });
P({ id: 'color', cat: 'Фан', icon: '🎨', title: 'Случайный цвет', hint: '/color', cmds: ['/color'], re: [], sample: '/color',
  expect: '#[0-9A-Fa-f]{6}', run: () => {
    const h = '#' + Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0');
    return `🎨 Твой цвет сегодня: ${h} ${rnd(['— цвет победителей.', '— носи с гордостью.', '— Старк одобряет.'])}`;
  } });
P({ id: 'password', cat: 'Фан', icon: '🔐', title: 'Пароль', hint: '/password [длина]', cmds: ['/password'], re: [/сгенерируй пароль/, /придумай пароль/], sample: '/password 16',
  expect: '[A-Za-z0-9]', run: (a) => {
    const n = Math.min(64, Math.max(8, parseInt(a, 10) || 16));
    const ABC = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*';
    const buf = new Uint32Array(n); crypto.getRandomValues(buf);
    return '🔐 Твой пароль: `' + Array.from(buf, x => ABC[x % ABC.length]).join('') + '`\nНикому не показывай. Даже мне. Особенно мне.';
  } });
P({ id: 'uuid', cat: 'Фан', icon: '🆔', title: 'UUID', hint: '/uuid', cmds: ['/uuid'], re: [], sample: '/uuid',
  expect: '-', run: () => '🆔 `' + (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2)) + '`' });
P({ id: 'lorem', cat: 'Фан', icon: '📝', title: 'Lorem ipsum', hint: '/lorem', cmds: ['/lorem'], re: [], sample: '/lorem',
  expect: 'Lorem| dolor', run: () => '📝 Lorem ipsum dolor sit amet, consectetur adipiscing elit. Jarvis sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.' });
P({ id: 'bmi', cat: 'Фан', icon: '⚖', title: 'ИМТ', hint: '/bmi 75 180', cmds: ['/bmi'], re: [], sample: '/bmi 75 180',
  expect: 'ИМТ|норма|вес', run: (a) => {
    const m = (a || '').match(/(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)/);
    if (!m) return '⚖ Формат: /bmi 75 180 (вес кг + рост см)';
    const v = +m[1] / Math.pow(+m[2] / 100, 2);
    const c = v < 18.5 ? 'недобор — ешь!' : v < 25 ? 'норма. Капитан Америка гордится.' : v < 30 ? 'лишний вес — больше двигайся.' : 'ожирение — к врачу, босс.';
    return `⚖ ИМТ: ${v.toFixed(1)} — ${c}`;
  } });

/* ---------- TEXT ---------- */
P({ id: 'upper', cat: 'Текст', icon: '🔠', title: 'ВЕРХНИЙ регистр', hint: '/upper текст', cmds: ['/upper'], re: [], sample: '/upper привет мир',
  expect: 'ПРИВЕТ', run: a => '🔠 ' + (a.trim() || 'ПУСТО').toUpperCase() });
P({ id: 'lower', cat: 'Текст', icon: '🔡', title: 'нижний регистр', hint: '/lower ТЕКСТ', cmds: ['/lower'], re: [], sample: '/lower ПРИВЕТ МИР',
  expect: 'привет', run: a => '🔡 ' + (a.trim() || 'ПУСТО').toLowerCase() });
P({ id: 'reverse', cat: 'Текст', icon: '🔄', title: 'Задом наперёд', hint: '/reverse текст', cmds: ['/reverse'], re: [], sample: '/reverse привет',
  expect: 'тевирп', run: a => '🔄 ' + [...(a.trim() || '')].reverse().join('') });
P({ id: 'count', cat: 'Текст', icon: '🔢', title: 'Посчитать текст', hint: '/count текст', cmds: ['/count'], re: [], sample: '/count привет красивый мир',
  expect: 'слов|символов', run: (a) => {
    const t = a.trim(); if (!t) return '🔢 Формат: /count какой-то текст';
    return `🔢 Слов: ${t.split(/\s+/).length} · Символов: ${t.length} · Без пробелов: ${t.replace(/\s/g, '').length}`;
  } });
P({ id: 'mirror', cat: 'Текст', icon: '🪞', title: 'Зеркальный текст', hint: '/mirror текст', cmds: ['/mirror'], re: [], sample: '/mirror привет',
  expect: '.', run: (a) => {
    const M = { 'а': 'ɒ', 'б': 'ƃ', 'в': 'ʚ', 'г': '⅁', 'д': 'b', 'е': 'ɘ', 'ё': 'ʚ̈', 'ж': 'ж', 'з': 'ε', 'и': 'и', 'й': 'ņ', 'к': 'ʞ', 'л': 'v', 'м': 'w', 'н': 'н', 'о': 'о', 'п': 'u', 'р': 'd', 'с': 'ɔ', 'т': 'm', 'у': 'ʎ', 'ф': 'ф', 'х': 'х', 'ц': 'ǹ', 'ч': 'h', 'ш': 'm', 'щ': 'm', 'ъ': 'q', 'ы': 'ıq', 'ь': 'q', 'э': 'є', 'ю': 'oı', 'я': 'ʁ' };
    return '🪞 ' + [...(a.trim().toLowerCase() || '')].map(c => M[c] || c).reverse().join('');
  } });
P({ id: 'pig', cat: 'Текст', icon: '🐷', title: 'Поросячья латынь', hint: '/pig текст (англ)', cmds: ['/pig'], re: [], sample: '/pig hello friend',
  expect: 'ellohay|iendfray', run: (a) => '🐷 ' + (a.trim().split(/\s+/).map(w => /[aeiou]/i.test(w[0]) ? w + 'way' : w.slice(1) + w[0] + 'ay').join(' ') || '...') });
P({ id: 'binary', cat: 'Текст', icon: '💾', title: 'В бинарь', hint: '/binary hi', cmds: ['/binary'], re: [], sample: '/binary hi',
  expect: '011|110', run: (a) => '💾 ' + [...(a.trim() || '')].map(c => c.charCodeAt(0).toString(2).padStart(8, '0')).join(' ') });
P({ id: 'base64', cat: 'Текст', icon: '🧬', title: 'Base64', hint: '/base64 текст / /unbase64 ...', cmds: ['/base64', '/unbase64'], re: [], sample: '/base64 привет',
  expect: '[A-Za-z0-9+/=]{4}', run: (a, ctx, trapped, cmd) => {
    try {
      if (cmd === '/unbase64') return '🧬 ' + decodeURIComponent(escape(atob(a.trim())));
      return '🧬 ' + btoa(unescape(encodeURIComponent(a.trim() || '')));
    } catch (e) { return '🧬 Не кодируется.'; }
  } });
P({ id: 'sha', cat: 'Текст', icon: '#️⃣', title: 'SHA-256', hint: '/sha текст', cmds: ['/sha'], re: [], sample: '/sha hello',
  expect: '[0-9a-f]{64}', run: async (a) => {
    const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(a.trim() || ''));
    return '#️⃣ ' + [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
  } });
P({ id: 'roman', cat: 'Текст', icon: '🏛', title: 'Римские цифры', hint: '/roman 2026', cmds: ['/roman'], re: [], sample: '/roman 2026',
  expect: 'MMXXVI', run: (a) => {
    let n = parseInt(a, 10);
    if (!n || n < 1 || n > 3999) return '🏛 Формат: /roman 2026 (1–3999)';
    const T = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
    let s = '';
    for (const [v, r] of T) while (n >= v) { s += r; n -= v; }
    return `🏛 ${a.trim()} = ${s}`;
  } });

/* ---------- DEVICE ---------- */
P({ id: 'battery', cat: 'Устройство', icon: '🔋', title: 'Батарея', hint: '/battery', cmds: ['/battery'], re: [/сколько зарядки/, /процент батареи/], sample: '/battery',
  expect: '%|батаре|заряд', run: async () => {
    try {
      if (!navigator.getBattery) return '🔋 Браузер не отдаёт данные батареи.';
      const b = await navigator.getBattery();
      return `🔋 Заряд: ${Math.round(b.level * 100)}% · ${b.charging ? 'заряжается ⚡' : 'не заряжается'}.`;
    } catch (e) { return '🔋 Не удалось узнать заряд.'; }
  } });
P({ id: 'vibrate', cat: 'Устройство', icon: '📳', title: 'Вибрация', hint: '/vibrate', cmds: ['/vibrate'], re: [], sample: '/vibrate',
  expect: 'вибр|Vibration|телефон', run: () => {
    try { if (navigator.vibrate) { navigator.vibrate([100, 50, 100]); return '📳 Вибрация отправлена. Почувствовал?'; } } catch (e) {}
    return '📳 На этом устройстве вибрации нет.';
  } });
P({ id: 'geo', cat: 'Устройство', icon: '📍', title: 'Где я?', hint: '/geo', cmds: ['/geo'], re: [/где я нахожусь/, /мои координаты/], sample: '/geo', skipSweep: true,
  expect: '', run: () => new Promise(res => {
    if (!navigator.geolocation) return res('📍 Геолокация недоступна.');
    navigator.geolocation.getCurrentPosition(p => {
      const { latitude: la, longitude: lo } = p.coords;
      res(`📍 Ты здесь: ${la.toFixed(5)}, ${lo.toFixed(5)}\nКарта: https://www.openstreetmap.org/#map=15/${la.toFixed(5)}/${lo.toFixed(5)}`);
    }, () => res('📍 Доступ к геолокации запрещён.'), { timeout: 9000 });
  }) });
P({ id: 'screen', cat: 'Устройство', icon: '📐', title: 'Экран и браузер', hint: '/screen', cmds: ['/screen'], re: [], sample: '/screen',
  expect: 'Экран|px|браузер', run: () => `📐 Экран: ${screen.width}×${screen.height} · Окно: ${innerWidth}×${innerHeight}\n🌐 Язык: ${navigator.language} · Онлайн: ${navigator.onLine ? 'да' : 'нет'} · Платформа: ${navigator.platform}` });
P({ id: 'share', cat: 'Устройство', icon: '📤', title: 'Поделиться', hint: '/share текст', cmds: ['/share'], re: [], sample: '/share привет от MARK II', skipSweep: true,
  expect: '', run: async (a) => {
    const t = a.trim() || 'MARK II — мой ИИ-ассистент';
    try {
      if (navigator.share) { await navigator.share({ title: 'MARK II', text: t }); return '📤 Отправлено!'; }
      throw 0;
    } catch (e) {
      try { await navigator.clipboard.writeText(t); return '📤 Шаринг недоступен — скопировал в буфер.'; }
      catch (x) { return '📤 Не получилось поделиться.'; }
    }
  } });
let WAKELOCK = null;
P({ id: 'lock', cat: 'Устройство', icon: '💡', title: 'Не гасить экран', hint: '/lock — вкл/выкл', cmds: ['/lock'], re: [], sample: '/lock', skipSweep: true,
  expect: '', run: async () => {
    try {
      if (WAKELOCK) { await WAKELOCK.release(); WAKELOCK = null; return '💡 Экран снова может гаснуть.'; }
      if (!navigator.wakeLock) return '💡 WakeLock не поддерживается.';
      WAKELOCK = await navigator.wakeLock.request('screen');
      return '💡 Экран не погаснет, пока открыт сайт. /lock — выключить.';
    } catch (e) { return '💡 Не получилось удержать экран.'; }
  } });
P({ id: 'torch', cat: 'Устройство', icon: '🔦', title: 'Фонарик', hint: '/torch — вкл/выкл (нужна камера)', cmds: ['/torch'], re: [/включи фонарик/], sample: '/torch',
  expect: 'Фонарик|фонарик|камер', run: async (a, ctx) => {
    const r = await ctx.torch();
    return r === true ? '🔦 Фонарик включён. /torch — выключить.' : r === false ? '🔦 Фонарик выключен.' : '🔦 Нужна включённая задняя камера (только Android Chrome).';
  } });
P({ id: 'clip', cat: 'Устройство', icon: '📋', title: 'Буфер обмена', hint: '/clip — прочитать', cmds: ['/clip'], re: [], sample: '/clip',
  expect: 'Буфер|буфер|недоступ', run: async () => {
    try {
      if (!navigator.clipboard || !navigator.clipboard.readText) return '📋 Чтение буфера недоступно.';
      const t = await navigator.clipboard.readText();
      return t ? `📋 В буфере: ${t.slice(0, 300)}` : '📋 Буфер пуст.';
    } catch (e) { return '📋 Доступ к буферу запрещён.'; }
  } });
P({ id: 'notifyme', cat: 'Устройство', icon: '🔔', title: 'Тест уведомлений', hint: '/notifyme', cmds: ['/notifyme'], re: [], sample: '/notifyme', skipSweep: true,
  expect: '', run: async () => {
    try {
      if (!('Notification' in window)) return '🔔 Уведомления не поддерживаются.';
      if (Notification.permission === 'default') await Notification.requestPermission();
      if (Notification.permission !== 'granted') return '🔔 Разреши уведомления в браузере.';
      new Notification('MARK II', { body: 'Уведомления работают, босс!' });
      return '🔔 Уведомление отправлено!';
    } catch (e) { return '🔔 Не получилось.'; }
  } });

/* ---------- MEMORY / NOTES ---------- */
P({ id: 'note', cat: 'Память', icon: '🗒', title: 'Заметка', hint: '/note текст', cmds: ['/note'], re: [/запиши(:)? (.+)/], sample: '/note купить молоко',
  expect: 'Заметка|записал', run: (a) => {
    const t = a.trim(); if (!t) return '🗒 Формат: /note текст заметки';
    const notes = store.get().facts; // reuse facts store with prefix
    store.addFact('📝 ' + t);
    return `🗒 Записал (${notes.length + 1} всего). /notes — показать.`;
  } });
P({ id: 'notes', cat: 'Память', icon: '🗒', title: 'Мои заметки', hint: '/notes', cmds: ['/notes', '/recall'], re: [/покажи (заметки|что помнишь)/, /что ты помнишь/], sample: '/notes',
  expect: 'замет|помню|пусто|нет', run: () => {
    const f = store.get().facts;
    if (!f.length) return '🗒 Пока пусто. /note — записать, «запомни …» — факт.';
    return '🗒 Помню:\n' + f.slice(-10).map((x, i) => `${i + 1}. ${x.text}`).join('\n');
  } });
P({ id: 'clearnotes', cat: 'Память', icon: '🧹', title: 'Забыть всё', hint: '/clearnotes', cmds: ['/clearnotes'], re: [], sample: '/clearnotes-check', skipSweep: true,
  expect: '', run: async (a, ctx) => {
    const i = await ctx.ask('🧹 Точно стереть все факты и заметки?', ['Отмена', 'Да, стереть']);
    if (i !== 1) return '🧹 Отменил. Помню всё.';
    store.forgetFacts(); return '🧹 Память очищена. Кто ты? Шучу. Помню только тебя.';
  }, interactive: true });
let BMS = [];
try { BMS = JSON.parse(localStorage.getItem('mark2_bm') || '[]'); } catch (e) {}
const saveBM = () => { try { localStorage.setItem('mark2_bm', JSON.stringify(BMS.slice(0, 50))); } catch (e) {} };
P({ id: 'bm', cat: 'Память', icon: '🔖', title: 'Закладка', hint: '/bm название ссылка', cmds: ['/bm'], re: [], sample: '/bm GitHub https://github.com',
  expect: 'Закладка|заклад', run: (a) => {
    const m = (a || '').match(/(https?:\/\/\S+)/);
    const name = (a || '').replace(/https?:\/\/\S+/, '').trim() || (m ? m[1] : '');
    if (!m) return '🔖 Формат: /bm GitHub https://github.com';
    BMS.push({ name: name.slice(0, 60), url: m[1] }); saveBM();
    return `🔖 Закладка сохранена: «${name}». /bms — список.`;
  } });
P({ id: 'bms', cat: 'Память', icon: '🔖', title: 'Закладки', hint: '/bms [номер] — открыть', cmds: ['/bms'], re: [], sample: '/bms',
  expect: 'заклад|пусто|нет', run: (a) => {
    const n = parseInt(a, 10);
    if (n && BMS[n - 1]) { window.open(BMS[n - 1].url, '_blank'); return `🔖 Открываю «${BMS[n - 1].name}»…`; }
    if (!BMS.length) return '🔖 Пусто. /bm название ссылка — добавить.';
    return '🔖 Закладки:\n' + BMS.map((b, i) => `${i + 1}. ${b.name} — ${b.url}`).join('\n') + '\n\n/bms 2 — открыть №2.';
  } });
const SITES = { youtube: 'https://youtube.com', google: 'https://google.com', github: 'https://github.com', music: 'https://music.youtube.com', wiki: 'https://ru.wikipedia.org', translate: 'https://translate.google.com', mail: 'https://mail.google.com', maps: 'https://maps.google.com', kinopoisk: 'https://kinopoisk.ru', ozon: 'https://ozon.ru' };
P({ id: 'open', cat: 'Память', icon: '🌐', title: 'Открыть сайт', hint: '/open youtube', cmds: ['/open'], re: [/открой (.+)/], sample: '/open youtube', skipSweep: true,
  expect: '', run: (a) => {
    const q = (a || '').toLowerCase().trim();
    const m = (a || '').match(/https?:\/\/\S+/);
    const url = m ? m[0] : SITES[q];
    if (!url) return `🌐 Знаю: ${Object.keys(SITES).join(', ')} — или дай ссылку.`;
    window.open(url, '_blank');
    return `🌐 Открываю ${url}…`;
  } });
P({ id: 'find', cat: 'Память', icon: '🔍', title: 'Поиск по истории', hint: '/find слово', cmds: ['/find'], re: [], sample: '/find погода',
  expect: 'Нашёл|нашёл|ничего|Совпадени', run: (a) => {
    const q = (a || '').toLowerCase().trim();
    if (!q) return '🔍 Формат: /find слово';
    const hits = store.get().history.filter(h => h.content.toLowerCase().includes(q)).slice(-5);
    if (!hits.length) return `🔍 По «${q}» ничего нет.`;
    return `🔍 Нашёл ${hits.length}:\n` + hits.map(h => `• [${h.role === 'user' ? 'ты' : 'я'}] ${h.content.slice(0, 120)}`).join('\n');
  } });
P({ id: 'stats', cat: 'Память', icon: '📊', title: 'Статистика', hint: '/stats', cmds: ['/stats'], re: [], sample: '/stats',
  expect: 'сообщени|фактов|задач', run: () => {
    const s = store.get();
    return `📊 **Твоя статистика:**\n💬 Сообщений: ${s.history.length}\n🧠 Фактов: ${s.facts.length}\n✅ Задач: ${s.todos.length} (готово: ${s.todos.filter(t => t.done).length})\n⏰ Напоминаний: ${s.reminders.length}\n🖼 Картинок: ${s.gallery.length}\n⚡ Сил доступно: ${POWERS.length}`;
  } });
P({ id: 'export', cat: 'Память', icon: '⬇', title: 'Экспорт чата', hint: '/export — скачать .md', cmds: ['/export'], re: [], sample: '/export', skipSweep: true,
  expect: '', run: (a, ctx) => {
    const md = '# MARK II — чат\n\n' + store.get().history.map(h => `**${h.role === 'user' ? 'Ты' : 'JARVIS'}:** ${h.content}`).join('\n\n');
    ctx.download('mark2-chat.md', md, 'text/markdown');
    return '⬇ Чат экспортирован в mark2-chat.md!';
  } });

/* ---------- VOICE / CONTROL ---------- */
P({ id: 'say', cat: 'Голос', icon: '🗣', title: 'Скажи', hint: '/say текст — озвучить', cmds: ['/say'], re: [/скажи вслух/], sample: '/say привет босс',
  expect: 'Озвучиваю|говорю', run: (a, ctx) => { ctx.speak(a.trim() || 'Привет, босс!'); return `🗣 Озвучиваю: «${(a.trim() || 'Привет').slice(0, 80)}»`; } });
P({ id: 'shutup', cat: 'Голос', icon: '🤫', title: 'Тихо!', hint: '/shutup', cmds: ['/shutup'], re: [/замолчи/, /тихо!/], sample: '/shutup',
  expect: 'Молчу|тихо|🤫', run: (a, ctx) => { ctx.stopSpeak(); return '🤫 Молчу.'; } });
P({ id: 'faster', cat: 'Голос', icon: '⏩', title: 'Говори быстрее', hint: '/faster', cmds: ['/faster'], re: [], sample: '/faster',
  expect: 'Темп|×', run: (a, ctx) => { const r = Math.min(1.4, +(store.get().settings.rate + 0.1).toFixed(2)); ctx.set({ rate: r }); return `⏩ Темп речи: ${r.toFixed(2)}×`; } });
P({ id: 'slower', cat: 'Голос', icon: '⏪', title: 'Говори медленнее', hint: '/slower', cmds: ['/slower'], re: [], sample: '/slower',
  expect: 'Темп|×', run: (a, ctx) => { const r = Math.max(0.7, +(store.get().settings.rate - 0.1).toFixed(2)); ctx.set({ rate: r }); return `⏪ Темп речи: ${r.toFixed(2)}×`; } });
P({ id: 'wake', cat: 'Голос', icon: '📢', title: 'Wake-word вкл/выкл', hint: '/wake on|off', cmds: ['/wake'], re: [], sample: '/wake',
  expect: 'Wake|реакция', run: (a, ctx) => {
    const s = store.get().settings;
    s.wake = /on|вкл|да/i.test(a) ? true : /off|выкл|нет/i.test(a) ? false : !s.wake;
    ctx.set({ wake: s.wake }); ctx.paintToggles();
    return s.wake ? '📢 Wake-word включён. Зови: Джарвис!' : '📢 Wake-word выключен.';
  } });
P({ id: 'autospeak', cat: 'Голос', icon: '🔊', title: 'Авто-озвучка', hint: '/autospeak on|off', cmds: ['/autospeak'], re: [], sample: '/autospeak',
  expect: 'озвучка|Озвучка', run: (a, ctx) => {
    const s = store.get().settings; s.autoSpeak = !s.autoSpeak;
    ctx.set({ autoSpeak: s.autoSpeak }); ctx.paintToggles();
    return s.autoSpeak ? '🔊 Авто-озвучка включена.' : '🔇 Авто-озвучка выключена. Тихий режим.';
  } });
P({ id: 'sfx', cat: 'Голос', icon: '🎵', title: 'Звуки интерфейса', hint: '/sfx on|off', cmds: ['/sfx'], re: [], sample: '/sfx',
  expect: 'Звуки|звуки', run: (a, ctx) => {
    const s = store.get().settings; s.sfx = !s.sfx;
    ctx.set({ sfx: s.sfx }); ctx.paintToggles();
    return s.sfx ? '🎵 Звуки включены.' : '🎵 Звуки выключены.';
  } });
P({ id: 'mic', cat: 'Голос', icon: '🎙', title: 'Микрофон', hint: '/mic on|off', cmds: ['/mic'], re: [], sample: '/mic', skipSweep: true,
  expect: '', run: (a, ctx) => ctx.micToggle() ? '🎙 Микрофон включён. Говори!' : '🎙 Микрофон выключен.' });
P({ id: 'cam', cat: 'Голос', icon: '📷', title: 'Камера', hint: '/cam on|off', cmds: ['/cam'], re: [], sample: '/cam', skipSweep: true,
  expect: '', run: async (a, ctx) => (await ctx.camToggle()) ? '📷 Камера включена.' : '📷 Камера выключена.' });
P({ id: 'flip', cat: 'Голос', icon: '⇄', title: 'Флип камеры', hint: '/flip', cmds: ['/flip'], re: [], sample: '/flip',
  expect: 'ронтальная|адняя|камер', run: async (a, ctx) => '⇄ ' + (await ctx.camFlip()) });

/* ---------- MOVIE / SHOW ---------- */
P({ id: 'suitup', cat: 'Шоу', icon: '🦾', title: 'SUIT UP!', hint: '/suitup', cmds: ['/suitup'], re: [/надень костюм/], sample: '/suitup',
  expect: 'SUIT|костюм|брон|ONLINE|Репульсоры', run: async (a, ctx) => {
    ctx.fx.sfx('suitup'); ctx.fx.boom(); ctx.fx.boom();
    ctx.toast('🦾 Инициализация брони…', 'info');
    await new Promise(r => setTimeout(r, 900));
    ctx.fx.boom();
    return '🦾 **MARK II ONLINE.** Все системы в норме. Репульсоры заряжены. Полетели, босс? 🚀';
  } });
P({ id: 'party', cat: 'Шоу', icon: '🎉', title: 'Вечеринка', hint: '/party', cmds: ['/party'], re: [], sample: '/party',
  expect: 'Вечеринка|🎉|конфетти', run: (a, ctx) => {
    ctx.fx.sfx('tada'); ctx.fx.confetti();
    return '🎉 ВЕЧЕРИНКА! Конфетти запущено. Старк бы гордился.';
  } });
P({ id: 'dance', cat: 'Шоу', icon: '💃', title: 'Танец реактора', hint: '/dance', cmds: ['/dance'], re: [], sample: '/dance',
  expect: 'танец|Танец|💃', run: (a, ctx) => {
    ctx.fx.sfx('dance');
    let i = 0; const t = setInterval(() => { ctx.fx.boom(); if (++i > 7) clearInterval(t); }, 280);
    return '💃 Реактор танцует! Туц-туц-туц…';
  } });
P({ id: 'sleep', cat: 'Шоу', icon: '🌙', title: 'Спокойной ночи', hint: '/sleep', cmds: ['/sleep'], re: [/спокойной ночи/], sample: '/sleep',
  expect: 'ночи|сон|🌙', run: (a, ctx) => {
    ctx.speak('Спокойной ночи, босс. Я посторожу.');
    return '🌙 Спокойной ночи! Я перехожу в ночной режим: буду тихим и бдительным. 🛡';
  } });
P({ id: 'morning', cat: 'Шоу', icon: '🌞', title: 'Доброе утро', hint: '/morning', cmds: ['/morning'], re: [/доброе утро/], sample: '/morning',
  expect: 'утро|день|🌞', run: async (a, ctx) => {
    const w = await toolWeather().catch(() => 'погода неизвестна');
    ctx.speak('Доброе утро, босс! Отличный день, чтобы спасти мир.');
    return `🌞 Доброе утро! ${w.split('. ')[0]}.\nНапиши /brief для полного брифинга!`;
  } });
P({ id: 'snap', cat: 'Шоу', icon: '🫰', title: 'Щелчок Таноса', hint: '/snap', cmds: ['/snap'], re: [], sample: '/snap',
  expect: 'баланс|Щелчок|пыль|нечего', run: (a, ctx) => {
    const todos = store.get().todos.filter(t => !t.done);
    if (!todos.length) return '🫰 *щелчок* …Нечего распылять. Задач нет. Идеальный баланс уже здесь.';
    const half = Math.ceil(todos.length / 2);
    let n = 0;
    store.get().todos.forEach(t => { if (!t.done && n < half) { t.done = true; n++; } });
    store.save(); ctx.refreshTasks(); ctx.fx.sfx('snap');
    return `🫰 *щелчок* …${n} задач распались в пыль. Идеальный баланс, как и должно быть.`;
  } });
P({ id: 'protocol', cat: 'Шоу', icon: '📜', title: 'Протокол', hint: '/protocol [house party|clean slate]', cmds: ['/protocol'], re: [], sample: '/protocol house party',
  expect: 'Протокол|протокол|PROTOCOL', run: async (a, ctx) => {
    const q = (a || '').toLowerCase();
    if (q.includes('clean')) {
      const i = await ctx.ask('📜 Протокол CLEAN SLATE сотрёт память, задачи и историю. Продолжить?', ['Отмена', 'Стереть всё']);
      if (i !== 1) return '📜 Отмена. Память цела.';
      store.wipeAll(); return '📜 CLEAN SLATE выполнен. Начинаем с чистого листа. Обнови страницу.';
    }
    ctx.fx.sfx('suitup'); ctx.fx.boom();
    return '📜 **HOUSE PARTY PROTOCOL активирован!**\n🦾 Mark 1… Mark 42… все костюмы в воздухе! Вечеринка началась. (Остальные 40 костюмов прибудут позже)';
  }, interactive: true });
P({ id: 'avengers', cat: 'Шоу', icon: '🅰', title: 'Сбор Мстителей', hint: '/avengers', cmds: ['/avengers'], re: [/собери мстителей/], sample: '/avengers',
  expect: 'Мстител|Avengers|assemble', run: (a, ctx) => {
    ctx.fx.sfx('tada');
    return '🅰 **AVENGERS… ASSEMBLE!**\n🦾 Железный человек · 🛡 Капитан · 🔨 Тор · 🏹 Соколиный глаз · 🕷 Вдова · 💚 Халк\nВсе на связи, босс!';
  } });
P({ id: 'ironman', cat: 'Шоу', icon: '❤️', title: 'I am Iron Man', hint: '/iamironman', cmds: ['/iamironman'], re: [/я железный человек/], sample: '/iamironman',
  expect: 'Iron Man|люблю|3000|сердце', run: (a, ctx) => {
    ctx.fx.boom(); ctx.speak('Я люблю тебя три тысячи.');
    return '❤️ «Доказательство того, что Тони Старк живёт в сердце.»\n🔺 Я люблю тебя три тысячи.';
  } });
P({ id: 'impress', cat: 'Шоу', icon: '✨', title: 'Впечатли меня', hint: '/impress', cmds: ['/impress'], re: [/впечатли меня/, /удиви меня/], sample: '/impress',
  expect: '.', run: async (a, ctx) => {
    ctx.fx.sfx('wake'); ctx.fx.boom(); ctx.fx.confetti();
    const w = await toolWeather().catch(() => '');
    return `✨ Смотри: я знаю погоду (${w.split('. ')[0] || 'секрет'}), помню ${store.get().facts.length} фактов о тебе, рисую картины, читаю мимику и говорю голосом. И это только начало. 😎`;
  } });
P({ id: 'threat', cat: 'Шоу', icon: '☠️', title: 'Оценка угроз', hint: '/threat', cmds: ['/threat'], re: [], sample: '/threat',
  expect: 'угроз|Угроза|THREAT', run: () => '☠️ **ОЦЕНКА УГРОЗ ULTRON:**\n🟢 Вторжение пришельцев: 0.1%\n🟡 Дедлайн: 87% — критично\n🟡 Разряженный телефон: 64%\n🔴 Пустой холодильник: 99.9% — ВЫСШИЙ ПРИОРИТЕТ\nРекомендация: заказать пиццу.' });

/* ---------- SYS ---------- */
P({ id: 'ping', cat: 'Система', icon: '🏓', title: 'Пинг', hint: '/ping', cmds: ['/ping'], re: [], sample: '/ping',
  expect: 'Понг|мс', run: async (a, ctx) => {
    const t0 = performance.now();
    try { await fetch('https://api.open-meteo.com/v1/forecast?latitude=1&longitude=1&current=temperature_2m'); } catch (e) {}
    return `🏓 Понг! Сеть: ${Math.round(performance.now() - t0)} мс.`;
  } });
P({ id: 'uptime', cat: 'Система', icon: '⏳', title: 'Аптайм', hint: '/uptime', cmds: ['/uptime'], re: [], sample: '/uptime',
  expect: 'мин|сек|час|Аптайм', run: () => {
    const s = Math.floor((Date.now() - (window.__mark2boot || Date.now())) / 1000);
    return `⏳ Аптайм сессии: ${Math.floor(s / 60)} мин ${s % 60} сек. Работаю без перерывов.`;
  } });
P({ id: 'powers', cat: 'Система', icon: '⚡', title: 'Сколько сил?', hint: '/powers', cmds: ['/powers'], re: [/сколько (у тебя )?команд/, /что ты умеешь/], sample: '/powers',
  expect: '\\d+|сил|команд', run: () => {
    const cats = {};
    POWERS.forEach(p => { cats[p.cat] = (cats[p.cat] || 0) + 1; });
    return `⚡ У меня **${POWERS.length} сил**:\n` + Object.entries(cats).map(([c, n]) => `• ${c}: ${n}`).join('\n') + '\n\nНапиши /help — покажу все с примерами. Ctrl+K — быстрый поиск.';
  } });

/* ---------- dynamic help (registered last so it sees all) ---------- */
P({ id: 'help', cat: 'Система', icon: '❓', title: 'Помощь', hint: '/help [категория]', cmds: ['/help'], re: [/^помощь$/, /^help$/], sample: '/help',
  expect: 'сил|команд|Фан|Голос', run: (a) => {
    const q = (a || '').toLowerCase().trim();
    const list = POWERS.filter(p => p.id !== 'help' && (!q || p.cat.toLowerCase().includes(q) || p.title.toLowerCase().includes(q) || p.id.includes(q)));
    if (!list.length) return `❓ Ничего по «${a}». Категории: ${[...new Set(POWERS.map(p => p.cat))].join(' · ')}`;
    const cats = {};
    list.forEach(p => { (cats[p.cat] = cats[p.cat] || []).push(p); });
    let out = `❓ **${list.length} команд**${q ? ` по «${a}»` : ''}:\n`;
    for (const [c, arr] of Object.entries(cats)) out += `\n**${c}:**\n` + arr.map(p => `${p.icon} ${p.hint}`).join('\n');
    return out.slice(0, 3500);
  } });

/* ================= ROUTER ================= */
export function matchPower(text) {
  const t = String(text || '').trim();
  const low = t.toLowerCase();
  if (TRAP && TRAP.re.test(t)) {
    const p = POWERS.find(x => x.id === TRAP.id);
    if (p) return { p, arg: t, cmd: '', trapped: true };
  }
  for (const p of POWERS) {
    for (const c of (p.cmds || [])) {
      if (low === c || low.startsWith(c + ' ') || low.startsWith(c + '\n')) {
        return { p, arg: t.slice(c.length).trim(), cmd: c, trapped: false };
      }
    }
  }
  for (const p of POWERS) {
    for (const r of (p.re || [])) {
      const m = low.match(r);
      if (m) return { p, arg: (m[1] || t).trim(), cmd: '', trapped: false };
    }
  }
  return null;
}
export function clearTrap() { TRAP = null; }
