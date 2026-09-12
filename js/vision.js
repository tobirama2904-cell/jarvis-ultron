/* MARK II — vision: camera (own stream, no camera_utils), hand gestures + face greet.
   AI (MediaPipe tasks-vision) lazy-loads from CDN and fails soft. */
const TP_VERSION = '0.10.14';
const TP_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${TP_VERSION}/vision_bundle.mjs`;
const HAND_MODEL = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';
const FACE_MODEL = 'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite';

export class Vision {
  constructor(videoEl) {
    this.video = videoEl;
    this.stream = null;
    this.facing = 'user';
    this.ai = null;            // {hands, faces}
    this.aiLoading = null;
    this.aiOn = false;
    this.raf = 0;
    this.lastT = 0;
    this.onStatus = null;      // (msg, kind) => void
    this.onGesture = null;     // ('palm'|'fist') => void
    this.onFace = null;        // () => void
    this._stable = { name: '', n: 0 };
    this._coolGesture = 0;
    this._coolFace = 0;
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
  }
  stop() { this.stopStream(); this.status('Камера выключена', 'info'); }

  async flip() {
    this.facing = this.facing === 'user' ? 'environment' : 'user';
    if (this.live) { await this.start(this.facing); return this.facing; }
    this.status(this.facing === 'user' ? 'Режим: фронтальная' : 'Режим: задняя', 'info');
    return this.facing;
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

  /* ---------- AI: hands + face ---------- */
  async enableAI(on) {
    this.aiOn = !!on;
    if (!on) { cancelAnimationFrame(this.raf); this.status('ИИ-зрение выключено', 'info'); return true; }
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
    this.status('ИИ-зрение активно: ✋ стоп · ✊ микрофон', 'ok');
    return true;
  }

  async _loadAI() {
    this.status('Загружаю модели зрения…', 'info');
    try {
      const mod = await Promise.race([
        import(TP_URL),
        new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 25000)),
      ]);
      const fileset = await mod.FilesetResolver.forVisionTasks(
        `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${TP_VERSION}/wasm`);
      const mk = (opts, Model, modelPath) => Model.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: modelPath, delegate: 'GPU' },
        runningMode: 'VIDEO', ...opts,
      }).catch(() => Model.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: modelPath, delegate: 'CPU' },
        runningMode: 'VIDEO', ...opts,
      }));
      const [hands, faces] = await Promise.all([
        mk({ numHands: 1, minHandDetectionConfidence: 0.5, minTrackingConfidence: 0.5 }, mod.HandLandmarker, HAND_MODEL),
        mk({ minDetectionConfidence: 0.5 }, mod.FaceDetector, FACE_MODEL),
      ]);
      this.ai = { hands, faces };
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
          this._gestures(hr && hr.landmarks && hr.landmarks[0]);
        } catch (e) {}
        try {
          const fr = this.ai.faces.detectForVideo(this.video, now);
          if (fr && fr.detections && fr.detections.length) this._face();
        } catch (e) {}
      }
      this.raf = requestAnimationFrame(step);
    };
    this.raf = requestAnimationFrame(step);
  }

  _gestures(lm) {
    if (!lm) { this._stable = { name: '', n: 0 }; return; }
    // fingertips 8,12,16,20 vs pips 6,10,14,18 (y grows downward)
    const ext = [8, 12, 16, 20].filter((tip, k) => lm[tip].y < lm[[6, 10, 14, 18][k]].y - 0.015).length;
    const name = ext >= 4 ? 'palm' : (ext === 0 ? 'fist' : '');
    if (name !== this._stable.name) this._stable = { name, n: 0 };
    else this._stable.n++;
    if (name && this._stable.n >= 7 && Date.now() > this._coolGesture) {
      this._coolGesture = Date.now() + 2800;
      this._stable.n = 0;
      if (this.onGesture) try { this.onGesture(name); } catch (e) {}
    }
  }
  _face() {
    if (Date.now() < this._coolFace) return;
    this._coolFace = Date.now() + 60000;
    if (this.onFace) try { this.onFace(); } catch (e) {}
  }
}
