/* V18 — file intelligence: images / video frames / PDF / text / audio. All local + Agnes. */
import { visionChat, quickChat } from './api.js';
import { addFile } from './memory.js';

let pdfLib = null;
async function pdfjs() {
  if (pdfLib) return pdfLib;
  pdfLib = await import('https://cdn.jsdelivr.net/npm/pdfjs-dist@4.4.168/build/pdf.min.mjs');
  pdfLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.4.168/build/pdf.worker.min.mjs';
  return pdfLib;
}

export function kindOf(file) {
  const t = (file.type || '').toLowerCase(), n = (file.name || '').toLowerCase();
  if (t.startsWith('image/')) return 'image';
  if (t.startsWith('video/')) return 'video';
  if (t.startsWith('audio/')) return 'audio';
  if (t === 'application/pdf' || n.endsWith('.pdf')) return 'pdf';
  if (t.startsWith('text/') || /\.(txt|md|json|csv|js|py|html|css|log|srt)$/.test(n)) return 'text';
  return 'other';
}
const readAs = (f, mode) => new Promise((res, rej) => {
  const r = new FileReader();
  r.onload = () => res(r.result); r.onerror = rej;
  mode === 'buf' ? r.readAsArrayBuffer(f) : mode === 'url' ? r.readAsDataURL(f) : r.readAsText(f);
});
function thumb(dataUrl, maxW = 480) {
  return new Promise(res => {
    const im = new Image();
    im.onload = () => {
      const k = Math.min(1, maxW / im.width);
      const c = document.createElement('canvas');
      c.width = Math.round(im.width * k); c.height = Math.round(im.height * k);
      c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
      res(c.toDataURL('image/jpeg', 0.82));
    };
    im.onerror = () => res(dataUrl);
    im.src = dataUrl;
  });
}

/* ---- images: deep analysis ---- */
export async function analyzeImage(file, key, question) {
  const url = await readAs(file, 'url');
  const small = await thumb(url);
  const prompt = question
    ? `Ответь по-русски на вопрос по этому изображению: ${question}`
    : 'Разбери это изображение по-русски структурированно: 1) Что на нём (объекты, люди, текст) 2) Текст на изображении (если есть, дословно) 3) Настроение/стиль 4) Заметные детали и дефекты. Компактно.';
  const d = await visionChat({ key, images: [small], prompt, maxTokens: 700 });
  addFile({ name: file.name, kind: 'image', summary: d.slice(0, 300) });
  return { image: url, text: '🖼 **Разбор изображения**\n\n' + d.trim() };
}

/* ---- video: sample frames -> action analysis ---- */
export async function analyzeVideo(file, key, question, onStep) {
  const url = URL.createObjectURL(file);
  const v = document.createElement('video');
  v.muted = true; v.preload = 'auto'; v.src = url;
  await new Promise((res, rej) => { v.onloadedmetadata = res; v.onerror = rej; });
  const dur = v.duration || 0, N = dur > 60 ? 8 : 6;
  const frames = [];
  const c = document.createElement('canvas');
  for (let i = 0; i < N; i++) {
    const t = dur ? (dur * (i + 0.5)) / N : 0;
    await new Promise(res => {
      const to = setTimeout(res, 2500);
      v.onseeked = () => { clearTimeout(to); res(); };
      try { v.currentTime = Math.min(t, Math.max(0, dur - 0.1)); } catch (e) { res(); }
    });
    if (onStep) onStep(i + 1, N);
    c.width = 480; c.height = Math.round(480 * (v.videoHeight / Math.max(1, v.videoWidth))) || 270;
    c.getContext('2d').drawImage(v, 0, 0, c.width, c.height);
    frames.push(c.toDataURL('image/jpeg', 0.75));
  }
  URL.revokeObjectURL(url);
  const prompt = question
    ? `Это ${N} кадров из видео (${dur.toFixed(1)} сек). Ответь по-русски: ${question}`
    : `Это ${N} кадров из видео (${dur.toFixed(1)} сек), идут по порядку. Опиши по-русски: что происходит, кто/что в кадре, действие и его развитие, обстановка. Компактно, живо.`;
  const d = await visionChat({ key, images: frames, prompt, maxTokens: 800 });
  addFile({ name: file.name, kind: 'video', summary: d.slice(0, 300) });
  return { images: frames, text: `🎬 **Разбор видео** (${dur.toFixed(0)} сек, ${N} кадров)\n\n` + d.trim() };
}

