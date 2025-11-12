# CardHand

Интерактивный виджет руки игрока с поддержкой drag&drop для карт перемещения.

## Возможности
- Горизонтальная лента карточек с липким позиционированием и навигацией колесом, свайпами и стрелками.
- Индикаторы переполнения (градиенты, стрелки, счетчик страниц) и автоматическое центрирование при малом количестве карт.
- Золотое подсвечивание при наведении и мягкие анимации появления/исчезновения карт.
- Перетаскивание карт с эффектом `move`: появляется направленная стрелка, карта «поднимается», падение вне допустимых целей подсвечивает ошибку и встряхивает карту.
- Коллбэки `onMoveCardDrop`, `onMoveCardDropFailure`, `onMoveCardTargetMissing`, `onCardConsumed` и `onViewportChange` для синхронизации с игровым движком и другими модулями.
- Кнопка «Закончить ход» с коллбэком `onEndTurn`, передающим управление игровому движку.
- Поддержка дубликатов благодаря `instanceId`, который можно передать вручную или оставить автогенерацию.

## API
```ts
new CardHand(root?: HTMLElement | null, options?: {
    cards?: CardHandCard[];
    height?: number;
    cardWidth?: number;
    gap?: number;
    translucent?: boolean;
    enableTouchInertia?: boolean;
    onViewportChange?: (viewport: { start: number; end: number }) => void;
    onMoveCardDrop?: (card: CardHandCard, territoryId: string) => CardHandDropResult | Promise<CardHandDropResult>;
    onMoveCardDropFailure?: (card: CardHandCard, territoryId: string, message?: string) => void;
    onMoveCardTargetMissing?: (card: CardHandCard) => void;
    onCardConsumed?: (card: CardHandCard) => void;
    onEndTurn?: () => void | Promise<void>;
})

type CardHandCard = {
    id: string;
    title: string;
    description: string;
    cost: number;
    effect: 'move' | 'attack' | 'hide' | 'search';
    artUrl?: string;
    instanceId?: string;
}

type CardHandDropResult =
    | { status: 'success' }
    | { status: 'error'; message?: string };
```

### Методы
- `setCards(cards)` — полная перерисовка колоды (используйте `instanceId` для стабильного отображения).
- `addCard(card)` — анимированное добавление в конец и автоматическое пролистывание к карте.
- `removeCard(id)` — плавное удаление по `instanceId` с корректировкой ленты.
- `destroy()` — снимает события и очищает/удаляет корневой элемент.

## Использование
```ts
import { CardHand, type CardHandCard, type CardHandDropResult } from './widgets/card-hand/card-hand';
import { GameEngine } from './widgets/game-engine/game-engine';

const engine = new GameEngine(...);
const cards: CardHandCard[] = [...];

const hand = new CardHand(document.getElementById('hand'), {
    cards,
    onMoveCardDrop: (card, territoryId): CardHandDropResult => {
        const result = engine.attemptMoveWithCard({ id: card.id, title: card.title, cost: card.cost }, territoryId);
        return result.success ? { status: 'success' } : { status: 'error', message: result.message };
    },
    onMoveCardTargetMissing: (card) => engine.logUserMessage(`Выберите локацию для «${card.title}».`),
    onCardConsumed: (card) => removeFromInventory(card.instanceId),
});
```

Для автоматического оверлея передайте `null` в конструктор. Функция `removeFromInventory` — условный пример, обновите ее под свою игровую логику.

## Внешний вид
Полупрозрачная панель с мягким свечением. При наведении карта подсвечивается золотом, а при перетаскивании появляется направляющая стрелка. Ошибочный сброс окрашивает карту в красный и сопровождается краткой тряской.
