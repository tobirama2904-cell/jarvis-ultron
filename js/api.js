/* MARK II — Agnes AI client: throttled queue, retries, streaming, tool-loop, images. */
import { AGNES } from './config.js';

export class KeyError extends Error { constructor() { super('NO_KEY'); } }
export class ApiError extends Error {
  constructor(msg, status) { super(msg); this.status = status || 0; }
}

const sleep = ms => new Promise(r => setTimeout(r, ms));
let lastCall = 0, chain = Promise.resolve();
export function lastLatency() { return _lastLatency; }
/*__V18_API__*/
/* RPM meter: rolling 60s window of Agnes calls. */
const _rpm = [];
function rpmTick() { const n = Date.now(); _rpm.push(n); while (_rpm.length && n - _rpm[0] > 60000) _rpm.shift(); }
export function rpmInfo() { const n = Date.now(); while (_rpm.length && n - _rpm[0] > 60000) _rpm.shift(); return { used: _rpm.length, limit: 20 }; }
let _lastLatency = 0;

/* Serialize all Agnes calls with min gap (free-tier RPM guard). */
function enqueue(fn) {
  const run = chain.then(fn, fn);
  chain = run.catch(() => {});
  return run;
}
async function throttle() {
  const wait = AGNES.minGapMs - (Date.now() - lastCall);
  if (wait > 0) await sleep(wait);
  lastCall = Date.now();
}

async function rawFetch(path, key, body, { stream, onToken, signal } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), AGNES.timeoutMs);
  const sig = signal
    ? (() => { const c = new AbortController();
        const f = () => c.abort(); signal.addEventListener('abort', f, { once: true });
        ctrl.signal.addEventListener('abort', () => { c.abort(); signal.removeEventListener('abort', f); });
        return c.signal; })()
    : ctrl.signal;
  const t0 = performance.now();
  try {
    const res = await fetch(AGNES.base + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
      body: JSON.stringify(body), signal: sig,
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => '').then(t => t.slice(0, 300));
      throw new ApiError(`HTTP ${res.status} ${txt}`, res.status);
    }
    if (!stream) { _lastLatency = Math.round(performance.now() - t0); return await res.json(); }
    // SSE stream
    const reader = res.body.getReader(), dec = new TextDecoder();
    let buf = '', full = '', toolCalls = null;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split('\n'); buf = lines.pop();
      for (const ln of lines) {
        const l = ln.trim();
        if (!l.startsWith('data:')) continue;
        const payload = l.slice(5).trim();
        if (!payload || payload === '[DONE]') continue;
        try {
          const j = JSON.parse(payload);
          const d = j.choices && j.choices[0] && j.choices[0].delta;
          if (!d) continue;
          if (d.tool_calls) toolCalls = (toolCalls || []).concat(d.tool_calls);
          if (d.content) { full += d.content; if (onToken) onToken(d.content); }
        } catch (e) { /* partial chunk */ }
      }
    }
    _lastLatency = Math.round(performance.now() - t0);
    return { text: full, toolCalls };
  } finally { clearTimeout(timer); }
}

async function callWithRetry(path, key, body, opts = {}) {
  let err = null;
  for (let i = 0; i <= AGNES.maxRetries; i++) {
    await throttle();
    try { return await rawFetch(path, key, body, opts); }
    catch (e) {
      err = e;
      const retryable = e.name === 'AbortError' || (e instanceof ApiError && (e.status === 429 || e.status >= 500));
      if (!retryable || i === AGNES.maxRetries) break;
      await sleep(1500 * (i + 1) + Math.random() * 800);
    }
  }
  throw err;
}

function normToolCalls(tc) {
  if (!tc) return [];
  const byIdx = {};
  tc.forEach(c => {
    const i = c.index != null ? c.index : 0;
    byIdx[i] = byIdx[i] || { id: '', name: '', args: '' };
    if (c.id) byIdx[i].id = c.id;
    if (c.function) {
      if (c.function.name) byIdx[i].name = c.function.name;
      if (c.function.arguments) byIdx[i].args += c.function.arguments;
    }
  });
  return Object.values(byIdx).filter(t => t.name);
}

/* Chat with tool loop: pass 1 (tools, no stream) -> execute -> pass 2 (stream final).
   runTool(name, args) -> string. onTool(name, args, phase) for UI. */