/* ---- PDF ---- */
export async function analyzePdf(file, key, question) {
  const lib = await pdfjs();
  const buf = await readAs(file, 'buf');
  const pdf = await lib.getDocument({ data: buf }).promise;
  let text = '';
  const maxP = Math.min(pdf.numPages, 30);
  for (let i = 1; i <= maxP; i++) {
    const pg = await pdf.getPage(i);
    const tc = await pg.getTextContent();
    text += tc.items.map(it => it.str).join(' ') + '\n';
    if (text.length > 12000) break;
  }
  text = text.slice(0, 12000) || '(текста не нашёл — возможно скан)';
  addFile({ name: file.name, kind: 'pdf', summary: text.slice(0, 300) });
  if (question && key) {
    const a = await quickChat({ key, maxTokens: 600, messages: [
      { role: 'system', content: 'Отвечай по-русски строго по тексту документа. Если ответа нет — так и скажи.' },
      { role: 'user', content: `Документ:\n${text}\n\nВопрос: ${question}` } ] });
    return { text: `📄 **${file.name}** (${pdf.numPages} стр.)\n\n**Ответ:** ${a.trim()}` };
  }
  const brief = text.length > 600 && key
    ? await quickChat({ key, maxTokens: 400, messages: [
      { role: 'system', content: 'Выжми суть документа по-русски: 5-7 буллетов + вывод. Компактно.' },
      { role: 'user', content: text.slice(0, 8000) } ] }).catch(() => '') : '';
  return { text: `📄 **${file.name}** (${pdf.numPages} стр.)\n\n${brief ? brief.trim() + '\n\n' : ''}Первые строки:\n${text.slice(0, 900)}${text.length > 900 ? '…' : ''}` };
}

/* ---- text / code / csv ---- */
export async function analyzeText(file, key, question) {
  const text = String(await readAs(file, 'text')).slice(0, 15000);
  addFile({ name: file.name, kind: 'text', summary: text.slice(0, 300) });
  const isCsv = /\.csv$/i.test(file.name);
  let extra = '';
  if (isCsv) {
    const rows = text.split('\n').filter(Boolean);
    extra = `\n(Строк: ${rows.length}, колонок: ${(rows[0] || '').split(/[,;]/).length})`;
  }
  if (!key) return { text: `📝 **${file.name}**${extra}\n\n${text.slice(0, 1500)}${text.length > 1500 ? '…' : ''}\n\nБез ключа показываю как есть.` };
  const a = await quickChat({ key, maxTokens: 600, messages: [
    { role: 'system', content: question ? 'Ответь по-русски на вопрос по файлу. Точно, по делу.' : 'Разбери файл по-русски: что это, структура, главное содержимое, заметки. Компактно.' },
    { role: 'user', content: `Файл ${file.name}:\n${text.slice(0, 9000)}${question ? '\n\nВопрос: ' + question : ''}` } ] });
  return { text: `📝 **${file.name}**${extra}\n\n` + a.trim() };
}

/* ---- audio: metadata + waveform (no free transcription API) ---- */
export async function analyzeAudio(file) {
  const buf = await readAs(file, 'buf');
  let dur = 0, wave = '';
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    const ac = new AC();
    const ab = await ac.decodeAudioData(buf.slice(0));
    dur = ab.duration;
    const ch = ab.getChannelData(0), N = 48, bars = [];
    for (let i = 0; i < N; i++) {
      const s = Math.floor((i / N) * ch.length), e = Math.floor(((i + 1) / N) * ch.length);
      let m = 0;
      for (let j = s; j < e; j += 97) m = Math.max(m, Math.abs(ch[j] || 0));
      bars.push('▁▂▃▄▅▆▇█'[Math.min(7, Math.round(m * 9))]);
    }
    wave = bars.join('');
    ac.close().catch(() => {});
  } catch (e) {}
  addFile({ name: file.name, kind: 'audio', summary: `${dur.toFixed(0)} сек` });
  return { text: `🎵 **${file.name}**\nДлительность: ${dur ? dur.toFixed(1) + ' сек' : '—'} · Размер: ${(file.size / 1024).toFixed(0)} КБ\n\`${wave || 'волну не построил'}\`\n\nРаспознавание речи из файлов требует сервера — пока так. Хочешь — прослушай и перескажи мне, я запомню.` };
}
