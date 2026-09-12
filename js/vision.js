/* MARK II — vision v2: camera + 2-hand gestures + face blendshapes (mood) + nod/shake.
   MediaPipe tasks-vision lazy-loads from CDN, fails soft. */
const TP_VERSION = '0.10.14';
const TP_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${TP_VERSION}/vision_bundle.mjs`;
const HAND_MODEL = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';
const FACE_MODEL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, (a.z || 0) - (b.z || 0));

export class Vision {
  constructor(videoEl) {
    this.video = videoEl;
    this.stream = null;
    this.facing = 'user';
    this.ai = null;
    this.aiLoading = null;
    this.aiOn = false;
    this.raf = 0;
    this.lastT = 0;
    this.onStatus = null;
    this.onGesture = null;   // (name, info) => void
    this.onFace = null;      // first detection => void
    this.onMood = null;      // (name) => void
    this.faceSeen = false;
    this._hands = [{}, {}];  // stable state per hand slot
    this._coolG = 0;
    this._coolM = {};
    this._coolFace = 0;
    this._nose = [];         // {x,y,t} for nod/shake
    this._coolNod = 0;
    this.lastMood = null;    // {label, when}
  }
  get live() { return !!this.stream; }
  status(msg, kind) { if (this.onStatus) try { this.onStatus(msg, kind || 'info'); } catch (e) {} }

  async start(facing) {
    if (facing) this.facing = facing;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      this.status('Камера недоступна в этом браузере', 'err'); return false;
    }
    this.stopStream();
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: this.facing }, width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      this.video.srcObject = this.stream;
      this.video.muted = true;
      await this.video.play().catch(() => {});
      this.status(this.facing === 'user' ? 'Фронтальная камера' : 'Задняя камера', 'ok');
      if (this.aiOn) this._loop();
      return true;
    } catch (e) {
      this.stream = null;
      const denied = e && (e.name === 'NotAllowedError' || e.name === 'SecurityError');
      this.status(denied ? 'Доступ к камере запрещён — разреши в браузере' : 'Камера не найдена', 'err');
      return false;
    }
  }
  stopStream() {
    cancelAnimationFrame(this.raf);
    if (this.stream) { try { this.stream.getTracks().forEach(t => t.stop()); } catch (e) {} }
    this.stream = null;
    if (this.video) this.video.srcObject = null;
    this.faceSeen = false;
  }
  stop() { this.stopStream(); this.status('Камера выключена', 'info'); }
  async flip() {
    this.facing = this.facing === 'user' ? 'environment' : 'user';
    if (this.live) { await this.start(this.facing); return this.facing === 'user' ? 'Фронталка включена' : 'Задняя камера включена'; }
    return this.facing === 'user' ? 'Режим: фронтальная' : 'Режим: задняя';
  }
  snapshot(maxW = 640) {
    if (!this.live || !this.video.videoWidth) return null;
    const c = document.createElement('canvas');
    const k = Math.min(1, maxW / this.video.videoWidth);
    c.width = Math.round(this.video.videoWidth * k);
    c.height = Math.round(this.video.videoHeight * k);
    c.getContext('2d').drawImage(this.video, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.85);
  }
  async torch() {
    // returns true(on)/false(off)/null(unsupported). Needs live rear track.
    try {
      const tr = this.stream && this.stream.getVideoTracks()[0];
      if (!tr) return null;
      const caps = tr.getCapabilities ? tr.getCapabilities() : {};
      if (!caps.torch) return null;
      this._torchOn = !this._torchOn;
      await tr.applyConstraints({ advanced: [{ torch: !!this._torchOn }] });
      return !!this._torchOn;
    } catch (e) { return null; }
  }

  /* ---------- AI ---------- */
  async enableAI(on) {
    this.aiOn = !!on;
    if (!on) { cancelAnimationFrame(this.raf); this.status(this.live ? 'ИИ-зрение выключено' : 'Камера выключена', 'info'); return true; }
    if (!this.live) {
      const ok = await this.start(this.facing);
      if (!ok) { this.aiOn = false; return false; }
    }
    if (!this.ai) {
      if (!this.aiLoading) this.aiLoading = this._loadAI();
      const ok = await this.aiLoading;
      if (!ok) { this.aiOn = false; return false; }
    }
    this._loop();
    this.status('ИИ-зрение: жесты + мимика + кивки', 'ok');
    return true;
  }
  async _loadAI() {
    this.status('Загружаю модели зрения…', 'info');
    try {
      const mod = await Promise.race([
        import(TP_URL),
        new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 30000)),
      ]);
      const fileset = await mod.FilesetResolver.forVisionTasks(
        `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${TP_VERSION}/wasm`);
      const mkHands = (delegate) => mod.HandLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: HAND_MODEL, delegate },
        runningMode: 'VIDEO', numHands: 2, minHandDetectionConfidence: 0.5, minTrackingConfidence: 0.5 });
      const mkFace = (delegate) => mod.FaceLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: FACE_MODEL, delegate },
        runningMode: 'VIDEO', numFaces: 1, minFaceDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5, outputFaceBlendshapes: true });
      let hands, face;
      try { [hands, face] = await Promise.all([mkHands('GPU'), mkFace('GPU')]); }
      catch (e) { [hands, face] = await Promise.all([mkHands('CPU'), mkFace('CPU')]); }
      this.ai = { hands, face };
      return true;
    } catch (e) {
      this.status('Модели зрения не загрузились (сеть/CDN). Камера работает без ИИ.', 'warn');
      this.aiLoading = null;
      return false;
    }
  }
  _loop() {
    cancelAnimationFrame(this.raf);
    const step = () => {
      if (!this.aiOn || !this.live || !this.ai) return;
      const now = performance.now();
      if (this.video.currentTime !== this.lastT && this.video.videoWidth) {
        this.lastT = this.video.currentTime;
        try {
          const hr = this.ai.hands.detectForVideo(this.video, now);
          this._handsStep(hr && hr.landmarks);
        } catch (e) {}
        try {
          const fr = this.ai.face.detectForVideo(this.video, now);
          this._faceStep(fr);
        } catch (e) {}
      }
      this.raf = requestAnimationFrame(step);
    };
    this.raf = requestAnimationFrame(step);
  }

  /* ----- hands: distance-based classification (mirror-safe) ----- */
  _classify(lm) {
    const wrist = lm[0];
    const ext = t => dist(lm[t[0]], wrist) > dist(lm[t[1]], wrist) * 1.12;
    const idx = ext([8, 6]), mid = ext([12, 10]), rng = ext([16, 14]), pky = ext([20, 18]);
    const thb = dist(lm[4], lm[2]) > dist(lm[3], lm[2]) * 1.3;
    const pinch = dist(lm[4], lm[8]) < 0.055;
    const n = [idx, mid, rng, pky].filter(Boolean).length + (thb ? 1 : 0);
    if (pinch && n <= 2) return { name: 'pinch', n };
    if (pinch && n >= 4) return { name: 'ok', n };
    if (n >= 5 || (n === 4 && !thb)) return { name: 'palm', n };
    if (n === 0) return { name: 'fist', n };
    if (idx && mid && !rng && !pky) return { name: 'victory', n };
    if (idx && !mid && !rng && !pky && !thb) return { name: 'point', n };
    if (thb && !idx && !mid && !rng && !pky) return { name: 'thumb', n };
    return { name: '', n };
  }
  _handsStep(all) {
    for (let slot = 0; slot < 2; slot++) {
      const lm = all && all[slot];
      const st = this._hands[slot];
      if (!lm) { st.name = ''; st.n = 0; continue; }
      const { name, n } = this._classify(lm);
      if (name !== st.name) { st.name = name; st.n = 0; }
      else st.n++;
      if (name && st.n >= 7 && Date.now() > this._coolG) {
        this._coolG = Date.now() + 2600;
        st.n = 0;
        if (this.onGesture) try { this.onGesture(name, { hand: slot, count: n }); } catch (e) {}
      }
    }
  }

  /* ----- face: blendshapes + nod/shake ----- */
  _faceStep(fr) {
    const has = fr && fr.faceLandmarks && fr.faceLandmarks.length > 0;
    if (!has) { this._nose.length = 0; return; }
    if (!this.faceSeen) {
      this.faceSeen = true;
      if (Date.now() > this._coolFace) {
        this._coolFace = Date.now() + 60000;
        if (this.onFace) try { this.onFace(); } catch (e) {}
      }
    }
    // blendshapes -> mood
    try {
      const cats = fr.faceBlendshapes && fr.faceBlendshapes[0] && fr.faceBlendshapes[0].categories;
      if (cats) {
        const sc = {};
        cats.forEach(c => { sc[c.categoryName] = c.score; });
        const now = Date.now();
        const mood = (sc.mouthSmileLeft > 0.55 && sc.mouthSmileRight > 0.55) ? 'smile'
          : (sc.jawOpen > 0.55 ? 'wow'
          : ((sc.eyeBlinkLeft > 0.75 && sc.eyeBlinkRight < 0.3) || (sc.eyeBlinkRight > 0.75 && sc.eyeBlinkLeft < 0.3)) ? 'wink'
          : (sc.browDownLeft > 0.7 && sc.browDownRight > 0.7 ? 'angry' : ''));
        if (mood && now > (this._coolM[mood] || 0)) {
          this._coolM[mood] = now + 9000;
          const labels = { smile: '😊 улыбка', wow: '😮 удивление', wink: '😉 подмигивание', angry: '😠 хмуришься' };
          this.lastMood = { label: labels[mood], when: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) };
          if (this.onMood) try { this.onMood(mood); } catch (e) {}
        }
      }
    } catch (e) {}
    // nod / shake via nose tip
    try {
      const nose = fr.faceLandmarks[0][1];
      const now = performance.now();
      this._nose.push({ x: nose.x, y: nose.y, t: now });
      while (this._nose.length && now - this._nose[0].t > 1400) this._nose.shift();
      if (this._nose.length > 10 && now > this._coolNod) {
        const flips = axis => {
          let f = 0, dir = 0, last = this._nose[0][axis];
          for (const p of this._nose) {
            const d = p[axis] - last;
            if (Math.abs(d) > 0.006) {
              const s = Math.sign(d);
              if (dir && s !== dir) f++;
              dir = s; last = p[axis];
            }
          }
          return f;
        };
        if (flips('y') >= 4) {
          this._coolNod = now + 4000; this._nose.length = 0;
          if (this.onGesture) try { this.onGesture('nod', {}); } catch (e) {}
        } else if (flips('x') >= 4) {
          this._coolNod = now + 4000; this._nose.length = 0;
          if (this.onGesture) try { this.onGesture('shake', {}); } catch (e) {}
        }
      }
    } catch (e) {}
  }
}
