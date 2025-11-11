# CardHand

Интерактивный виджет для отображения и управления картами игрока.

## Возможности
- Горизонтальная лента карт с «прилипанием» к центру и поддержкой мыши, клавиатуры и тача (инерция, свайпы, колесо).
- Индикаторы переполнения (градиенты, стрелки, прогресс при >20 карт) и адаптивное центрирование при 0–4 картах.
- Поддержка одиночного и множественного выбора: клик, `Shift`, `Ctrl/Cmd`, рамка выделения, долгий тап + свайп.
- Анимации появления/удаления карт, hover-эффекты, золотое подсвечивание выбранных карт.
- События `onSelectionChange` и `onViewportChange` для синхронизации с родительскими модулями.

## API
```ts
new CardHand(root?: HTMLElement | null, options?: {
    cards?: CardHandCard[]
    height?: number
    cardWidth?: number
    gap?: number
    translucent?: boolean
    enableTouchInertia?: boolean
    onSelectionChange?: (ids: string[]) => void
    onViewportChange?: (viewport: { start: number; end: number }) => void
})

type CardHandCard = {
    id: string
    title: string
    power: number
    health: number
    effect?: string
    artUrl?: string
}
```

### Методы
- `setCards(cards)` — полная перерисовка колоды.
- `addCard(card)` — анимированное добавление в конец и автоцентрирование.
- `removeCard(id)` — анимация вылета и пересчёт выделения.
- `destroy()` — снимает события и очищает/удаляет корень.

## Использование
```ts
import { CardHand, type CardHandCard } from './widgets/card-hand/card-hand'

const hand = new CardHand(document.getElementById('hand'), {
    cards,
    onSelectionChange: (ids) => console.log(ids),
})
```

Для автоматического оверлея передайте `null` в конструктор.

## Внешний вид
Полупрозрачная панель с темным фоном и мягким свечением; выбранные карты подсвечиваются золотом и «поднимаются». На узких экранах карточки уменьшаются, а свайпы становятся основным способом навигации.
