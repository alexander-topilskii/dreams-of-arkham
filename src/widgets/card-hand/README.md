## CardHand

Колода активных карт игрока с поддержкой перетаскивания на карту экспедиции и контекстными действиями.

## Интерфейс карт
```ts
export type CardHandCard = {
    id: string;
    title: string;
    description?: string;
    artUrl?: string;
    cost: number;
    effect?: string;
    instanceId?: string;
};

type CardHandDropResult =
    | { status: 'success' }
    | { status: 'error'; message?: string };
```

### Методы
- `setCards(cards)` — полная перерисовка колоды (используйте `instanceId` для стабильного отображения).
- `addCard(card)` — анимированное добавление в конец и автопрокрутка к карте.
- `removeCard(id)` — плавное удаление по `instanceId` с корректировкой ленты.
- `focus()` — прокручивает панель к активной карте и подсвечивает контейнер.
- `destroy()` — снимает события и очищает/удаляет корневой элемент.

## Использование
```ts
import { CardHand, type CardHandCard } from './widgets/card-hand/card-hand';
import { CardHandController } from './widgets/card-hand/card-hand-controller';
import { GameEngineWidget } from './widgets/game-engine/game-engine';
import {
    GameEngineStore,
    MoveWithCardCommand,
    PostLogCommand,
    EndTurnCommand,
} from './widgets/game-engine/game-engine-store';

const store = new GameEngineStore(engineConfig, { initialHand });
const widget = new GameEngineWidget(document.getElementById('engine'), store);
store.initialize();

let controller: CardHandController;

const hand = new CardHand(document.getElementById('hand'), {
    onMoveCardDrop: (card, territoryId) => controller.onDrop(card, territoryId),
    onMoveCardTargetMissing: (card) => controller.onDropTargetMissing(card),
    onCardConsumed: (card) => controller.handleCardConsumed(card),
    onEndTurn: () => controller.handleEndTurn(),
});

controller = new CardHandController({ cardHand: hand, store });
controller.initialize();

store.subscribe((event) => {
    if (event.type === 'turn:ended') {
        hand.focus();
    }
});

// Прямой вызов команд также возможен
store.dispatch(new MoveWithCardCommand({ id: card.id, title: card.title, cost: card.cost }, 'street-2'));
store.dispatch(new PostLogCommand('user', 'Выберите цель.'));
store.dispatch(new EndTurnCommand());
```

Для автоматического оверлея передайте `null` в конструктор. Настройте обработчики под свою игровую логику.

## Внешний вид
Полупрозрачная панель с мягким свечением. При наведении карта подсвечивается золотом, а при перетаскивании появляется направляющая стрелка. Ошибочный сброс окрашивает карту в красный и сопровождается краткой тряской.
