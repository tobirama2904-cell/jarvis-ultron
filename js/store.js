/* MARK II — persistent store: settings, memory, tasks. Key stored separately. */
const SKEY = 'mark2_state', KKEY = 'mark2_key';

const DEFAULTS = () => ({
  v: 1,
  settings: { persona: 'jarvis', voiceURI: '', rate: 1.0, wake: true,
    autoSpeak: true, sfx: true, confirmBeforeSend: false, autoSubmit: true }, /*__V18_STORE__*/
  facts: [],                                  // {text, ts}
  todos: [],                                  // {text, done, ts}
  reminders: [],                              // {id, text, at, fired}
  history: [],                                // {role, content, ts}
  gallery: [],                                // {url, prompt, ts}
  seenBoot: false,
});

let state = DEFAULTS();
try {
  const raw = localStorage.getItem(SKEY);
  if (raw) state = Object.assign(DEFAULTS(), JSON.parse(raw));
} catch (e) { /* fresh start */ }

const listeners = new Set();
export function onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }
function emit() { listeners.forEach(fn => { try { fn(state); } catch (e) {} }); }

export function save() {
  try { localStorage.setItem(SKEY, JSON.stringify(state)); } catch (e) {}
  emit();
}
export function get() { return state; }

/* ---- API key (kept out of exported state) ---- */
export function getKey() { try { return localStorage.getItem(KKEY) || ''; } catch (e) { return ''; } }
export function setKey(k) { try { k ? localStorage.setItem(KKEY, k) : localStorage.removeItem(KKEY); } catch (e) {} emit(); }
export function hasKey() { return !!getKey(); }

/* ---- memory ---- */
export function addFact(text) {
  text = String(text || '').trim().slice(0, 300);
  if (!text) return false;
  if (state.facts.some(f => f.text.toLowerCase() === text.toLowerCase())) return false;
  state.facts.push({ text, ts: Date.now() });
  if (state.facts.length > 200) state.facts = state.facts.slice(-200);
  save(); return true;
}
export function forgetFacts() { state.facts = []; save(); }

/* ---- todos ---- */
export function addTodo(text) {
  text = String(text || '').trim().slice(0, 200);
  if (!text) return null;
  const t = { text, done: false, ts: Date.now() };
  state.todos.push(t); save(); return t;
}
export function toggleTodo(i) { const t = state.todos[i]; if (t) { t.done = !t.done; save(); } }
export function clearTodos(doneOnly) {
  state.todos = doneOnly ? state.todos.filter(t => !t.done) : []; save();
}

/* ---- reminders ---- */
export function addReminder(text, at) {
  const r = { id: 'r' + Date.now().toString(36), text: String(text || '').slice(0, 200), at, fired: false };
  state.reminders.push(r); save(); return r;
}
export function fireReminder(id) {
  const r = state.reminders.find(x => x.id === id);
  if (r) { r.fired = true; save(); }
}
export function dropReminder(id) { state.reminders = state.reminders.filter(x => x.id !== id); save(); }
export function dueReminders() {
  const now = Date.now();
  return state.reminders.filter(r => !r.fired && r.at <= now);
}

/* ---- chat history ---- */
export function pushHistory(role, content) {
  state.history.push({ role, content: String(content || '').slice(0, 4000), ts: Date.now() });
  if (state.history.length > 60) state.history = state.history.slice(-60);
  save();
}
export function clearHistory() { state.history = []; save(); }

/* ---- gallery ---- */
export function addImage(url, prompt) {
  state.gallery.unshift({ url, prompt: String(prompt || '').slice(0, 300), ts: Date.now() });
  if (state.gallery.length > 24) state.gallery.length = 24;
  save();
}

/* ---- export / wipe ---- */
export function exportJSON() {
  return JSON.stringify({ exported: new Date().toISOString(), facts: state.facts,
    todos: state.todos, reminders: state.reminders, history: state.history }, null, 2);
}
export function wipeAll() { state = DEFAULTS(); save(); }
