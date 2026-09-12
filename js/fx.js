/* MARK II — FX v2: synth SFX, soft particles, PLASMA ORB, confetti. */
import { get } from './store.js';

/* ================= SFX ================= */
let AC = null, master = null;
function ac() {
  if (!AC) {
    AC = new (window.AudioContext || window.webkitAudioContext)();
    master = AC.createGain(); master.gain.value = 0.5; master.connect(AC.destination);
  }
  if (AC.state === 'suspended') AC.resume().catch(() => {});
  return AC;
}
export function unlockAudio() { try { ac(); } catch (e) {} }
function tone(f0, f1, dur, type = 'sine', vol = 0.5, delay = 0) {
  if (!get().settings.sfx) return;
  try {
    const c = ac(), t = c.currentTime + delay;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + dur + 0.05);
  } catch (e) {}
}
export const Sfx = {
  click()   { tone(760, 980, 0.07, 'triangle', 0.25); },
  open()    { tone(420, 880, 0.14, 'sine', 0.3); tone(840, 1320, 0.12, 'sine', 0.2, 0.08); },
  close()   { tone(880, 420, 0.14, 'sine', 0.25); },
  send()    { tone(520, 1240, 0.12, 'sawtooth', 0.12); tone(1040, 1560, 0.1, 'sine', 0.2, 0.05); },
  recv()    { tone(1240, 880, 0.1, 'sine', 0.18); },
  confirm() { tone(660, 660, 0.09, 'sine', 0.3); tone(990, 990, 0.14, 'sine', 0.3, 0.1); },
  error()   { tone(220, 110, 0.25, 'square', 0.18); },
  notify()  { tone(880, 880, 0.1, 'sine', 0.28); tone(1174, 1174, 0.16, 'sine', 0.28, 0.12); },
  wake()    { tone(300, 900, 0.22, 'sine', 0.3); tone(600, 1500, 0.2, 'triangle', 0.15, 0.1); },
  boot()    { tone(80, 480, 0.7, 'sawtooth', 0.1); tone(160, 960, 0.7, 'sine', 0.2, 0.1); tone(1320, 1320, 0.2, 'sine', 0.2, 0.75); },
  alarm()   { tone(740, 740, 0.14, 'square', 0.2); tone(740, 740, 0.14, 'square', 0.2, 0.2); tone(988, 988, 0.3, 'square', 0.2, 0.4); },
  scan()    { tone(200, 1800, 0.5, 'sine', 0.22); tone(1800, 300, 0.4, 'sine', 0.15, 0.45); },
  suitup()  { [220, 330, 440, 660, 880].forEach((f, i) => tone(f, f * 1.5, 0.18, 'sawtooth', 0.16, i * 0.11)); tone(1320, 1320, 0.3, 'sine', 0.25, 0.6); },
  tada()    { [523, 659, 784, 1046].forEach((f, i) => tone(f, f, 0.16, 'triangle', 0.3, i * 0.1)); },
  dance()   { for (let i = 0; i < 8; i++) tone(i % 2 ? 440 : 660, i % 2 ? 660 : 440, 0.12, 'square', 0.12, i * 0.14); },
  snap()    { tone(3000, 200, 0.3, 'sine', 0.25); tone(150, 60, 0.5, 'sine', 0.3, 0.2); },
  tick()    { tone(1200, 1200, 0.04, 'square', 0.12); },
};

