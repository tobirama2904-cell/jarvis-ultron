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

## V14 — Wave-1 (10.09.2026): Core engine 2.0
- Модули: `index.html` + `js/core.js` (движок) + `js/app.js` (приложение)
- Очередь 18 RPM + ретраи, стриминг чата, история диалога, характеры персон
- Кнопка «🔍 Всё» (самодиагностика), индикатор движка, лог-панель (клик по логу)
- PWA: локальные иконки, manifest, service worker (сеть-первая)
- Безопасность: захардкоженный ключ удалён из кода
- Фикс: sticky-вкладки перекрывали чат, дубли функций, compressImage/sendAnalysisChat

## V15 — Waves 2-6 MEGA (10.09.2026)
- Мозг: function-calling tools (время/погода/поиск/кальк/курсы/факты/todo/напоминания), локальный роутер 0 RPM, память-факты, совет трёх в чате, мультиязык
- Голос: непрерывный микрофон + live-транскрипт, WAKE на 3 имени, режим диалога 9с, анти-эхо, русские голоса для русского текста, кнопка ⏹
- Камера: убран camera_utils (фикс возврата на фронталку), свой RAF-цикл рук, FaceID-lite (видит лицо → здоровается), жесты ✋ стоп / ✊ wake
- Творец: стили картинок, img2img-правки, галерея (скачать/вариация/удалить), кино-сториборд (сценарий→3 кадра→озвучка), аватар-диктор
- Польза: утренний брифинг, напоминания с голосом, новости с пересказом, переводчик, экспорт чата, быстрые чипы
- Дизайн: STARK-загрузка, звуки интерфейса, виджеты (погода/курс/часы), кино-режим, полный экран, тинт орба под персону, пульс при речи
