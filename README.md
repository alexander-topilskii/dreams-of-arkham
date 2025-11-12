![/docs/banner.png](/docs/banner.png)
# Dreams of Arkham

Веб-адаптация карточной игры в духе лавкрафтианского ужаса.  

## 🚀 Запуск
```bash
npm install
npm run dev
```

## Demo
https://alexander-topilskii.github.io/dreams-of-arkham/


## Инициализация колоды событий
Используйте helper движка, чтобы сформировать стартовое состояние колоды из JSON-конфигурации и передать его в `GameEngineStore`.

```ts
import eventDeckSource from './data/event-deck.json';
import { GameEngineStore, createInitialDeckStateFromConfig } from './widgets/game-engine/game-engine-store';
import type { EventDeckConfig } from './widgets/event-deck/event-deck';

const eventDeckConfig = eventDeckSource as EventDeckConfig;
const initialDeckState = createInitialDeckStateFromConfig(eventDeckConfig);

const store = new GameEngineStore({
    player,
    mapConfig,
    initialActions: 3,
    initialDeckState,
});
```


## tools

https://chatgpt.com/codex
https://www.freepik.com/ai/icon-generator?utm_source=chatgpt.com
https://www.recraft.ai/project/02c21332-eab9-4966-8604-5fc0c5982d2b

