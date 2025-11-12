## Name
GameEngineWidget & GameEngineStore

## Purpose
`GameEngineStore` хранит игровое состояние и обрабатывает команды, генерируя события для остальных виджетов. `GameEngineWidget` —
чистый визуальный слой: он подписывается на стор, отображает derived `GameViewModel` и не мутирует данные напрямую. Разделение
позволяет переиспользовать механику движка без DOM и упрощает тестирование/отладку.

## Visual Overview
```
┌───────────────────────────────┐
│ Игровой движок      Локация … │
├───────────────────────────────┤
│ Хроники
│ • {player text log item}
│ • …
│                               │
│ Системный журнал              │
│ • enter_location:street-1     │
└───────────────────────────────┘
```
- Card-like контейнер с градиентом (`rgba(30,41,59,0.9)` → `rgba(15,23,42,0.95)`), закруглениями и глубокой тенью.
- Две равные колонки, каждая содержит заголовок и список логов; сетка адаптивна.
- Элементы лога — пилюли с тонкой рамкой; системные сообщения используют моноширинный шрифт и приглушённый цвет.
- Пустые состояния отображают пунктирную карточку-заглушку.
- Виджет заполняет родительский flex-контейнер, а `max-height` и прокрутка позволяют просматривать длинные журналы.

## Behavior
### GameEngineStore
- Создаётся с `GameEngineConfig` (игрок, конфигурация карты, снимок колоды событий, счётчик игроков) и опциями руки
  (`initialHand`, фабрика debug-карт).
- `initialize()` вычисляет стартовую территорию и диспатчит `EnterLocationCommand`, уведомляя всех подписчиков.
- `dispatch(command)` выполняет `GameCommand`/`GameEngineStoreCommand`, применяет каждое `GameEvent`, обновляет сторадж и уведомляет
  подписчиков свежим `GameViewModel`.
- `subscribe(listener)` мгновенно отправляет `state:sync` с текущим вью-моделом и возвращает disposer.
- Формирует срезы `map` и `deck` во `viewModel` (открытые территории, размещённые персонажи, стопки событий); UI-адаптеры подписываются
  на стор и синхронизируют `ExpeditionMap` и `EventDeck` с опубликованными данными.
- Манипулирует колодой исключительно через команды: `TriggerEventDeckCommand`, `RevealEventsCommand`, `DiscardRevealedEventCommand`,
  `ReshuffleEventDeckCommand`. Каждая из них использует утилиты `drawCardsFromDeck` и `shuffleCards`, чтобы применять мутации через `dispatch`.

### GameEngineWidget
- В конструкторе монтирует стили (один раз на документ), создаёт DOM-структуру и подписывается на стор.
- При каждом событии перерисовывает заголовок состояния, пользовательский и системный журналы.
- `destroy()` отменяет подписку, не оставляя слушателей.

### Emitted events
- `log` — добавляет запись в пользовательский или системный журнал.
- `actions:update` — обновляет очки действий.
- `location:*` / `player:place` — изменяют срез карты (раскрытие, размещение, установка текущей локации).
- `eventDeck:*` — синхронизируют состояние колоды событий и сообщают об отладочных действиях (`eventDeck:discarded` публикуется
  при переносе карты из активных событий в сброс).
- `move:success` / `move:failure` — результат `MoveWithCardCommand` вместе с сообщением об ошибке.
- `turn:ended` — сводка конца хода с восстановленными очками действий и количеством вытянутых событий.
- `card:added` / `card:consumed` / `hand:sync` — синхронизация руки (используется `CardHandController`).

## API (Store)
| Name | Type | Default | Description |
|------|------|---------|-------------|
| `player` | `GameEnginePlayerConfig` | — | ID, имя и визуальные атрибуты фишки игрока. |
| `mapConfig` | `ExpeditionMapConfig` | — | Исходные данные территорий; используются для поиска заголовков и связей. |
| `initialDeckState` | `EventDeckState` | — | Начальный снимок колоды событий (стопка, раскрытые, сброс и сообщение статуса). |
| `initialActions` | `number` | — | Стартовое количество действий. |
| `playerCount` | `number` | `1` | Число следователей — определяет, сколько событий вытягивается в конце хода. |
| `initialHand` | `HandCardDefinition[]` | `[]` | (опция стора) Начальная рука игрока. |
| `createDebugCard` | `() => HandCardDefinition \| undefined` | — | (опция стора) Фабрика отладочных карт. |
| `initialize()` | `() => void` | — | Одноразовая инициализация (безопасно вызывать повторно). |
| `dispatch(command)` | `(GameCommand \| GameEngineStoreCommand) => GameEvent[]` | — | Выполняет команду и возвращает сгенерированные события. |
| `subscribe(listener)` | `(GameEventSubscriber) => () => void` | — | Регистрирует подписчика и возвращает disposer. |
| `getViewModel()` | `() => GameViewModel` | — | Последний снимок состояния с вычисленным заголовком и рукой. |

