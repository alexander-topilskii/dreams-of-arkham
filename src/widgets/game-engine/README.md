## Name
GameEngine

## Purpose
`GameEngine` orchestrates interactions between UI widgets by providing a central command dispatcher and chronological logs. It keeps the player state, manages placement on the Expedition Map, and records narrative versus internal system updates for future expansion of the gameplay loop.

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
- Card-like container with dark glassmorphism background (`rgba(30,41,59,0.9)` to `rgba(15,23,42,0.95)`).
- Two equal-width columns stacked responsively; each contains a title and list of log entries.
- Log entries are pill-shaped with subtle border; system log uses monospace font and muted gray color.
- Empty state shows dashed placeholder cell.
- Widget fits flex container and inherits panel padding from layout.

## Behavior
- On `initialize()` the widget computes the first territory from `mapConfig`, updates the state badge, and dispatches an `EnterLocationCommand`.
- `dispatch(command)` executes the command, applies every returned `GameEvent`, re-renders the widget, and forwards the event alongside the latest `GameViewModel` to subscribers.
- `subscribe(listener)` registers UI observers; listeners receive both discrete events (e.g. `move:success`, `move:failure`, `turn:ended`) and derived view model snapshots for rendering.
- Commands such as `EnterLocationCommand`, `MoveWithCardCommand`, `EndTurnCommand`, and `PostLogCommand` encapsulate gameplay mutations; they return `GameEvent[]` instead of mutating DOM directly.
- The engine keeps localized user/system logs inside `GameEngineState`; derived state exposes titles and counts for UI badges. `onActionsChange` still notifies external widgets about `actions:update` events.
- Widget keeps a `var(--pad)` (12px fallback) top offset to mirror CardHand spacing and clamps its height to the host panel, enabling vertical scrolling whenever logs overflow.

### Emitted events
- `log` — user or system log entry added to history.
- `actions:update` — remaining actions changed and `onActionsChange` fired.
- `location:*` / `player:place` — Expedition Map should reveal/place the investigator token.
- `move:success` / `move:failure` — result of `MoveWithCardCommand` including error messaging.
- `turn:ended` — end-of-turn summary with restored actions and event count.


## API (Props / Inputs / Outputs)
| Name | Type | Default | Description |
|------|------|---------|-------------|
| `player` | `GameEnginePlayerConfig` | — | Defines id, name, and optional token appearance for the controlled character. |
| `map` | `ExpeditionMap` | — | Map widget instance used to reveal territories and place the player token. |
| `mapConfig` | `ExpeditionMapConfig` | — | Source data for territories; used to resolve titles and initial placement. |
| `initialActions` | `number` | — | Starting action points shown in the state badge. |
| `playerCount` | `number` | `1` | Total number of investigators; управляет количеством карт событий при конце хода. |
| `eventDeck` | `EventDeck` | — | Колода событий, которую движок использует при завершении хода. |
| `onActionsChange` | `(actions: number) => void` | — | Notifies external UI when remaining actions change. |
| `initialize()` | `() => void` | — | Bootstraps the engine; safe to call once. |
| `dispatch(command)` | `(GameCommand) => GameEvent[]` | — | Executes a command, applies emitted events, and returns them for synchronous consumers. |
| `subscribe(listener)` | `(GameEventSubscriber) => () => void` | — | Registers an event/view-model listener and returns an unsubscribe handle. |
| `unsubscribe(listener)` | `(GameEventSubscriber) => void` | — | Removes a previously registered listener when the disposer is not stored. |
| `getViewModel()` | `() => GameViewModel` | — | Returns the latest derived snapshot (current location title, logs, remaining actions). |

## States and Examples
- **Initial (before initialize)**: Logs show placeholders, state badge displays `Текущая локация: неизвестно`.
- **After EnterLocationCommand**: First log is `«Имя» заходит на «Название локации»`, system log shows `enter_location:territoryId`, and state badge updates with current title.
- **No territories available**: System log receives `bootstrap: нет доступных территорий...`, placeholders remain for user log.

## Lifecycle
- Constructor injects scoped styles (once per document), clears host element, and renders static structure.
- `initialize()` should be called once after dependencies are ready (map instantiated). Subsequent calls have no effect thanks to guard.
- Destroy routine not yet implemented; removal is handled by clearing/disposing host element externally if needed.
- No external listeners registered beyond Expedition Map method calls, so no explicit cleanup required.

## Integration Example
```ts
import {
    GameEngine,
    EnterLocationCommand,
    MoveWithCardCommand,
    PostLogCommand,
    EndTurnCommand,
} from "./widgets/game-engine/game-engine";
import { ExpeditionMap } from "./widgets/expedition-map/expedition-map";

const map = new ExpeditionMap(mapContainer, mapConfig);
const engine = new GameEngine(engineRoot, {
    player,
    map,
    mapConfig,
    initialActions: 3,
    onActionsChange: (actions) => characterCard.setState({ actionPoints: actions }),
});
engine.initialize();

const unsubscribe = engine.subscribe((event, viewModel) => {
    renderEnginePanel(viewModel);
    if (event.type === 'move:failure') {
        toast(event.message);
    }
});

engine.dispatch(new EnterLocationCommand("street-2"));

const events = engine.dispatch(
    new MoveWithCardCommand({ id: card.id, title: card.title, cost: card.cost }, "street-3")
);
const failedMove = events.find((evt) => evt.type === 'move:failure');
if (failedMove) {
    notifyPlayer(failedMove.message);
}

engine.dispatch(new PostLogCommand('system', 'manual-note:expedition')); // manual log entry
engine.dispatch(new EndTurnCommand());

// Later, when tearing down the widget
unsubscribe();
```
