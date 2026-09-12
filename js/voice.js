/* MARK II — voice engine v2: watchdog TTS (never stalls), robust STT, wake kinds. */
import { WAKE_NAMES, PERSONAS } from './config.js';
import { get } from './store.js';

const SR = (typeof window !== 'undefined') && (window.SpeechRecognition || window.webkitSpeechRecognition);

export class Voice {
  constructor() {
    this.rec = null;
    this.listening = false;
    this.wantListen = false;
    this.speaking = false;
    this.dialogUntil = 0;
    this.queue = [];
    this.level = 0;
    this.restartTimer = null;
    this.onFinal = null;
    this.onInterim = null;
    this.onState = null;
    this.onWake = null;          // (kind: 'name'|'cmd') => void
    this.lastHeard = '';
    this.lastHeardAt = 0;
    this.lastErr = '';
    this._voices = [];
    this._pulseTimer = null;
    this._watchdog = null;
    this._chunkDeadline = 0;
    this._lastFinal = '';
    this._errCool = 0;
    try {
      if ('speechSynthesis' in window) {
        const load = () => { this._voices = speechSynthesis.getVoices() || []; };
        load(); speechSynthesis.onvoiceschanged = load;
      }
    } catch (e) {}
  }

  get sttOK() { return !!SR; }
  get ttsOK() { return typeof window !== 'undefined' && 'speechSynthesis' in window; }
  inDialog() { return Date.now() < this.dialogUntil; }
  openDialog(sec = 9) { this.dialogUntil = Date.now() + sec * 1000; }
  emit() { if (this.onState) try { this.onState(this.snapshot()); } catch (e) {} }
  snapshot() {
    return { stt: this.sttOK, tts: this.ttsOK, listening: this.listening,
      speaking: this.speaking, dialog: this.inDialog(), level: this.level,
      lastHeard: this.lastHeard, lastErr: this.lastErr };
  }

  /* ---------- STT ---------- */
  startListen() {
    if (!this.sttOK) { this.emit(); return false; }
    this.wantListen = true;
    this.lastErr = '';
    if (this.listening) return true;
    try {
      const rec = new SR();
      rec.lang = 'ru-RU'; rec.continuous = true; rec.interimResults = true; rec.maxAlternatives = 1;
      rec.onresult = ev => {
        let interim = '';
        for (let i = ev.resultIndex; i < ev.results.length; i++) {
          const r = ev.results[i];
          if (r.isFinal) this._handleFinal(r[0].transcript.trim());
          else interim += r[0].transcript;
        }
        if (interim && this.onInterim) this.onInterim(interim);
      };
      rec.onerror = ev => {
        const err = ev.error || 'unknown';
        this.lastErr = err; this.emit();
        if (err === 'not-allowed' || err === 'service-not-allowed') {
          this.wantListen = false; this.listening = false;
          try { rec.stop(); } catch (e) {}
          this.emit();
        }
        // 'no-speech' / 'audio-capture' / 'network' -> onend will reschedule
      };
      rec.onend = () => {
        this.listening = false; this.emit();
        if (this.wantListen && !this._intentStop) {
          clearTimeout(this.restartTimer);
          this.restartTimer = setTimeout(() => { if (this.wantListen) this.startListen(); }, 600);
        }
        this._intentStop = false;
      };
      rec.start();
      this.rec = rec; this.listening = true; this.emit();
      return true;
    } catch (e) {
      this.lastErr = (e && e.message) || 'start-failed';
      this.wantListen = false; this.emit(); return false;
    }
  }
  stopListen() {
    this.wantListen = false;
    clearTimeout(this.restartTimer);
    if (this.rec) { try { this._intentStop = true; this.rec.stop(); } catch (e) {} }
    this.rec = null; this.listening = false; this.emit();
  }
  toggleListen() { return this.listening ? (this.stopListen(), false) : this.startListen(); }

  _handleFinal(text) {
    text = (text || '').trim();
    if (!text || text === this._lastFinal) return;
    this._lastFinal = text;
    setTimeout(() => { if (this._lastFinal === text) this._lastFinal = ''; }, 4000);
    this.lastHeard = text; this.lastHeardAt = Date.now(); this.emit();
    const low = text.toLowerCase();
    const hasWake = get().settings.wake !== false && WAKE_NAMES.some(n => low.includes(n));
    if (hasWake) {
      this.openDialog(12);
      let cmd = text;
      WAKE_NAMES.forEach(n => { cmd = cmd.replace(new RegExp(n, 'ig'), ''); });
      cmd = cmd.replace(/^[,.\s!]+|[,.\s!]+$/g, '');
      if (this.onWake) this.onWake(cmd.length > 1 ? 'cmd' : 'name');
      if (cmd.length > 1 && this.onFinal) this.onFinal(cmd);
      return;
    }
    if (this.onFinal) this.onFinal(text);
  }

