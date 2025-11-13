## Name
CardHand

## Purpose
CardHand отображает вертикальную колоду карт игрока в верхнем левом углу основного макета. Виджет показывает текущее содержимое руки, счётчики карт в колоде и сбросе, а также предоставляет управляющие элементы для завершения хода и навигации по длинному списку карт.

## Visual Overview
```
┌───────────────────────────────────────┐
│ Колода: 12   Сброс: 3        2 / 5    │
│ ┌───────────────────────────────────┐ │
│ │┌──────────────┐                  │ │
│ ││  Карта 1     │  (высокая карта) │ │
│ │└──────────────┘                  │ │
│ │┌──────────────┐                  │ │
│ ││  Карта 2     │  (hover glow)    │ │
│ │└──────────────┘                  │ │
│ │┌──────────────┐                  │ │
│ ││  Карта 3     │  (drag arrow)    │ │
│ │└──────────────┘                  │ │
│ └───────────────────────────────────┘ │
│   ↑ прокрутка   ↓ прокрутка           │
└───────────────────────────────────────┘
```
- Контейнер: полупрозрачная панель с мягким свечением и радиусом 18 px.
- Карты: 3D-оформление с артом, золотым свечением при наведении, чипом стоимости снизу.
- Навигация: полупрозрачные кнопки ↑/↓ и затенение сверху/снизу при доступной прокрутке.
- Пустое состояние: пульсирующая подпись «Рука пуста».

## Behavior
- Инициализация очищает переданный контейнер и вставляет собственные стили один раз на страницу.
- Колода выстраивается вертикальной колонкой; прокрутка осуществляется колесом, свайпом или кнопками ↑/↓.
- При пролистывании отображается текущая «страница» (видимое количество карт) в правой части заголовка.
- Карты с эффектом `move` можно перетаскивать на экспедиционную карту; при успешном применении карта удаляется из руки.
- `setDeckInfo` обновляет чипы с количеством карт в стопке и сбросе, пустые значения подсвечиваются приглушённо.
- Кнопка «Закончить ход» отключается и показывает индикатор выполнения на время асинхронного обработчика.
- Пустой список карт переключает виджет в режим заглушки и озвучивает состояние через `aria-label`.
- При разрушении (`destroy`) виджет снимает обработчики событий, останавливает таймеры и, если владеет корнем, удаляет его из DOM.

## API (Props / Inputs / Outputs)
| Name | Type | Default | Description |
|------|------|---------|-------------|
| `root` | `HTMLElement \| null \| undefined` | — | Контейнер для рендеринга. При `null` создаётся плавающий оверлей. |
| `options.cards` | `CardHandCard[]` | `[]` | Начальный набор карт. |
| `options.height` | `number` | `300` | Минимальная высота области прокрутки. |
| `options.cardWidth` | `number` | `336` | Максимальная ширина одной карты. |
| `options.cardHeight` | `number` | `Math.floor(cardWidth * 1.4)` | Базовая высота карты для расчёта шага прокрутки. |
| `options.gap` | `number` | `10` | Отступ между картами. |
| `options.translucent` | `boolean` | `true` | Включает размытие фона панели. |
| `options.enableTouchInertia` | `boolean` | `true` | Включает инерцию после свайпа. |
| `options.onMoveCardDrop` | `(card, territoryId) => CardHandDropResult \| Promise<CardHandDropResult>` | — | Обработчик успешного «движения» карты на территорию. |
| `options.onMoveCardDropFailure` | `(card, territoryId, message?) => void` | — | Ошибочный сброс на локацию. |
| `options.onMoveCardTargetMissing` | `(card) => void` | — | Карта отпущена вне локации. |
| `options.onCardConsumed` | `(card) => void` | — | Вызывается при удалении карты после успешного эффекта. |
| `options.onEndTurn` | `() => void \| Promise<void>` | — | Колбек кнопки завершения хода. |
| `options.onViewportChange` | `(viewport) => void` | — | Оповещает об индексе видимых карт. |
| `setCards(cards)` | `(CardHandCard[]) => void` | — | Полная замена содержимого руки. |
| `addCard(card)` | `(CardHandCard) => void` | — | Анимированное добавление карты в конец. |
| `removeCard(id)` | `(string) => void` | — | Удаление карты по `instanceId`. |
| `setDeckInfo(info)` | `(CardHandDeckInfo) => void` | — | Обновление счётчиков колоды/сброса. |
| `focus()` | `() => void` | — | Перевод фокуса на область карт. |
| `destroy()` | `() => void` | — | Очистка ресурсов и DOM. |

## States and Examples
- **Normal**: Несколько карт, часть из которых видна. Навигационные кнопки и затенение активны, прогресс показывает текущую страницу.
- **Overflow**: При большом количестве карт список прокручивается, а `onViewportChange` сообщает диапазон индексов.
- **Empty**: После удаления всех карт показывается подпись «Рука пуста», кнопки навигации скрыты, счётчики могут показывать `0`.
- **Dragging**: Карта с эффектом `move` при удержании показывает стрелку-направление; при ошибке карта встряхивается красной рамкой.

## Lifecycle
- **Initialize**: создать экземпляр `CardHand`, передать контейнер и обработчики. Виджет подготовит разметку, повесит слушатели колеса, клавиатуры, тач-свайпов и drag/drop.
- **Update**: использовать `setCards`, `addCard`, `removeCard`, `setDeckInfo`, `focus` и обработчики событий для синхронизации с игровым движком.
- **Destroy**: вызывать `destroy()` при удалении панели, чтобы снять наблюдатели (`ResizeObserver` или обработчик `resize`) и очистить DOM.
- **Dependencies**: Чистый DOM+TypeScript, без внешних библиотек. Стили инжектируются один раз.

## Integration Example
```ts
import cardsSource from "../data/cards.json";
import { CardHand, type CardHandCard } from "../widgets/card-hand/card-hand";
import { CardHandController } from "../widgets/card-hand/card-hand-controller";

const handRoot = document.getElementById("hand-panel");
const initialCards = (cardsSource as { initialDeck: CardHandCard[] }).initialDeck.slice(0, 5);

const hand = new CardHand(handRoot, {
    cards: initialCards,
    onMoveCardDrop: (card, territoryId) => controller.onDrop(card, territoryId),
    onMoveCardTargetMissing: (card) => controller.onDropTargetMissing(card),
    onCardConsumed: (card) => controller.handleCardConsumed(card),
    onMoveCardDropFailure: (card, territoryId, message) =>
        controller.onDropFailure(card, territoryId, message),
    onEndTurn: () => controller.handleEndTurn(),
});

const controller = new CardHandController({ cardHand: hand, store });
controller.initialize();
```
