## Name
DraggableContainer

## Purpose
`DraggableContainer` оборачивает произвольный DOM-элемент и размещает его поверх интерфейса в виде фиксированного блока, который можно перемещать мышью или касанием. Виджет используется для выноса вспомогательных панелей (например, отладочной панели) за пределы основного макета без правки существующей разметки.

## Visual Overview
```
┌──────────────────────────────┐
│ ┌──────────────────────────┐ │
│ │  Заголовок панели        │ │
│ │  ----------------------  │ │
│ │  Контент отладочных      │ │
│ │  контролов               │ │
│ └──────────────────────────┘ │
└──────────────────────────────┘
```
- Наружная рамка: прозрачная, создаётся контейнером.
- Внутренний блок: любые стили вложенного содержимого (например, `DebugPanel`).
- Отступы: по умолчанию 24px от нижнего и правого краёв в момент появления.
- При перетаскивании курсор меняется на «grabbing».
- Состояния: `idle` (курсор `grab`), `dragging` (курсор `grabbing`).

## Behavior
- При инициализации создаёт `div` с `position: fixed`, добавляет в него переданный контент и вставляет в `document.body` (или указанный контейнер).
- Использует библиотеку `draggabilly` для обработки перемещения.
- На `dragStart` фиксирует текущие координаты, сбрасывает `bottom/right` и переводит курсор в состояние захвата.
- На `dragEnd` возвращает курсор в состояние ожидания.
- Метод `destroy` снимает обработчики перетаскивания и удаляет контейнер из DOM.

## API (Props / Inputs / Outputs)
| Name              | Type                               | Default          | Description |
|-------------------|------------------------------------|------------------|-------------|
| `content`         | `HTMLElement`                      | —                | Узел, который нужно сделать плавающим и перетаскиваемым. |
| `options`         | `DraggableContainerOptions`        | `{}`             | Дополнительные настройки контейнера. |
| `options.container` | `HTMLElement`                    | `document.body`  | Родитель, в который будет добавлен контейнер. |
| `options.initialPosition` | `DraggableContainerPosition` | `{ bottom: 24, right: 24 }` | Начальное позиционирование (top/left/right/bottom). |
| `options.containment` | `Element \| string \| boolean` | `document.body`  | Ограничение перемещения для `draggabilly`. |
| `destroy()`       | `() => void`                       | —                | Удаляет контейнер и слушатели. |

## States and Examples
- **Initial**: контейнер появляется в правом нижнем углу (24px от краёв).
- **Dragging**: при зажатии курсор меняется на `grabbing`, координаты фиксируются, элемент двигается вслед за курсором.
- **Custom position**: если передать `initialPosition`, контейнер рендерится в указанных координатах.
- **Destroyed**: после вызова `destroy` DOM-узел удаляется, повторное использование требует новой инициализации.

## Lifecycle
- **Init**: конструктор создаёт обёртку, применяет стартовые координаты и инициализирует `Draggabilly`.
- **Update**: компонент не управляет содержимым, однако вложенные элементы могут обновляться самостоятельно.
- **Destroy**: вызов `destroy` очищает `Draggabilly` и удаляет контейнер.
- **Dependencies**: пакет `draggabilly` и его типы (`@types/draggabilly`).

## Integration Example
```ts
import { DraggableContainer } from "./widgets/draggable-container/draggable-container";
import { DebugPanel } from "./widgets/debug-panel/debug-panel";

const debugPanel = new DebugPanel(null, { title: "Debug панель" });
new DraggableContainer(debugPanel.element, {
    initialPosition: { bottom: 24, right: 24 },
});
```
