/* MARK II — voice engine: continuous STT, ru TTS, wake-word, dialog mode, anti-echo. */
import { WAKE_NAMES, PERSONAS } from './config.js';
import { get } from './store.js';

const SR = (typeof window !== 'undefined') && (window.SpeechRecognition || window.webkitSpeechRecognition);

export class Voice {
  constructor() {
    this.rec = null;
    this.listening = false;      // mic on (continuous)
    this.wantListen = false;
    this.speaking = false;
    this.dialogUntil = 0;
    this.queue = [];
    this.level = 0;
    this.restartTimer = null;
    this.onFinal = null;         // (text) => void
    this.onInterim = null;       // (text) => void
    this.onState = null;         // (state) => void
    this.onWake = null;          // () => void
    this._voices = [];
    this._pulseTimer = null;
    this._lastFinal = '';
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
      speaking: this.speaking, dialog: this.inDialog(), level: this.level };
  }

  /* ---------- STT ---------- */
  startListen() {
    if (!this.sttOK) { this.emit(); return false; }
    this.wantListen = true;
    if (this.listening) return true;
    try {
      const rec = new SR();
      rec.lang = 'ru-RU'; rec.continuous = true; rec.interimResults = true; rec.maxAlternatives = 1;
      rec.onresult = ev => {
        let interim = '', finals = [];
        for (let i = ev.resultIndex; i < ev.results.length; i++) {
          const r = ev.results[i];
          if (r.isFinal) finals.push(r[0].transcript.trim());
          else interim += r[0].transcript;
        }
        if (interim && this.onInterim) this.onInterim(interim);
        for (const f of finals) this._handleFinal(f);
      };
      rec.onerror = ev => {
        const err = ev.error || '';
        // 'aborted' on intentional stop, 'no-speech'/'audio-capture' common headless — just reschedule
        if (['not-allowed', 'service-not-allowed'].includes(err)) {
          this.wantListen = false; this.listening = false; this.emit(); return;
        }
      };
      rec.onend = () => {
        this.listening = false; this.emit();
        if (this.wantListen && !this._intentStop) {
          clearTimeout(this.restartTimer);
          this.restartTimer = setTimeout(() => { if (this.wantListen) this.startListen(); }, 700);
        }
        this._intentStop = false;
      };
      rec.start();
      this.rec = rec; this.listening = true; this.emit();
      return true;
    } catch (e) { this.wantListen = false; this.emit(); return false; }
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
    const low = text.toLowerCase();
    const hasWake = WAKE_NAMES.some(n => low.includes(n));
    if (hasWake) {
      this.openDialog(12);
      if (this.onWake) this.onWake();
      // strip the name, keep the command
      let cmd = text;
      WAKE_NAMES.forEach(n => { cmd = cmd.replace(new RegExp(n, 'ig'), ''); });
      cmd = cmd.replace(/^[,.\s!]+|[,.\s!]+$/g, '');
      if (cmd.length > 1 && this.onFinal) this.onFinal(cmd);
      return;
    }
    if (this.onFinal) this.onFinal(text);
  }

  /* ---------- TTS ---------- */
  pickVoice(personaId) {
    const vs = this._voices.length ? this._voices : (speechSynthesis.getVoices() || []);
    if (!vs.length) return null;
    const want = get().settings.voiceURI;
    if (want) { const v = vs.find(x => x.voiceURI === want); if (v) return v; }
    const ru = vs.filter(v => (v.lang || '').toLowerCase().startsWith('ru'));
    if (ru.length) {
      const fem = personaId === 'friday';
      const named = ru.find(v => /female|жен|alena|milena|katja|irina/i.test(v.name)) ||
        ru.find(v => /male|муж|pavel|dmitry|yuri/i.test(v.name));
      if (fem && named && /female|жен|alena|milena|katja|irina/i.test(named.name)) return named;
      if (!fem && named && /male|муж|pavel|dmitry|yuri/i.test(named.name)) return named;
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
    return true;
  }
  _next() {
    const item = this.queue.shift();
    if (!item) { this.speaking = false; this.level = 0; this.emit(); return; }
    try {
      speechSynthesis.cancel(); // drop stale
      const p = PERSONAS[item.personaId] || PERSONAS.jarvis;
      // chunk long text by sentences (Chrome ~200-300 chars per utter is safest)
      const chunks = item.text.match(/[^.!?…\n]+[.!?…\n]+|[^.!?…\n]+$/g) || [item.text];
      let i = 0;
      const sayChunk = () => {
        if (i >= chunks.length) { this._next(); return; }
        const u = new SpeechSynthesisUtterance(chunks[i++].trim().slice(0, 400));
        const v = this.pickVoice(item.personaId);
        if (v) u.voice = v;
        u.rate = (get().settings.rate || 1) * p.rate;
        u.pitch = p.pitch; u.volume = 1;
        u.onend = u.onerror = () => sayChunk();
        this.speaking = true; this._pulse(true); this.emit();
        speechSynthesis.speak(u);
      };
      sayChunk();
    } catch (e) { this.speaking = false; this._next(); }
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
    try { speechSynthesis.cancel(); } catch (e) {}
    this.speaking = false; this._pulse(false); this.emit();
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