## API (Widget)
| Name | Type | Description |
|------|------|-------------|
| `constructor(root, store)` | `(HTMLElement \| null \| undefined, GameEngineStore)` | Создаёт UI, подписывается на стор и сразу рендерит `state:sync`. |
| `element` | `HTMLElement` | Корневой DOM-узел виджета. |
| `destroy()` | `() => void` | Снимает подписку и освобождает ресурсы. |

## States and Examples
- **Initial**: до `initialize()` заголовок показывает `Текущая локация: неизвестно`, оба списка содержат пустые заглушки.
- **После EnterLocationCommand**: пользовательский лог — `«Имя» заходит на …`, системный — `enter_location:territoryId`, состояние
  отображает актуальную локацию и очки действий.
- **Нет территорий**: стор публикует `bootstrap: нет доступных территорий…` и оставляет заглушки в списках.

## Lifecycle
1. Создайте `GameEngineStore`, передав игрока, конфигурацию карты, снимок колоды событий и зависимости.
2. Подключите адаптеры (`GameEngineMapAdapter`, `GameEngineEventDeckAdapter`), чтобы синхронизировать стор с виджетами карты и колоды.
3. Создайте `GameEngineWidget`, передав DOM-узел и стор — он сразу подпишется и отрисует `state:sync`.
4. Вызовите `store.initialize()` после того, как виджет и остальные слушатели готовы.
5. Диспатчите команды (`MoveWithCardCommand`, `EndTurnCommand`, `PostLogCommand`, `AddDebugCardCommand`, …) через стор.
6. При демонтаже вызовите `widget.destroy()`, disposer из `subscribe` и `destroy()` адаптеров, если они были сохранены.

## Integration Example
```ts
import { GameEngineWidget } from './widgets/game-engine/game-engine';
import {
    GameEngineStore,
    EnterLocationCommand,
    MoveWithCardCommand,
    PostLogCommand,
    EndTurnCommand,
    TriggerEventDeckCommand,
    RevealEventsCommand,
    DiscardRevealedEventCommand,
    type EventDeckState,
} from './widgets/game-engine/game-engine-store';
import { GameEngineMapAdapter } from './widgets/game-engine/game-engine-map-adapter';
import { GameEngineEventDeckAdapter } from './widgets/game-engine/game-engine-event-deck-adapter';
import { ExpeditionMap } from './widgets/expedition-map/expedition-map';
import { EventDeck } from './widgets/event-deck/event-deck';

const map = new ExpeditionMap(mapContainer, mapConfig);
const deck = new EventDeck(deckContainer, deckConfig);
const initialDeckState: EventDeckState = {
    draw: deckConfig.draw,
    drawPile: deckConfig.cards.slice(),
    revealed: [],
    discardPile: [],
};
const store = new GameEngineStore(
    {
        player,
        mapConfig,
        initialActions: 3,
        initialDeckState,
    },
    { initialHand },
);
const mapAdapter = new GameEngineMapAdapter(store, map);
const deckAdapter = new GameEngineEventDeckAdapter(store, deck);
const widget = new GameEngineWidget(engineRoot, store);

deck.setIntentHandlers({
    onTrigger: () => store.dispatch(new TriggerEventDeckCommand()),
    onReveal: (count) => store.dispatch(new RevealEventsCommand(count)),
    onDiscard: (cardId) => store.dispatch(new DiscardRevealedEventCommand(cardId)),
});

store.initialize();

const unsubscribe = store.subscribe((event, viewModel) => {
    renderEnginePanel(viewModel);
    if (event.type === 'move:failure') {
        toast(event.message);
    }
});

store.dispatch(new EnterLocationCommand('street-2'));
store.dispatch(
    new MoveWithCardCommand({ id: card.id, title: card.title, cost: card.cost }, 'street-3'),
);
store.dispatch(new PostLogCommand('system', 'manual-note:expedition'));
store.dispatch(new EndTurnCommand());

// Later
mapAdapter.destroy();
deckAdapter.destroy();
unsubscribe();
widget.destroy();
```
