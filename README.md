# JARVIS • FRIDAY • ULTRON — Marvel Level (2026)

**Лицо (камера) + Голос (wake-word) + 5 AI-движков. Agnes AI free unlimited.**

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