export function chatComplete({ key, messages, tools, stream = true, onToken, onTool, signal }) {
  if (!key) return Promise.reject(new KeyError());
  rpmTick();
  return enqueue(async () => {
    const msgs = messages.slice();
    const runTool = chatComplete.runTool || (async () => 'tool unavailable');
    for (let iter = 0; iter < 3; iter++) {
      const body = { model: AGNES.chat, messages: msgs, temperature: 0.7, max_tokens: 1200 };
      if (tools && tools.length && iter < 2) { body.tools = tools; body.tool_choice = 'auto'; }
      const wantStream = stream && (!tools || !tools.length || iter > 0);
      if (wantStream) {
        const r = await callWithRetry('/chat/completions', key, { ...body, stream: true }, { stream: true, onToken, signal });
        const calls = normToolCalls(r.toolCalls);
        if (!calls.length) return { text: r.text || '', toolRuns: [] };
        msgs.push({ role: 'assistant', content: r.text || null, tool_calls: calls.map((c, i) => ({ id: c.id || ('t' + i), type: 'function', function: { name: c.name, arguments: c.args } })) });
        for (const c of calls) {
          let args = {}; try { args = JSON.parse(c.args || '{}'); } catch (e) {}
          if (onTool) onTool(c.name, args, 'run');
          let out = ''; try { out = await runTool(c.name, args); } catch (e) { out = 'Ошибка инструмента: ' + e.message; }
          if (onTool) onTool(c.name, args, 'done');
          msgs.push({ role: 'tool', tool_call_id: c.id || ('t' + calls.indexOf(c)), content: String(out).slice(0, 3000) });
        }
        continue; // final text next iteration (streamed)
      }
      const j = await callWithRetry('/chat/completions', key, body, { signal });
      const msg = j.choices && j.choices[0] && j.choices[0].message;
      if (!msg) return { text: '', toolRuns: [] };
      const calls = (msg.tool_calls || []).map(c => ({ id: c.id, name: c.function.name, args: c.function.arguments }));
      if (!calls.length) return { text: msg.content || '', toolRuns: [] };
      msgs.push({ role: 'assistant', content: msg.content || null,
        tool_calls: calls.map(c => ({ id: c.id, type: 'function', function: { name: c.name, arguments: c.args } })) });
      for (const c of calls) {
        let args = {}; try { args = JSON.parse(c.args || '{}'); } catch (e) {}
        if (onTool) onTool(c.name, args, 'run');
        let out = ''; try { out = await runTool(c.name, args); } catch (e) { out = 'Ошибка инструмента: ' + e.message; }
        if (onTool) onTool(c.name, args, 'done');
        msgs.push({ role: 'tool', tool_call_id: c.id, content: String(out).slice(0, 3000) });
      }
    }
    return { text: '', toolRuns: [] };
  });
}

/* One-shot small chat (no tools). Used for council/translate/compose. */
export function quickChat({ key, messages, maxTokens = 500, temperature = 0.7, signal }) {
  if (!key) return Promise.reject(new KeyError());
  rpmTick();
  const once = (msgs, mt) => enqueue(() => callWithRetry('/chat/completions', key,
    { model: AGNES.chat, messages: msgs, temperature, max_tokens: mt }, { signal })
    .then(j => (j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || ''));
  return once(messages, maxTokens).then(t => {
    if (t && t.trim()) return t;
    // model burned tokens on reasoning_content -> nudge it to answer directly
    const nudge = messages.concat([{ role: 'system', content: 'Важно: дай ТОЛЬКО финальный ответ, без рассуждений, сразу по делу.' }]);
    return once(nudge, Math.min(1200, maxTokens * 2));
  });
}

/* Image generation with model fallbacks. Returns {url}. */
export function genImage({ key, prompt, size = '1024x1024' }) {
  if (!key) return Promise.reject(new KeyError());
  rpmTick();
  return enqueue(async () => {
    let lastErr = null;
    for (const model of AGNES.imgModels) {
      try {
        const j = await callWithRetry('/images/generations', key,
          { model, prompt, size, n: 1 }, {});
        const d = j.data && j.data[0];
        const url = d && (d.url || (d.b64_json ? 'data:image/png;base64,' + d.b64_json : ''));
        if (url) return { url, model };
        lastErr = new ApiError('empty image response', 0);
      } catch (e) { lastErr = e; }
    }
    throw lastErr || new ApiError('image failed', 0);
  });
}

/* Vision: chat with an image (camera snapshots). Model takes text+image input. */
export function visionChat({ key, prompt, imageDataUrl, images, maxTokens = 600 }) {
  if (!key) return Promise.reject(new KeyError());
  rpmTick();
  const _imgs = (images && images.length ? images : (imageDataUrl ? [imageDataUrl] : [])).slice(0, 8);
  return enqueue(() => callWithRetry('/chat/completions', key, {
    model: AGNES.chat,
    messages: [{ role: 'user', content: [
      { type: 'text', text: prompt },
      ..._imgs.map(u => ({ type: 'image_url', image_url: { url: u } })) ] }],
    max_tokens: maxTokens, temperature: 0.5,
  }, {}).then(j => (j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || ''));
}

/* Ping: GET models (cheap capability check). */
export function ping(key) {
  if (!key) return Promise.reject(new KeyError());
  rpmTick();
  return enqueue(async () => {
    await throttle();
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 15000);
    const t0 = performance.now();
    try {
      const res = await fetch(AGNES.base + '/models', {
        headers: { 'Authorization': 'Bearer ' + key }, signal: ctrl.signal });
      _lastLatency = Math.round(performance.now() - t0);
      if (!res.ok) throw new ApiError('HTTP ' + res.status, res.status);
      const j = await res.json().catch(() => ({}));
      const arr = j.data || j.models || [];
      return { ok: true, models: arr.map(m => m.id || m).slice(0, 20), ms: _lastLatency };
    } finally { clearTimeout(t); }
  });
}

export function friendlyError(e) {
  if (e instanceof KeyError) return 'Нет API-ключа. Открой ⚙️ Настройки и вставь ключ Agnes AI — без него нейросеть недоступна, но часы, калькулятор, погода и напоминания работают.';
  if (e && e.name === 'AbortError') return 'Превышено время ожидания ответа. Попробуй ещё раз.';
  if (e instanceof ApiError) {
    if (e.status === 401 || e.status === 403) return 'Ключ отклонён сервером (401/403). Проверь ключ в ⚙️ Настройках.';
    if (e.status === 429) return 'Превышен лимит запросов. Подожди ~30 секунд и повтори.';
    if (e.status >= 500) return 'Сервер Agnes перегружен. Повтори через минуту.';
    return 'Ошибка сети: ' + (e.message || e.status || 'unknown');
  }
  return 'Ошибка: ' + ((e && e.message) || e);
}
