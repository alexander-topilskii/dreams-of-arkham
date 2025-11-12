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
- Создаётся с `GameEngineConfig` (карта, игрок, колода событий, колбэк `onActionsChange`) и опциями руки (`initialHand`, фабрика
  debug-карт).
- `initialize()` вычисляет стартовую территорию и диспатчит `EnterLocationCommand`, уведомляя всех подписчиков.
- `dispatch(command)` выполняет `GameCommand`/`GameEngineStoreCommand`, применяет каждое `GameEvent`, обновляет сторадж и уведомляет
  подписчиков свежим `GameViewModel`.
- `subscribe(listener)` мгновенно отправляет `state:sync` с текущим вью-моделом и возвращает disposer.
- Обрабатывает все обращения к `ExpeditionMap` и `EventDeck`, поэтому UI не зависит от побочных эффектов.

### GameEngineWidget
- В конструкторе монтирует стили (один раз на документ), создаёт DOM-структуру и подписывается на стор.
- При каждом событии перерисовывает заголовок состояния, пользовательский и системный журналы.
- `destroy()` отменяет подписку, не оставляя слушателей.

### Emitted events
- `log` — добавляет запись в пользовательский или системный журнал.
- `actions:update` — обновляет очки действий и триггерит `onActionsChange`.
- `location:*` / `player:place` — эффекты для Expedition Map (раскрытие, размещение, установка текущей локации).
- `move:success` / `move:failure` — результат `MoveWithCardCommand` вместе с сообщением об ошибке.
- `turn:ended` — сводка конца хода с восстановленными очками действий и количеством вытянутых событий.
- `card:added` / `card:consumed` / `hand:sync` — синхронизация руки (используется `CardHandController`).

## API (Store)
| Name | Type | Default | Description |
|------|------|---------|-------------|
| `player` | `GameEnginePlayerConfig` | — | ID, имя и визуальные атрибуты фишки игрока. |
| `map` | `ExpeditionMap` | — | Экземпляр карты, на который стор накладывает эффекты событий. |
| `mapConfig` | `ExpeditionMapConfig` | — | Исходные данные территорий; используются для поиска заголовков и связей. |
| `initialActions` | `number` | — | Стартовое количество действий. |
| `playerCount` | `number` | `1` | Число следователей — определяет, сколько событий вытягивается в конце хода. |
| `eventDeck` | `EventDeck` | — | Колода событий; стор безопасно обрабатывает отсутствие.
| `onActionsChange` | `(actions: number) => void` | — | Колбэк, вызываемый при каждом `actions:update`. |
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
1. Создайте `GameEngineStore`, передав карту, конфигурацию и зависимости.
2. Создайте `GameEngineWidget`, передав DOM-узел и стор — он сразу подпишется и отрисует `state:sync`.
3. Вызовите `store.initialize()` после того, как виджет и остальные слушатели готовы.
4. Диспатчите команды (`MoveWithCardCommand`, `EndTurnCommand`, `PostLogCommand`, `AddDebugCardCommand`, …) через стор.
5. При демонтаже вызовите `widget.destroy()` и disposer из `subscribe`, если он был сохранён.

## Integration Example
```ts
import { GameEngineWidget } from './widgets/game-engine/game-engine';
import {
    GameEngineStore,
    EnterLocationCommand,
    MoveWithCardCommand,
    PostLogCommand,
    EndTurnCommand,
} from './widgets/game-engine/game-engine-store';
import { ExpeditionMap } from './widgets/expedition-map/expedition-map';

const map = new ExpeditionMap(mapContainer, mapConfig);
const store = new GameEngineStore(
    {
        player,
        map,
        mapConfig,
        initialActions: 3,
        eventDeck,
        onActionsChange: (actions) => characterCard.setState({ actionPoints: actions }),
    },
    { initialHand },
);
const widget = new GameEngineWidget(engineRoot, store);

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
unsubscribe();
widget.destroy();
```
