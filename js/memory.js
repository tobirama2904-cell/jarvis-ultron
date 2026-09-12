/* V18 — memory v2: local profiles + facts/prefs/projects/episodes/files. Local-first, free forever. */
import { quickChat } from './api.js';

const MKEY = 'mark2_mem2';
const blankProfile = (id, name, icon) => ({ id, name: name || id, icon: icon || '👤',
  facts: [], prefs: {}, projects: [], episodes: [], files: [] });
let mem = null;

function save() { try { localStorage.setItem(MKEY, JSON.stringify(mem)); } catch (e) {} }
function load() {
  try { mem = JSON.parse(localStorage.getItem(MKEY)) || null; } catch (e) { mem = null; }
  if (!mem || !mem.profiles || !mem.profiles[mem.active]) {
    mem = { active: 'boss', profiles: { boss: blankProfile('boss', 'Босс', '👑') } };
  }
  // normalize old shape {default: {...}} -> named profiles
  for (const [id, p] of Object.entries(mem.profiles)) {
    if (!p.id) p.id = id;
    if (!p.name) p.name = id === 'default' ? 'Босс' : id;
    if (!p.icon) p.icon = '👤';
    for (const k of ['facts', 'projects', 'episodes', 'files']) if (!Array.isArray(p[k])) p[k] = [];
    if (!p.prefs || typeof p.prefs !== 'object') p.prefs = {};
  }
  if (mem.active === 'default' && mem.profiles.boss) mem.active = 'boss';
  try {
    const s = JSON.parse(localStorage.getItem('mark2_state') || '{}');
    if (s.facts && s.facts.length && !mem.migrated) {
      mem.profiles[mem.active].facts = s.facts.map(f => ({ text: f.text, ts: f.ts }));
      mem.migrated = 1; save();
    }
  } catch (e) {}
  return mem;
}
load();

/* ---------- profiles ---------- */
export const P = () => mem.profiles[mem.active];
export const profiles = () => Object.keys(mem.profiles);
export const listProfiles = () => Object.values(mem.profiles);
export const activeProfile = () => P();
export function createProfile(name, icon) {
  name = String(name || '').trim().slice(0, 24) || 'Профиль';
  const id = 'p' + Date.now().toString(36);
  mem.profiles[id] = blankProfile(id, name, icon);
  save(); return id;
}
export function switchProfile(id) {
  if (!mem.profiles[id]) return false;
  mem.active = id; save(); return true;
}
export function updateProfile(id, patch) {
  const p = mem.profiles[id]; if (!p) return false;
  Object.assign(p, patch || {}); save(); return true;
}

/* ---------- adders ---------- */
export function addFact(text) {
  text = String(text || '').trim().slice(0, 300);
  if (!text || P().facts.some(f => f.text.toLowerCase() === text.toLowerCase())) return false;
  P().facts.push({ text, ts: Date.now() });
  if (P().facts.length > 300) P().facts = P().facts.slice(-300);
  save(); return true;
}
export function addPref(k, v) { P().prefs[String(k).slice(0, 40)] = String(v).slice(0, 140); save(); }
export function addProject(name, note) {
  name = String(name || '').trim().slice(0, 80); if (!name) return null;
  const pr = { name, note: String(note || '').slice(0, 300), ts: Date.now() };
  P().projects.push(pr); if (P().projects.length > 60) P().projects = P().projects.slice(-60);
  save(); return pr;
}
export function addEpisode(text) {
  text = String(text || '').trim().slice(0, 400); if (!text) return;
  P().episodes.push({ text, ts: Date.now() });
  if (P().episodes.length > 120) P().episodes = P().episodes.slice(-120);
  save();
}
export function addFile(meta) {
  P().files.unshift({ ...meta, ts: Date.now() });
  if (P().files.length > 60) P().files.length = 60;
  save();
}
export function forgetAll() { const p = P(); mem.profiles[p.id] = blankProfile(p.id, p.name, p.icon); save(); }

