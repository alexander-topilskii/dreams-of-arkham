
type LayoutOptions = {
    spreadDeg?: number;   // общий угол веера
    radius?: number;      // радиус дуги
    maxTilt?: number;     // максимальный наклон в градусах
};

const hand = document.getElementById("hand") as HTMLElement;

function layoutHand(container: HTMLElement, opts: LayoutOptions = {}) {
    const cards = Array.from(container.querySelectorAll<HTMLElement>(".card"));
    const n = cards.length;
    if (n === 0) return;

    const rect = container.getBoundingClientRect();
    const spread = opts.spreadDeg ?? Math.min(150 + n * 6, 70); // адаптивный веер
    const radius = opts.radius ?? Math.max(rect.width * 0.9, 320);
    const maxTilt = opts.maxTilt ?? 18;

    // углы от -spread/2 до +spread/2
    const start = -spread / 2;
    const step = n > 1 ? spread / (n - 1) : 0;

    cards.forEach((card, i) => {
        const angle = start + i * step;
        const tilt = (angle / (spread / 2)) * maxTilt; // чуть сильнее к краям
        const y = -Math.abs(angle) * 0.6; // кончики чуть ниже в центре

        card.style.zIndex = String(100 + i);
        card.style.transform = `rotate(${0}deg) translateY(${100}px) translateX(${i * 100}px) rotate(${0}deg)`;
    });
}

// Drag & drop по индексу
let dragState:
    | null
    | {
    el: HTMLElement;
    startX: number;
    startIndex: number;
    ghost?: HTMLElement;
} = null;

function currentOrder(): HTMLElement[] {
    return Array.from(hand.querySelectorAll<HTMLElement>(".card"));
}

function setOrder(newOrder: HTMLElement[]) {
    newOrder.forEach((el) => hand.appendChild(el));
    layoutHand(hand);
}

function makeGhost(el: HTMLElement): HTMLElement {
    const ghost = el.cloneNode(true) as HTMLElement;
    ghost.style.pointerEvents = "none";
    ghost.style.position = "fixed";
    ghost.style.transform = "none";
    ghost.style.translate = "0 0";
    ghost.style.opacity = "0.9";
    ghost.style.left = "0";
    ghost.style.top = "0";
    ghost.style.zIndex = "9999";
    ghost.style.width = getComputedStyle(el).width;
    ghost.style.height = getComputedStyle(el).height;
    document.body.appendChild(ghost);
    return ghost;
}

function onPointerDown(e: PointerEvent) {
    const target = (e.target as HTMLElement).closest(".card") as HTMLElement | null;
    if (!target) return;

    target.setPointerCapture(e.pointerId);
    target.classList.add("is-selected");
    dragState = { el: target, startX: e.clientX, startIndex: currentOrder().indexOf(target) };
    dragState.ghost = makeGhost(target);
    updateGhost(e);
}

function updateGhost(e: PointerEvent) {
    if (!dragState?.ghost) return;
    const g = dragState.ghost;
    g.style.translate = `${e.clientX - g.clientWidth / 2}px ${e.clientY - g.clientHeight / 2}px`;
}

function onPointerMove(e: PointerEvent) {
    if (!dragState) return;
    updateGhost(e);

    // Определим потенциальную позицию вставки по X
    const order = currentOrder();
    const handRect = hand.getBoundingClientRect();
    const relX = e.clientX - handRect.left;
    const segment = handRect.width / Math.max(order.length, 1);
    let insertIndex = Math.min(order.length - 1, Math.max(0, Math.floor(relX / segment)));

    // Если курсор правее центра сегмента — ставим после
    const centerX = insertIndex * segment + segment / 2;
    if (relX > centerX) insertIndex = Math.min(order.length - 1, insertIndex + 1);

    // Перестановка в DOM при изменении
    const from = order.indexOf(dragState.el);
    if (insertIndex !== from) {
        order.splice(from, 1);
        order.splice(insertIndex, 0, dragState.el);
        setOrder(order);
    }
}

function onPointerUp(e: PointerEvent) {
    if (!dragState) return;
    dragState.el.classList.remove("is-selected");
    if (dragState.ghost) dragState.ghost.remove();
    dragState = null;
}

hand.addEventListener("pointerdown", onPointerDown);
window.addEventListener("pointermove", onPointerMove);
window.addEventListener("pointerup", onPointerUp);
window.addEventListener("resize", () => layoutHand(hand));

layoutHand(hand);
