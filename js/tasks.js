/* V18 — Legion: RPM-safe task runner (concurrency 1) with live progress feed. */
const queue = [];
const done = [];
let running = null;
let seq = 0;
const listeners = new Set();

export function onTasks(fn) { listeners.add(fn); return () => listeners.delete(fn); }
function emit(t) { listeners.forEach(fn => { try { fn(t, snapshot()); } catch (e) {} }); }

export function snapshot() {
  return { running: running ? { ...running, fn: undefined } : null,
    queued: queue.map(t => ({ id: t.id, title: t.title })),
    done: done.slice(-12).map(t => ({ id: t.id, title: t.title, state: t.state, ts: t.ts })) };
}
export function getTask(id) {
  return (running && running.id === id && running) || queue.find(t => t.id === id) || done.find(t => t.id === id) || null;
}
export function pendingCount() { return queue.length + (running ? 1 : 0); }

/* spawn(title, fn): fn(rep) may call rep(pct, label). Returns promise of fn's result. */
export function spawn(title, fn) {
  const t = { id: 'L' + (++seq) + Date.now().toString(36), title: String(title || 'Задача').slice(0, 90),
    state: 'queued', pct: 0, label: 'в очереди…', log: [], ts: Date.now(), fn,
    resolve: null, reject: null };
  t.promise = new Promise((res, rej) => { t.resolve = res; t.reject = rej; });
  queue.push(t); emit(t); pump();
  return t.promise;
}
async function pump() {
  if (running || !queue.length) return;
  running = queue.shift();
  running.state = 'run'; emit(running);
  const rep = (pct, label) => {
    running.pct = Math.max(0, Math.min(100, +pct || 0));
    if (label) { running.label = String(label).slice(0, 120); running.log.push(`[${running.pct}%] ${running.label}`); }
    emit(running);
  };
  try {
    const out = await running.fn(rep);
    running.state = 'done'; running.pct = 100; running.label = 'готово';
    running.result = out;
    done.unshift(running);
    if (done.length > 20) done.length = 20;
    emit(running);
    running.resolve(out);
  } catch (e) {
    running.state = 'err';
    running.label = 'ошибка';
    running.log.push('✖ ' + ((e && e.message) || e));
    done.unshift(running);
    if (done.length > 20) done.length = 20;
    emit(running);
    running.reject(e);
  }
  running = null;
  pump();
}

/* ---------- missions feed render ---------- */
const escH = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export function renderMissions(box) {
  box = typeof box === 'string' ? document.querySelector(box) : box;
  if (!box) return;
  const items = [...(running ? [running] : []), ...queue, ...done.slice(0, 8)];
  if (!items.length) {
    box.innerHTML = '<div class="empty">Легион ждёт приказов. Задачи выполняются по очереди с живым прогрессом.</div>';
    return;
  }
  box.innerHTML = items.map(t => {
    const cls = t.state === 'run' ? 'run' : t.state === 'done' ? 'done' : t.state === 'err' ? 'err' : '';
    const st = t.state === 'run' ? '◌ ВЫПОЛНЯЮ' : t.state === 'done' ? '✓ ГОТОВО' : t.state === 'err' ? '✖ ОШИБКА' : '… В ОЧЕРЕДИ';
    const log = (t.log || []).slice(-6).map(escH).join('\n');
    return `<div class="msn ${cls}"><div class="msn-head"><span>${escH(t.title)}</span><span class="st">${st}</span></div>
      <div class="msn-bar"><div class="msn-fill" style="width:${t.pct || 0}%"></div></div>
      <div class="msn-log">${escH(t.label || '')}${log ? '\n' + log : ''}</div></div>`;
  }).join('');
}