/* ---------- recall ---------- */
export function recall(query, limit = 8) {
  const words = String(query || '').toLowerCase().split(/[^a-zа-яё0-9]+/i).filter(w => w.length > 2);
  const pool = [];
  P().facts.forEach(f => pool.push({ t: '• ' + f.text, s: 1 }));
  Object.entries(P().prefs).forEach(([k, v]) => pool.push({ t: `• Вкус: ${k} = ${v}`, s: 2 }));
  P().projects.forEach(p => pool.push({ t: `• Проект «${p.name}»: ${p.note}`, s: 2 }));
  P().episodes.slice(-20).forEach(e => pool.push({ t: '• Было: ' + e.text, s: 1 }));
  if (!words.length) return pool.slice(-limit).map(x => x.t);
  const scored = pool.map(x => {
    const low = x.t.toLowerCase();
    const hit = words.filter(w => low.includes(w)).length;
    return { ...x, hit };
  }).filter(x => x.hit > 0).sort((a, b) => b.hit * b.s - a.hit * a.s);
  return (scored.length ? scored : pool.slice(-4)).slice(0, limit).map(x => x.t);
}
export function searchMemory(q) { return recall(q, 12); }
export function digest() {
  const p = P();
  const out = [];
  Object.entries(p.prefs).slice(0, 8).forEach(([k, v]) => out.push(`• ${k}: ${v}`));
  p.facts.slice(-6).forEach(f => out.push('• ' + f.text));
  p.projects.slice(-3).forEach(pr => out.push(`• Проект «${pr.name}»`));
  return out.join('\n');
}

/* ---------- free local extractors (no RPM) ---------- */
export function extractFactsLocal(text) {
  const found = { facts: [], prefs: {} };
  const t = String(text || '');
  let m = t.match(/меня зовут ([А-Яа-яЁёA-Za-z\- ]{2,30})/i);
  if (m) found.prefs['имя'] = m[1].trim();
  m = t.match(/мне (\d{1,3}) (лет|год)/i);
  if (m) found.prefs['возраст'] = m[1];
  m = t.match(/я (живу|из) (в |г\. )?([А-Яа-яЁёA-Za-z\- ]{2,30})/i);
  if (m) found.prefs['город'] = m[3].trim();
  m = t.match(/я (люблю|обожаю|нравится) ([^.,!?\n]{3,60})/i);
  if (m) found.prefs['любит'] = m[2].trim();
  m = t.match(/я (работаю|учусь) ([^.,!?\n]{3,80})/i);
  if (m) found.facts.push('Работа/учёба: ' + m[2].trim());
  m = t.match(/мой (телефон|ноутбук|компьютер|авто|машина)[^.,!?\n]{0,60}/i);
  if (m) found.facts.push(m[0].trim());
  m = t.match(/запомни[:\s]+(.{3,200})/i);
  if (m) found.facts.push(m[1].trim());
  found.facts.forEach(f => addFact(f));
  Object.entries(found.prefs).forEach(([k, v]) => addPref(k, v));
  return found.facts.length + Object.keys(found.prefs).length;
}
export const extractLocal = extractFactsLocal;

/* ---------- LLM extraction (RPM-budgeted, called by agent) ---------- */
export async function extractLLM(key, convo) {
  if (!key || !convo || convo.length < 40) return false;
  const t = await quickChat({ key, maxTokens: 300, messages: [
    { role: 'system', content: 'Извлеки из диалога долговременные факты о пользователе. Ответь СТРОГО JSON: {"facts":["..."],"prefs":{"ключ":"значение"},"projects":[{"name":"...","note":"..."}]}. Пустые массивы если нечего. Только JSON.' },
    { role: 'user', content: convo.slice(-3000) } ] });
  try {
    const j = JSON.parse(String(t).replace(/```json|```/g, '').trim());
    (j.facts || []).forEach(f => addFact(f));
    Object.entries(j.prefs || {}).forEach(([k, v]) => addPref(k, v));
    (j.projects || []).forEach(p => addProject(p.name, p.note));
    return true;
  } catch (e) { return false; }
}

/* ---------- memory view render ---------- */
const escH = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function fill(sel, items, empty) {
  const box = typeof sel === 'string' ? document.querySelector(sel) : sel;
  if (!box) return;
  box.innerHTML = items.length ? items.map(t => `<div class="mem-item">${escH(t)}</div>`).join('') : `<div class="empty">${empty}</div>`;
}
export function renderMemory({ facts, prefs, projects, episodes, files, filter }) {
  const p = P();
  const f = String(filter || '').toLowerCase().trim();
  const has = s => !f || String(s).toLowerCase().includes(f);
  fill(facts, p.facts.slice().reverse().map(x => x.text).filter(has), 'Фактов пока нет. Поговори со мной — запомню.');
  fill(prefs, Object.entries(p.prefs).map(([k, v]) => `${k}: ${v}`).filter(has), 'Вкусов пока нет.');
  fill(projects, p.projects.slice().reverse().map(x => x.note ? `${x.name} — ${x.note}` : x.name).filter(has), 'Проектов пока нет.');
  fill(episodes, p.episodes.slice(-30).reverse().map(x => x.text).filter(has), 'Событий пока нет.');
  fill(files, p.files.map(x => `${x.name}${x.summary ? ' — ' + x.summary.slice(0, 80) : ''}`).filter(has), 'Файлов пока нет.');
}
