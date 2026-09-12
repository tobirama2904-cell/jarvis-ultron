/* MARK II — FX: synth SFX, particle background, arc-reactor renderer. */
import { get } from './store.js';

/* ================= SFX (WebAudio synth, no assets) ================= */
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
};

/* ================= Background particles ================= */
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
    const n = Math.min(130, Math.round(innerWidth * innerHeight / 16000));
    this.pts = Array.from({ length: n }, () => ({
      x: Math.random(), y: Math.random(), r: Math.random() * 1.6 + 0.4,
      vx: (Math.random() - 0.5) * 0.00016, vy: (Math.random() - 0.5) * 0.00016,
      tw: Math.random() * Math.PI * 2,
    }));
  }
  color() { return getComputedStyle(document.documentElement).getPropertyValue('--acc').trim() || '#35c4ff'; }
  start() {
    if (this.running) return; this.running = true;
    const step = () => {
      if (!this.running) return;
      const { x, c } = this, W = c.width, H = c.height, col = this.color();
      x.clearRect(0, 0, W, H);
      const px = (this.mx - 0.5) * 24, py = (this.my - 0.5) * 24;
      for (const p of this.pts) {
        p.x = (p.x + p.vx + 1) % 1; p.y = (p.y + p.vy + 1) % 1; p.tw += 0.02;
        const a = 0.25 + 0.35 * (0.5 + 0.5 * Math.sin(p.tw));
        x.beginPath();
        x.arc(p.x * W + px * p.r, p.y * H + py * p.r, p.r * (W / innerWidth), 0, 7);
        x.fillStyle = hexA(col, a * 0.5); x.fill();
      }
      // links
      x.lineWidth = 1;
      for (let i = 0; i < this.pts.length; i += 3) {
        for (let j = i + 3; j < this.pts.length; j += 3) {
          const a = this.pts[i], b = this.pts[j];
          const dx = (a.x - b.x) * W, dy = (a.y - b.y) * H, d2 = dx * dx + dy * dy;
          if (d2 < 120 * 120) {
            x.strokeStyle = hexA(col, 0.06 * (1 - Math.sqrt(d2) / 120));
            x.beginPath(); x.moveTo(a.x * W, a.y * H); x.lineTo(b.x * W, b.y * H); x.stroke();
          }
        }
      }
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
}
export function hexA(hex, a) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a.toFixed(3)})`;
}

/* ================= Arc reactor ================= */
export class Reactor {
  constructor(canvas) {
    this.c = canvas; this.x = canvas.getContext('2d');
    this.level = 0; this.target = 0; this.color = '#35c4ff';
    this.t = 0; this.spike = 0;
    this.resize = this.resize.bind(this);
    window.addEventListener('resize', this.resize);
    this.resize();
    const step = () => { this.draw(); requestAnimationFrame(step); };
    requestAnimationFrame(step);
  }
  resize() {
    const d = Math.min(2, devicePixelRatio || 1), r = this.c.getBoundingClientRect();
    this.c.width = Math.max(2, r.width * d); this.c.height = Math.max(2, r.height * d);
  }
  setColor(c) { this.color = c; }
  setLevel(v) { this.target = Math.max(0, Math.min(1, v)); }
  boom() { this.spike = 1; }
  draw() {
    const { x, c } = this, W = c.width, H = c.height;
    if (!W) return;
    this.t += 0.016;
    this.level += (this.target - this.level) * 0.12;
    this.spike *= 0.92;
    const lvl = Math.min(1, this.level + this.spike);
    const cx = W / 2, cy = H / 2, R = Math.min(W, H) / 2 - 4 * (W / 300);
    const col = this.color;
    x.clearRect(0, 0, W, H);
    x.save(); x.translate(cx, cy);
    // halo
    const halo = x.createRadialGradient(0, 0, R * 0.2, 0, 0, R * 1.25);
    halo.addColorStop(0, hexA(col, 0.28 + lvl * 0.25));
    halo.addColorStop(1, hexA(col, 0));
    x.fillStyle = halo; x.beginPath(); x.arc(0, 0, R * 1.25, 0, 7); x.fill();
    // outer ticks (slow)
    x.save(); x.rotate(this.t * 0.25);
    for (let i = 0; i < 60; i++) {
      const big = i % 6 === 0;
      x.rotate(Math.PI * 2 / 60);
      x.strokeStyle = hexA(col, big ? 0.9 : 0.35);
      x.lineWidth = (big ? 3 : 1.5) * (W / 300);
      x.beginPath(); x.moveTo(0, -R); x.lineTo(0, -R + (big ? 14 : 7) * (W / 300)); x.stroke();
    }
    x.restore();
    // segmented ring (counter-rotating)
    x.save(); x.rotate(-this.t * (0.5 + lvl * 1.6));
    for (let i = 0; i < 10; i++) {
      x.rotate(Math.PI * 2 / 10);
      x.strokeStyle = hexA(col, 0.55 + lvl * 0.4);
      x.lineWidth = 6 * (W / 300);
      x.beginPath(); x.arc(0, 0, R * 0.78, -0.22, 0.22); x.stroke();
    }
    x.restore();
    // thin rings
    [0.66, 0.6].forEach((k, i) => {
      x.strokeStyle = hexA(col, i ? 0.9 : 0.4); x.lineWidth = (i ? 2 : 1) * (W / 300);
      x.beginPath(); x.arc(0, 0, R * k, 0, 7); x.stroke();
    });
    // coils
    x.save(); x.rotate(this.t * (1.2 + lvl * 3));
    x.strokeStyle = hexA(col, 0.85); x.lineWidth = 3 * (W / 300);
    for (let i = 0; i < 10; i++) {
      x.rotate(Math.PI * 2 / 10);
      x.beginPath(); x.moveTo(0, -R * 0.6); x.lineTo(0, -R * 0.34); x.stroke();
    }
    x.restore();
    // core
    const flick = 1 + Math.sin(this.t * 31) * 0.04 + lvl * 0.25;
    const core = x.createRadialGradient(0, 0, 0, 0, 0, R * 0.32 * flick);
    core.addColorStop(0, '#ffffff');
    core.addColorStop(0.45, hexA(col, 0.95));
    core.addColorStop(1, hexA(col, 0.05));
    x.fillStyle = core; x.beginPath(); x.arc(0, 0, R * 0.32 * flick, 0, 7); x.fill();
    x.restore();
  }
}
