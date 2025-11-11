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
- `dispatch(command)` executes the command in FIFO order, appending it to history and re-rendering logs and the state badge.
- `EnterLocationCommand` reveals the specified territory on the Expedition Map, places the player token, updates engine state, and appends both narrative and system log entries.
- `attemptMoveWithCard(card, territoryId)` validates adjacency and remaining actions, spends the cost, moves the character, and logs success or a localized failure message.
- The state badge displays both the current location title and the remaining action points; `onActionsChange` notifies external UI (e.g., CharacterCard) about updates.
- `logUserMessage` and `logSystemMessage` append entries for later rendering; logs display from oldest to newest. When no entries exist a dashed placeholder appears instead of empty list items.
- `refresh()` forces a re-render without executing a command—useful after manual `logUserMessage` calls.
- When no entries exist a dashed placeholder appears instead of empty list items.
- Widget keeps a `var(--pad)` (12px fallback) top offset to mirror CardHand spacing and clamps its height to the host panel, enabling vertical scrolling whenever logs overflow.


## API (Props / Inputs / Outputs)
| Name | Type | Default | Description |
|------|------|---------|-------------|
| `player` | `GameEnginePlayerConfig` | — | Defines id, name, and optional token appearance for the controlled character. |
| `map` | `ExpeditionMap` | — | Map widget instance used to reveal territories and place the player token. |
| `mapConfig` | `ExpeditionMapConfig` | — | Source data for territories; used to resolve titles and initial placement. |
| `initialActions` | `number` | — | Starting action points shown in the state badge. |
| `onActionsChange` | `(actions: number) => void` | — | Notifies external UI when remaining actions change. |
| `initialize()` | `() => void` | — | Bootstraps the engine; safe to call once. |
| `dispatch(command)` | `(GameCommand) => void` | — | Executes a command and records it in the history. |
| `logUserMessage(message)` | `(string) => void` | — | Adds a narrative log entry; typically called by commands. |
| `logSystemMessage(message)` | `(string) => void` | — | Adds an internal/system log entry. |
| `setCurrentLocation(id)` | `(string) => void` | — | Stores identifier of the current territory. |
| `revealLocation(id)` | `(string) => void` | — | Reveals (flips) the territory on the Expedition Map. |
| `placePlayer(id)` | `(string) => void` | — | Places the player token on the map territory. |
| `attemptMoveWithCard(card, territoryId)` | `(MoveCardDescriptor, string) => MoveAttemptResult` | — | Validates and resolves a move card play, logging success or failure. |
| `refresh()` | `() => void` | — | Forces immediate re-render of logs and badge without executing a command. |

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
import { GameEngine, EnterLocationCommand } from "./widgets/game-engine/game-engine";
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

// Commands still work as before
engine.dispatch(new EnterLocationCommand("street-2"));

// Move cards can call the helper directly
const result = engine.attemptMoveWithCard({ id: card.id, title: card.title, cost: card.cost }, "street-3");
if (!result.success) {
    engine.logUserMessage(result.message);
    engine.refresh();
}
```