/* ================= soft particles ================= */
export class BgFX {
  constructor(canvas) {
    this.c = canvas; this.x = canvas.getContext('2d');
    this.pts = []; this.mx = 0.5; this.my = 0.5; this.running = false;
    this.resize = this.resize.bind(this);
    window.addEventListener('resize', this.resize);
    window.addEventListener('pointermove', e => {
      this.mx = e.clientX / innerWidth; this.my = e.clientY / innerHeight;
    }, { passive: true });
    this.resize();
  }
  resize() {
    const d = Math.min(1.5, devicePixelRatio || 1);
    this.c.width = innerWidth * d; this.c.height = innerHeight * d;
    const n = Math.min(110, Math.round(innerWidth * innerHeight / 19000));
    this.pts = Array.from({ length: n }, () => ({
      x: Math.random(), y: Math.random(), r: Math.random() * 2 + 0.6,
      vx: (Math.random() - 0.5) * 0.00012, vy: (Math.random() - 0.5) * 0.00012,
      tw: Math.random() * Math.PI * 2, depth: Math.random(),
    }));
  }
  cols() {
    const cs = getComputedStyle(document.documentElement);
    return [cs.getPropertyValue('--acc').trim() || '#38e1ff',
      cs.getPropertyValue('--a2').trim() || '#818cf8'];
  }
  start() {
    if (this.running) return; this.running = true;
    const step = () => {
      if (!this.running || document.hidden) { requestAnimationFrame(step); return; }
      const { x, c } = this, W = c.width, H = c.height, [c1, c2] = this.cols();
      x.clearRect(0, 0, W, H);
      const px = (this.mx - 0.5) * 30, py = (this.my - 0.5) * 30;
      for (const p of this.pts) {
        p.x = (p.x + p.vx + 1) % 1; p.y = (p.y + p.vy + 1) % 1; p.tw += 0.015;
        const a = 0.2 + 0.4 * (0.5 + 0.5 * Math.sin(p.tw));
        x.beginPath();
        x.arc(p.x * W + px * p.depth, p.y * H + py * p.depth, p.r * (W / innerWidth), 0, 7);
        x.fillStyle = hexA(p.depth > 0.5 ? c1 : c2, a * 0.55); x.fill();
      }
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
}
export function hexA(hex, a) {
  try {
    const h = String(hex).trim().replace('#', '');
    const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a.toFixed(3)})`;
  } catch (e) { return `rgba(56,225,255,${a})`; }
}

/* ================= PLASMA ORB (same API as Reactor) ================= */
export class Reactor {
  constructor(canvas) {
    this.c = canvas; this.x = canvas.getContext('2d');
    this.level = 0; this.target = 0; this.color = '#38e1ff'; this.color2 = '#818cf8';
    this.t = Math.random() * 10; this.spike = 0;
    this.sparks = Array.from({ length: 26 }, () => ({ a: Math.random() * 7, r: 0.75 + Math.random() * 0.45, s: 0.4 + Math.random() * 1.2, w: Math.random() * 7 }));
    this.resize = this.resize.bind(this);
    window.addEventListener('resize', this.resize);
    this.resize();
    const step = () => { if (!document.hidden) this.draw(); requestAnimationFrame(step); };
    requestAnimationFrame(step);
  }
  resize() {
    const d = Math.min(2, devicePixelRatio || 1), r = this.c.getBoundingClientRect();
    this.c.width = Math.max(2, r.width * d); this.c.height = Math.max(2, r.height * d);
  }
  setColor(c) {
    this.color = c;
    try {
      const cs = getComputedStyle(document.documentElement);
      this.color2 = cs.getPropertyValue('--a2').trim() || c;
    } catch (e) { this.color2 = c; }
  }
  setLevel(v) { this.target = Math.max(0, Math.min(1, v)); }
  boom() { this.spike = 1; }
  blob(R, lobes, phase, amp) {
    const { x } = this, N = 90;
    x.beginPath();
    for (let i = 0; i <= N; i++) {
      const a = (i / N) * Math.PI * 2;
      const r = R * (1 + amp * Math.sin(a * lobes + phase) + amp * 0.6 * Math.sin(a * (lobes + 2) - phase * 1.3));
      const px = Math.cos(a) * r, py = Math.sin(a) * r;
      i ? x.lineTo(px, py) : x.moveTo(px, py);
    }
    x.closePath();
  }
  draw() {
    const { x, c } = this, W = c.width, H = c.height;
    if (!W) return;
    this.t += 0.016;
    this.level += (this.target - this.level) * 0.1;
    this.spike *= 0.93;
    const lvl = Math.min(1, this.level + this.spike);
    const cx = W / 2, cy = H / 2, R = Math.min(W, H) / 2 - 6;
    const col = this.color, col2 = this.color2, t = this.t;
    x.clearRect(0, 0, W, H);
    x.save(); x.translate(cx, cy);
    x.globalCompositeOperation = 'lighter';
    // outer halo
    const halo = x.createRadialGradient(0, 0, R * 0.3, 0, 0, R * 1.3);
    halo.addColorStop(0, hexA(col, 0.22 + lvl * 0.2));
    halo.addColorStop(0.7, hexA(col2, 0.1));
    halo.addColorStop(1, hexA(col2, 0));
    x.fillStyle = halo; x.beginPath(); x.arc(0, 0, R * 1.3, 0, 7); x.fill();
    // plasma lobes
    this.blob(R * 0.86, 3, t * 0.9, 0.06 + lvl * 0.05);
    x.fillStyle = hexA(col, 0.28); x.fill();
    this.blob(R * 0.86, 4, -t * 0.7, 0.05 + lvl * 0.04);
    x.fillStyle = hexA(col2, 0.26); x.fill();
    this.blob(R * 0.68, 5, t * 1.4, 0.07 + lvl * 0.06);
    x.fillStyle = hexA(col, 0.4); x.fill();
    // sparks orbit
    for (const s of this.sparks) {
      s.a += 0.008 * s.s * (1 + lvl * 2);
      const rr = R * s.r * (1 + 0.08 * Math.sin(t * 2 + s.w));
      const sx = Math.cos(s.a) * rr, sy = Math.sin(s.a) * rr * 0.92;
      x.beginPath(); x.arc(sx, sy, (1 + lvl * 2) * (W / 300), 0, 7);
      x.fillStyle = hexA(s.w > 3.5 ? col : '#ffffff', 0.5); x.fill();
    }
    // core
    const flick = 1 + Math.sin(t * 6) * 0.03 + lvl * 0.22;
    const core = x.createRadialGradient(0, 0, 0, 0, 0, R * 0.4 * flick);
    core.addColorStop(0, '#ffffff');
    core.addColorStop(0.35, hexA(col, 0.95));
    core.addColorStop(0.7, hexA(col2, 0.5));
    core.addColorStop(1, hexA(col2, 0));
    x.fillStyle = core; x.beginPath(); x.arc(0, 0, R * 0.4 * flick, 0, 7); x.fill();
    x.restore();
  }
}

/* ================= confetti ================= */
const CONF_COLORS = ['#38e1ff', '#818cf8', '#f472b6', '#fbbf24', '#34d399', '#ffffff'];
export function confetti(n = 90) {
  try {
    for (let i = 0; i < n; i++) {
      const d = document.createElement('div');
      d.className = 'confetti-piece';
      const s = 6 + Math.random() * 8;
      d.style.cssText = `left:${Math.random() * 100}vw;top:-20px;width:${s}px;height:${s * (Math.random() > 0.5 ? 1 : 0.5)}px;background:${CONF_COLORS[i % CONF_COLORS.length]};border-radius:${Math.random() > 0.5 ? '50%' : '2px'};`;
      document.body.appendChild(d);
      const dx = (Math.random() - 0.5) * 300, dur = 1800 + Math.random() * 1600;
      d.animate([
        { transform: 'translate(0,0) rotate(0deg)', opacity: 1 },
        { transform: `translate(${dx}px,${innerHeight + 60}px) rotate(${Math.random() * 1080 - 540}deg)`, opacity: 0.9 },
      ], { duration: dur, easing: 'cubic-bezier(.2,.6,.4,1)' }).onfinish = () => d.remove();
      setTimeout(() => d.remove(), dur + 300);
    }
  } catch (e) {}
}
