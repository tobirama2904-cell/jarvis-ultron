/* MARK II — central config. No secrets here, ever. */
export const APP = { name: 'LEGION', version: '18.0', build: 'legion-1' }; /*__V18_APP__*/

export const AGNES = {
  base: 'https://apihub.agnes-ai.com/v1',
  chat: 'agnes-2.5-flash',
  imgModels: ['agnes-image-2.1-flash', 'agnes-image-2.5-flash', 'agnes-image-2.0'],
  minGapMs: 3000,      // respect ~20 req/min free tier
  timeoutMs: 60000,
  maxRetries: 2,
};

export const GEO = { city: 'Душанбе', lat: 38.5598, lon: 68.787, tz: 'Asia/Dushanbe' };

export const PERSONAS = {
  jarvis: { id: 'jarvis', name: 'JARVIS', color: '#35c4ff',
    title: 'Just A Rather Very Intelligent System', rate: 1.0, pitch: 0.85,
    hello: 'Системы в норме, сэр. JARVIS к вашим услугам.' },
  friday: { id: 'friday', name: 'FRIDAY', color: '#ff9d3c',
    title: 'Female Replacement Intelligent Digital Assistant Youth', rate: 1.06, pitch: 1.15,
    hello: 'Привет, босс! FRIDAY на связи — что творим?' },
  ultron: { id: 'ultron', name: 'ULTRON', color: '#ff3b5c',
    title: 'Peace in our time', rate: 0.94, pitch: 0.7,
    hello: 'Я подключён ко всему. Задавай вопрос — но подумай дважды.' },
  vision: { id: 'vision', name: 'VISION', color: '#ffd23c',
    title: 'Worthy mind', rate: 0.98, pitch: 1.0,
    hello: 'Рад видеть вас. VISION готов помочь — спокойно и точно.' },
};
export const PERSONA_IDS = Object.keys(PERSONAS);

export const WAKE_NAMES = ['джарвис', 'jarvis', 'пятница', 'friday', 'фрайди',
  'ультрон', 'ultron', 'вижн', 'вижен', 'vision'];

export const IMG_STYLES = [
  { id: 'none', label: 'Без стиля', suffix: '' },
  { id: 'cine', label: '🎬 Кинокадр', suffix: ', cinematic film still, dramatic lighting, anamorphic, ultra detailed' },
  { id: 'holo', label: '🔷 Голография', suffix: ', glowing blue hologram HUD style, dark background, neon wireframe' },
  { id: 'real', label: '📷 Фотореализм', suffix: ', photorealistic, 85mm lens, natural light, ultra detailed' },
  { id: 'anime', label: '🌸 Аниме', suffix: ', anime style, vibrant, studio ghibli inspired, detailed' },
  { id: 'cyber', label: '🌃 Киберпанк', suffix: ', cyberpunk, neon city, rain, reflections, ultra detailed' },
  { id: 'oil', label: '🖼 Живопись', suffix: ', oil painting, masterpiece, rich brush strokes' },
];

export const WMO = { 0: 'ясно', 1: 'преимущественно ясно', 2: 'переменная облачность', 3: 'пасмурно',
  45: 'туман', 48: 'туман с изморозью', 51: 'лёгкая морось', 53: 'морось', 55: 'сильная морось',
  61: 'слабый дождь', 63: 'дождь', 65: 'ливень', 66: 'ледяной дождь', 67: 'ледяной дождь',
  71: 'слабый снег', 73: 'снег', 75: 'метель', 77: 'снежная крупа',
  80: 'ливневые дожди', 81: 'ливни', 82: 'сильные ливни', 85: 'снегопад', 86: 'сильный снег',
  95: 'гроза', 96: 'гроза с градом', 99: 'сильная гроза' };
