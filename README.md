# JARVIS • FRIDAY • ULTRON — Marvel Level (2026)

**Лицо (камера) + Голос (wake-word) + 5 AI-движков. Agnes AI free unlimited.**

### V14 — реальные камера/голос (2026-09-10)
- **Флип камеры исправлен**: убран MediaPipe camera_utils (открывал второй поток с фронталкой и откатывал заднюю). Один поток, каскад constraints, быстрый двойной флип не теряется.
- **WAKE по-настоящему работает**: свежий SpeechRecognition на каждый цикл (Android рвёт continuous — chromium 40324711), авто-рестарты с backoff, wake-слова всех троих («Джарвис/Пятница/Ультрон» + вариации), пауза микрофона на время речи JARVIS (анти-эхо), команда «стоп» глушит голос.
- **TTS**: русские фразы → русский голос (было — en-голос молчал/каша), длинные фразы не рубятся 9-сек таймаутом.
- Three.js r160→r149 (r160 тянул несуществующий GLTFLoader → белый Holo-Sun), service worker сеть-первая для HTML (обновления доезжают на телефон), утёкший API-ключ удалён, PWA-иконки локальные.

### Режимы
- **JARVIS** — британский дворецкий, синий неон
- **FRIDAY** — ирландская, оранжевый
- **ULTRON** — красный, холодный

### AI Стек (проверено)
| Движок | Лимит без ключа | URL |
|---|---|---|
| **Agnes AI** `agnes-2.0-flash` | **бесплатно indefinite, RPM 20, 256K контекст** + image 4K + video | `https://apihub.agnes-ai.com/v1` |
| **Puter.js** | unlimited user-pays | `js.puter.com/v2` |
| **Kilo Free** | 200 req/час/IP | `api.kilo.ai` |
| **OVH** | 2 RPM/IP EU | `oai.endpoints.kepler.ai` |
| **Pollinations** | 1 req/15s | `text.pollinations.ai` |
| **Offline** | ∞ | — |

Agnes — единственная full-modal free API (текст+картинка+видео) с 1 июня 2026, 4T запросов за неделю. Нужен ключ с `platform.agnes-ai.com` → вставь справа в JARVIS → сразу заработает. Без ключа — fallback на остальных.

### Фишки
- **Holo-Orb** — Three.js/canvas, drag rotate, scroll zoom, пульс при речи
- **Face** — камера + скан-рамка, HUD
- **Voice** — wake-word "Джарвис/Пятница/Ультрон", STT Web Speech, TTS Puter + браузер
- **Генерация**: картинки (Agnes/Pollinations), видео (Agnes Video 2.0 async)
- **Tools**: погода wttr.in, поиск DuckDuckGo, todo, время Душанбе

### Деплой
Уже настроен GitHub Pages (branch main). Просто `git push` → https://tobirama2904-cell.github.io/jarvis-ultron/