  /* ---------- TTS (watchdog: never stalls) ---------- */
  pickVoice(personaId) {
    const vs = this._voices.length ? this._voices : [];
    if (!vs.length) return null;
    const want = get().settings.voiceURI;
    if (want) { const v = vs.find(x => x.voiceURI === want); if (v) return v; }
    const ru = vs.filter(v => (v.lang || '').toLowerCase().startsWith('ru'));
    if (ru.length) {
      const g = ru.find(v => /google русский/i.test(v.name));
      return g || ru[0];
    }
    return vs.find(v => (v.lang || '').toLowerCase().startsWith('en')) || vs[0];
  }
  listVoices() {
    try { return (speechSynthesis.getVoices() || []).map(v => ({ uri: v.voiceURI, name: v.name, lang: v.lang })); }
    catch (e) { return []; }
  }

  speak(text, personaId) {
    if (!this.ttsOK) return false;
    text = cleanForSpeech(text);
    if (!text) return false;
    this.queue.push({ text, personaId });
    if (!this.speaking) this._next();
    else this._armWatchdog(15000); // queue grows but head may be stuck -> watchdog will push
    return true;
  }
  _next() {
    const item = this.queue.shift();
    if (!item) { this._setSpeaking(false); return; }
    this._setSpeaking(true);
    try {
      const p = PERSONAS[item.personaId] || PERSONAS.jarvis;
      const chunks = item.text.match(/[^.!?…\n]+[.!?…\n]+|[^.!?…\n]+$/g) || [item.text];
      let i = 0;
      const sayChunk = () => {
        if (i >= chunks.length) { this._next(); return; }
        const part = chunks[i++].trim().slice(0, 400);
        if (!part) { sayChunk(); return; }
        try {
          const u = new SpeechSynthesisUtterance(part);
          const v = this.pickVoice(item.personaId);
          if (v) u.voice = v;
          u.rate = (get().settings.rate || 1) * p.rate;
          u.pitch = p.pitch; u.volume = 1;
          let settled = false;
          const go = () => { if (!settled) { settled = true; sayChunk(); } };
          u.onend = u.onerror = go;
          u.onstart = () => { this._armWatchdog(Math.max(8000, part.length * 220)); };
          try { speechSynthesis.speak(u); } catch (e) { go(); return; }
          // failsafe: if neither onstart nor onend in N sec -> advance
          this._armWatchdog(Math.max(8000, part.length * 220), go);
        } catch (e) { sayChunk(); }
      };
      sayChunk();
    } catch (e) { this._next(); }
  }
  _armWatchdog(ms, force) {
    clearTimeout(this._watchdog);
    this._watchdog = setTimeout(() => {
      // TTS event lost (mobile cancel-swallow etc.) -> force progress
      if (force) { try { force(); } catch (e) {} return; }
      if (this.speaking) { try { speechSynthesis.cancel(); } catch (e) {} this._next(); }
    }, ms);
  }
  _setSpeaking(v) {
    this.speaking = v;
    if (v) this._pulse(true); else { this._pulse(false); clearTimeout(this._watchdog); }
    this.emit();
  }
  _pulse(on) {
    clearInterval(this._pulseTimer);
    if (!on) { this.level = 0; return; }
    const t0 = performance.now();
    this._pulseTimer = setInterval(() => {
      if (!this.speaking) { this.level = 0; clearInterval(this._pulseTimer); this.emit(); return; }
      const t = (performance.now() - t0) / 1000;
      this.level = 0.35 + 0.65 * Math.abs(Math.sin(t * 7) * 0.6 + Math.sin(t * 13.7) * 0.4);
      this.emit();
    }, 90);
  }
  stopSpeak() {
    this.queue.length = 0;
    clearTimeout(this._watchdog);
    try { speechSynthesis.cancel(); } catch (e) {}
    this._setSpeaking(false);
  }
  stopAll() { this.stopSpeak(); }
}

export function cleanForSpeech(s) {
  return String(s || '')
    .replace(/```[\s\S]*?```/g, ' код ')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[#*_>`~|◈▸]/g, '')
    .replace(/https?:\S+/g, '')
    .replace(/\s+/g, ' ').trim().slice(0, 900);
}
