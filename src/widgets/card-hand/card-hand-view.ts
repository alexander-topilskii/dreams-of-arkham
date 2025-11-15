import type { CardHandDeckInfo, CardHandViewport } from "./card-hand";
import type { InternalCard } from "./card-hand-state";
import type { CardHandDndSurface, CardHandDragIndicator, CardHandDragStartInfo, DropTarget } from "./card-hand-dnd";

export type CardHandViewCallbacks = {
    onCardDragStart(card: InternalCard, info: CardHandDragStartInfo): void;
    onViewportChange?(viewport: CardHandViewport): void;
    onEndTurnClick?(): void;
    getCards(): InternalCard[];
    getCardByInstanceId(id: string): InternalCard | undefined;
};

export type CardHandViewOptions = {
    root?: HTMLElement | null;
    translucent: boolean;
    minViewportHeight: number;
    cardWidth: number;
    cardHeight: number;
    gap: number;
    enableTouchInertia: boolean;
    endTurnEnabled: boolean;
};

type PointerSwipeState = {
    pointerId: number;
    lastY: number;
    velocity: number;
    lastTime: number;
};

type ZoneChipElements = {
    element: HTMLDivElement;
    count: HTMLSpanElement;
};

const CARD_ELEVATION = 10;

export class CardHandView implements CardHandDndSurface {
    private static stylesInjected = false;

    private readonly callbacks: CardHandViewCallbacks;
    private readonly options: CardHandViewOptions;

    private readonly ownsRoot: boolean;
    private readonly root: HTMLElement;

    private readonly panel: HTMLDivElement;
    private readonly header: HTMLDivElement;
    private readonly instructionsLabel: HTMLDivElement;
    private readonly zonesContainer: HTMLDivElement;
    private readonly deckChip: HTMLDivElement;
    private readonly discardChip: HTMLDivElement;
    private readonly deckCountLabel: HTMLSpanElement;
    private readonly discardCountLabel: HTMLSpanElement;
    private readonly endTurnButton: HTMLButtonElement;
    private readonly progressLabel: HTMLDivElement;
    private readonly viewport: HTMLDivElement;
    private readonly strip: HTMLDivElement;
    private readonly topShade: HTMLDivElement;
    private readonly bottomShade: HTMLDivElement;
    private readonly upButton: HTMLButtonElement;
    private readonly downButton: HTMLButtonElement;

    private readonly cardElements = new Map<string, HTMLDivElement>();
    private endTurnEnabled: boolean;
    private endTurnPending = false;
    private pointerSwipe?: PointerSwipeState;
    private scrollSnapTimer?: number;
    private resizeObserver?: ResizeObserver;
    private removeWindowResizeListener?: () => void;

    constructor(callbacks: CardHandViewCallbacks, options: CardHandViewOptions) {
        this.callbacks = callbacks;
        this.options = options;

        const ownsRoot = !options.root;
        const root = options.root ?? this.createOverlayRoot();
        this.ownsRoot = ownsRoot;
        this.root = root;

        this.root.classList.add("card-hand-widget");
        this.root.innerHTML = "";

        CardHandView.injectStyles();

        this.panel = document.createElement("div");
        this.panel.className = "card-hand-widget__panel";
        if (options.translucent) {
            this.panel.classList.add("card-hand-widget__panel--translucent");
        }

        this.root.appendChild(this.panel);

        this.header = document.createElement("div");
        this.header.className = "card-hand-widget__header";

        this.instructionsLabel = document.createElement("div");
        this.instructionsLabel.className = "card-hand-widget__instructions";
        this.instructionsLabel.style.display = "none";

        const deckChipElements = this.createZoneChip("Колода", "deck");
        this.deckChip = deckChipElements.element;
        this.deckCountLabel = deckChipElements.count;

        const discardChipElements = this.createZoneChip("Сброс", "discard");
        this.discardChip = discardChipElements.element;
        this.discardCountLabel = discardChipElements.count;

        this.zonesContainer = document.createElement("div");
        this.zonesContainer.className = "card-hand-widget__zones";
        this.zonesContainer.style.display = "none";
        this.zonesContainer.append(this.deckChip, this.discardChip);

        this.endTurnButton = document.createElement("button");
        this.endTurnButton.type = "button";
        this.endTurnButton.className = "card-hand-widget__end-turn";
        this.endTurnButton.textContent = "Закончить ход";
        this.endTurnEnabled = options.endTurnEnabled;
        this.endTurnButton.disabled = !this.callbacks.onEndTurnClick || !this.endTurnEnabled;
        this.endTurnButton.addEventListener("click", () => this.callbacks.onEndTurnClick?.());

        this.progressLabel = document.createElement("div");
        this.progressLabel.className = "card-hand-widget__progress";

        this.header.append(this.instructionsLabel, this.zonesContainer, this.endTurnButton, this.progressLabel);

        this.panel.appendChild(this.header);

        this.viewport = document.createElement("div");
        this.viewport.className = "card-hand-widget__viewport";
        this.viewport.tabIndex = 0;
        this.viewport.style.minHeight = `${options.minViewportHeight}px`;
        this.viewport.style.flex = "1 1 auto";
        this.viewport.style.maxHeight = "100%";
        this.viewport.addEventListener("wheel", this.handleWheel, { passive: false });
        this.viewport.addEventListener("scroll", this.handleScroll);
        this.viewport.addEventListener("keydown", this.handleKeyDown);
        this.viewport.addEventListener("pointerdown", this.handleViewportPointerDown);
        this.viewport.addEventListener("pointermove", this.handleViewportPointerMove);
        this.viewport.addEventListener("pointerup", this.handleViewportPointerUp);
        this.viewport.addEventListener("focus", () => this.panel.classList.add("card-hand-widget__panel--focused"));
        this.viewport.addEventListener("blur", () => this.panel.classList.remove("card-hand-widget__panel--focused"));

        this.strip = document.createElement("div");
        this.strip.className = "card-hand-widget__strip";
        this.strip.style.gap = `${options.gap}px`;
        this.strip.style.padding = "0";

        this.viewport.appendChild(this.strip);
        this.panel.appendChild(this.viewport);

        this.topShade = document.createElement("div");
        this.topShade.className = "card-hand-widget__shade card-hand-widget__shade--top";

        this.bottomShade = document.createElement("div");
        this.bottomShade.className = "card-hand-widget__shade card-hand-widget__shade--bottom";

        this.upButton = document.createElement("button");
        this.upButton.type = "button";
        this.upButton.className = "card-hand-widget__nav card-hand-widget__nav--up";
        this.upButton.setAttribute("aria-label", "Прокрутить вверх");
        this.upButton.textContent = "↑";
        this.upButton.addEventListener("click", () => this.nudge(-1));

        this.downButton = document.createElement("button");
        this.downButton.type = "button";
        this.downButton.className = "card-hand-widget__nav card-hand-widget__nav--down";
        this.downButton.setAttribute("aria-label", "Прокрутить вниз");
        this.downButton.textContent = "↓";
        this.downButton.addEventListener("click", () => this.nudge(1));

        this.panel.append(this.topShade, this.bottomShade, this.upButton, this.downButton);

        this.initializeResizeHandling();
        this.updateViewportHeight();
        this.updateEmptyState();
    }

    focus() {
        this.viewport.focus();
    }

    renderCards(cards: InternalCard[]) {
        this.cardElements.clear();
        this.strip.innerHTML = "";

        if (cards.length === 0) {
            this.updateEmptyState();
            this.emitViewport();
            return;
        }

        cards.forEach((card, index) => this.appendCard(card, index, false));
        this.refreshCardIndices();
        this.updateAfterContentChange();
    }

    addCard(card: InternalCard, index: number) {
        this.appendCard(card, index, true);
        this.refreshCardIndices();
        this.updateAfterContentChange();
    }

    removeCard(id: string) {
        const element = this.cardElements.get(id);
        if (!element) {
            if (this.callbacks.getCards().length === 0) {
                this.updateEmptyState();
            }
            return;
        }

        element.classList.add("card-hand-widget__card-wrapper--leaving");
        const handleAnimationEnd = () => {
            element.removeEventListener("animationend", handleAnimationEnd);
            element.remove();
            this.cardElements.delete(id);
            this.refreshCardIndices();
            this.updateAfterContentChange();
            if (this.callbacks.getCards().length === 0) {
                this.updateEmptyState();
            }
        };
        element.addEventListener("animationend", handleAnimationEnd);
    }

    setDeckInfo(info?: CardHandDeckInfo | null) {
        if (!info) {
            this.zonesContainer.style.display = "none";
            return;
        }

        this.zonesContainer.style.display = "flex";
        this.deckCountLabel.textContent = String(info.drawPileCount);
        this.discardCountLabel.textContent = String(info.discardPileCount);
        this.deckChip.title = `В колоде: ${info.drawPileCount}`;
        this.discardChip.title = `В сбросе: ${info.discardPileCount}`;
        this.updateChipEmptyState(this.deckChip, info.drawPileCount === 0);
        this.updateChipEmptyState(this.discardChip, info.discardPileCount === 0);
    }

    setEndTurnPending(pending: boolean) {
        this.endTurnPending = pending;
        const baseDisabled = !this.callbacks.onEndTurnClick || !this.endTurnEnabled;
        this.endTurnButton.disabled = pending || baseDisabled;
        this.endTurnButton.classList.toggle("card-hand-widget__end-turn--pending", pending);
    }

    setEndTurnEnabled(enabled: boolean) {
        this.endTurnEnabled = enabled;
        const baseDisabled = !this.callbacks.onEndTurnClick || !this.endTurnEnabled;
        this.endTurnButton.disabled = this.endTurnPending || baseDisabled;
    }

    applyCardError(id: string) {
        const wrapper = this.cardElements.get(id);
        if (!wrapper) {
            return;
        }
        wrapper.classList.add("card-hand-widget__card-wrapper--error");
        window.setTimeout(() => {
            wrapper.classList.remove("card-hand-widget__card-wrapper--error");
        }, 360);
    }

    scrollToCard(id: string) {
        const cards = this.callbacks.getCards();
        const index = cards.findIndex((card) => card.instanceId === id);
        if (index === -1) {
            return;
        }
        const pitch = this.options.cardHeight + this.options.gap;
        const target = index * pitch;
        const offset = target - (this.viewport.clientHeight - this.options.cardHeight) / 2;
        this.viewport.scrollTo({ top: Math.max(0, offset), behavior: "smooth" });
        this.scheduleSnap();
    }

    emitViewport() {
        const cards = this.callbacks.getCards();
        if (!this.callbacks.onViewportChange) {
            return;
        }
        if (cards.length === 0) {
            this.callbacks.onViewportChange({ start: 0, end: -1 });
            return;
        }
        const start = this.getFirstVisibleIndex();
        const visibleCount = this.getVisibleCount();
        const end = Math.min(cards.length - 1, start + visibleCount - 1);
        this.callbacks.onViewportChange({ start, end });
    }

    destroy() {
        this.viewport.removeEventListener("wheel", this.handleWheel);
        this.viewport.removeEventListener("scroll", this.handleScroll);
        this.viewport.removeEventListener("keydown", this.handleKeyDown);
        this.viewport.removeEventListener("pointerdown", this.handleViewportPointerDown);
        this.viewport.removeEventListener("pointermove", this.handleViewportPointerMove);
        this.viewport.removeEventListener("pointerup", this.handleViewportPointerUp);

        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
        }
        if (this.removeWindowResizeListener) {
            this.removeWindowResizeListener();
            this.removeWindowResizeListener = undefined;
        }

        if (this.scrollSnapTimer) {
            window.clearTimeout(this.scrollSnapTimer);
        }

        if (this.ownsRoot) {
            this.root.remove();
        } else {
            this.root.innerHTML = "";
        }
    }

    setDragging(cardId: string, dragging: boolean) {
        const wrapper = this.cardElements.get(cardId);
        if (!wrapper) {
            return;
        }
        wrapper.style.zIndex = dragging ? String(CARD_ELEVATION) : "";
        wrapper.classList.toggle("card-hand-widget__card-wrapper--dragging", dragging);
    }

    createDragIndicator(startX: number, startY: number): CardHandDragIndicator {
        const arrow = document.createElement("div");
        arrow.className = "card-hand-widget__drag-arrow";

        const head = document.createElement("div");
        head.className = "card-hand-widget__drag-arrow-head";
        arrow.appendChild(head);

        let visible = false;

        return {
            show() {
                if (visible) {
                    return;
                }
                visible = true;
                document.body.appendChild(arrow);
                requestAnimationFrame(() => {
                    arrow.classList.add("card-hand-widget__drag-arrow--visible");
                });
            },
            update(clientX: number, clientY: number) {
                const dx = clientX - startX;
                const dy = clientY - startY;
                const distance = Math.max(0, Math.hypot(dx, dy));
                const angle = Math.atan2(dy, dx);

                arrow.style.width = `${distance}px`;
                arrow.style.transform = `translate(${startX}px, ${startY}px) rotate(${angle}rad)`;
                head.style.transform = `translate(-50%, -50%) rotate(${angle}rad)`;
            },
            dispose() {
                arrow.remove();
            },
        };
    }

    getDropTargetAt(clientX: number, clientY: number): DropTarget | null {
        const element = document.elementFromPoint(clientX, clientY) as HTMLElement | null;
        if (!element) {
            return null;
        }

        const enemyEffect = element.closest(".character-card__effect[data-enemy-id]") as HTMLElement | null;
        if (enemyEffect) {
            const enemyId = enemyEffect.dataset.enemyId?.trim();
            if (enemyId) {
                const effectId = enemyEffect.dataset.effectId?.trim();
                return { type: "enemy", enemyId, effectId, source: "effect" };
            }
        }

        const characterCard = element.closest(".character-card") as HTMLElement | null;
        if (characterCard) {
            return { type: "player" };
        }

        const territory = element.closest(".map-territory") as HTMLElement | null;
        if (territory) {
            const territoryId = territory.dataset.territoryId?.trim();
            if (territoryId) {
                return { type: "territory", territoryId };
            }
        }

        return null;
    }

    private updateAfterContentChange() {
        this.updateLayout();
        this.updateEmptyState();
        this.emitViewport();
    }

    private appendCard(card: InternalCard, index: number, animate: boolean) {
        const wrapper = document.createElement("div");
        wrapper.className = "card-hand-widget__card-wrapper";
        if (animate) {
            wrapper.classList.add("card-hand-widget__card-wrapper--enter");
        }
        wrapper.dataset.id = card.instanceId;
        wrapper.dataset.index = String(index);
        const cardWidth = `${this.options.cardWidth}px`;
        wrapper.style.width = "100%";
        wrapper.style.maxWidth = cardWidth;
        wrapper.style.flex = "0 0 auto";
        wrapper.style.scrollSnapAlign = "start";

        const button = document.createElement("button");
        button.type = "button";
        button.className = "card-hand-widget__card";
        button.setAttribute("data-card-button", "true");
        button.dataset.cardEffect = card.effect;
        button.dataset.cardType = card.id;
        button.style.width = "100%";
        button.style.maxWidth = "100%";
        button.style.minHeight = `${this.options.cardHeight}px`;
        button.addEventListener("pointerdown", (event) => this.handleCardPointerDown(card.instanceId, event));

        const cardInner = document.createElement("div");
        cardInner.className = "card-hand-widget__card-inner";

        const header = document.createElement("div");
        header.className = "card-hand-widget__card-header";

        const title = document.createElement("div");
        title.className = "card-hand-widget__title";
        title.textContent = card.title;
        title.title = card.title;

        const cost = document.createElement("div");
        cost.className = "card-hand-widget__cost-chip";
        cost.textContent = String(card.cost);
        cost.title = `Стоимость: ${card.cost}`;

        header.append(title, cost);

        const body = document.createElement("div");
        body.className = "card-hand-widget__card-body";

        if (card.description?.trim()) {
            const flavor = document.createElement("div");
            flavor.className = "card-hand-widget__flavor";
            flavor.textContent = card.description;
            flavor.title = card.description;
            body.append(flavor);
        }

        const effect = document.createElement("div");
        effect.className = "card-hand-widget__effect";

        const effectLabel = document.createElement("span");
        effectLabel.textContent = "Эффект";

        const effectText = document.createElement("p");
        effectText.className = "card-hand-widget__effect-text";
        effectText.textContent = this.getEffectDescription(card.effect);

        effect.append(effectLabel, effectText);
        body.append(effect);

        cardInner.append(header, body);

        button.append(cardInner);

        wrapper.appendChild(button);
        this.strip.appendChild(wrapper);

        const baseHeight = this.options.cardHeight;
        const contentHeight = Math.ceil(cardInner.scrollHeight);
        button.style.height = `${Math.max(baseHeight, contentHeight)}px`;

        this.cardElements.set(card.instanceId, wrapper);
    }

    private refreshCardIndices() {
        const cards = this.callbacks.getCards();
        cards.forEach((card, index) => {
            const element = this.cardElements.get(card.instanceId);
            if (element) {
                element.dataset.index = String(index);
            }
        });
    }

    private handleWheel = (event: WheelEvent) => {
        if (event.ctrlKey) {
            return;
        }
        event.preventDefault();
        const dominantDelta = Math.abs(event.deltaY) >= Math.abs(event.deltaX) ? event.deltaY : event.deltaX;
        this.viewport.scrollTop += dominantDelta;
        this.scheduleSnap();
        this.emitViewport();
    };

    private handleScroll = () => {
        this.updateIndicators();
        this.emitViewport();
    };

    private handleKeyDown = (event: KeyboardEvent) => {
        if (event.key === "ArrowDown") {
            event.preventDefault();
            this.nudge(1);
        } else if (event.key === "ArrowUp") {
            event.preventDefault();
            this.nudge(-1);
        }
    };

    private handleViewportPointerDown = (event: PointerEvent) => {
        if (event.pointerType !== "touch") {
            return;
        }

        this.pointerSwipe = {
            pointerId: event.pointerId,
            lastY: event.clientY,
            velocity: 0,
            lastTime: performance.now(),
        };
        this.viewport.setPointerCapture(event.pointerId);
    };

    private handleViewportPointerMove = (event: PointerEvent) => {
        if (event.pointerType !== "touch") {
            return;
        }

        if (!this.pointerSwipe || this.pointerSwipe.pointerId !== event.pointerId) {
            return;
        }

        const dy = event.clientY - this.pointerSwipe.lastY;
        const dt = Math.max(1, performance.now() - this.pointerSwipe.lastTime);
        const velocity = dy / dt;
        this.pointerSwipe.lastY = event.clientY;
        this.pointerSwipe.lastTime = performance.now();
        this.pointerSwipe.velocity = velocity;

        this.viewport.scrollTop -= dy;
        this.emitViewport();
    };

    private handleViewportPointerUp = (event: PointerEvent) => {
        if (event.pointerType !== "touch") {
            return;
        }

        if (this.pointerSwipe && this.pointerSwipe.pointerId === event.pointerId) {
            if (this.options.enableTouchInertia) {
                this.startInertiaAnimation(this.pointerSwipe.velocity);
            }
            this.pointerSwipe = undefined;
        }
        this.scheduleSnap();
    };

    private handleCardPointerDown(cardId: string, event: PointerEvent) {
        const card = this.callbacks.getCardByInstanceId(cardId);
        if (!card) {
            return;
        }

        if (event.pointerType === "mouse" && event.button !== 0) {
            return;
        }

        const wrapper = this.cardElements.get(card.instanceId);
        if (!wrapper) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();

        const rect = wrapper.getBoundingClientRect();
        const info: CardHandDragStartInfo = {
            pointerId: event.pointerId,
            pointerType: event.pointerType,
            button: event.button,
            clientX: event.clientX,
            clientY: event.clientY,
            startX: rect.left + rect.width / 2,
            startY: rect.top + rect.height / 2,
        };

        this.callbacks.onCardDragStart(card, info);
    }

    private nudge(direction: number) {
        const pitch = this.options.cardHeight + this.options.gap;
        this.viewport.scrollBy({ top: direction * pitch, behavior: "smooth" });
        this.scheduleSnap();
    }

    private scheduleSnap() {
        if (this.scrollSnapTimer) {
            window.clearTimeout(this.scrollSnapTimer);
        }
        this.scrollSnapTimer = window.setTimeout(() => {
            this.snapToNearest();
        }, 160);
    }

    private snapToNearest() {
        const cards = this.callbacks.getCards();
        if (cards.length === 0) {
            return;
        }
        const pitch = this.options.cardHeight + this.options.gap;
        const scroll = this.viewport.scrollTop;
        const center = scroll + this.viewport.clientHeight / 2;
        const index = Math.round((center - this.options.cardHeight / 2) / pitch);
        const clamped = Math.max(0, Math.min(cards.length - 1, index));
        const target = clamped * pitch;
        this.viewport.scrollTo({ top: target, behavior: "smooth" });
    }

    private startInertiaAnimation(initialVelocity: number) {
        if (Math.abs(initialVelocity) < 0.001) {
            this.scheduleSnap();
            return;
        }

        let velocity = initialVelocity * 24;
        let lastTime = performance.now();
        const friction = 0.92;

        const step = (time: number) => {
            const dt = time - lastTime;
            lastTime = time;

            this.viewport.scrollTop -= velocity * dt * 0.06;
            velocity *= friction;

            if (Math.abs(velocity) > 0.05) {
                requestAnimationFrame(step);
            } else {
                this.scheduleSnap();
            }
            this.emitViewport();
        };

        requestAnimationFrame(step);
    }

    private updateLayout() {
        this.strip.classList.remove("card-hand-widget__strip--centered");
        this.updateIndicators();
    }

    private updateIndicators() {
        const maxScroll = Math.max(0, this.viewport.scrollHeight - this.viewport.clientHeight);
        const topVisible = this.viewport.scrollTop > 4;
        const bottomVisible = this.viewport.scrollTop < maxScroll - 4;

        this.topShade.classList.toggle("card-hand-widget__shade--visible", topVisible);
        this.bottomShade.classList.toggle("card-hand-widget__shade--visible", bottomVisible);
        this.upButton.classList.toggle("card-hand-widget__nav--visible", topVisible);
        this.downButton.classList.toggle("card-hand-widget__nav--visible", bottomVisible);

        const cards = this.callbacks.getCards();
        const visibleCount = this.getVisibleCount();
        if (cards.length > 20 && visibleCount > 0) {
            const pages = Math.max(1, Math.ceil(cards.length / visibleCount));
            const currentPage = Math.min(pages, Math.max(1, Math.floor(this.getFirstVisibleIndex() / visibleCount) + 1));
            this.progressLabel.textContent = `${currentPage} / ${pages}`;
            this.progressLabel.style.display = "block";
        } else {
            this.progressLabel.style.display = "none";
        }
    }

    private updateEmptyState() {
        const cards = this.callbacks.getCards();
        if (cards.length > 0) {
            this.viewport.classList.remove("card-hand-widget__viewport--empty");
            this.viewport.setAttribute("aria-label", "Рука игрока");
            const placeholder = this.viewport.querySelector(".card-hand-widget__empty");
            if (placeholder) {
                placeholder.remove();
            }
            if (!this.viewport.contains(this.strip)) {
                this.viewport.appendChild(this.strip);
            }
            return;
        }

        this.viewport.classList.add("card-hand-widget__viewport--empty");
        this.viewport.setAttribute("aria-label", "Рука пуста");
        if (!this.viewport.querySelector(".card-hand-widget__empty")) {
            const placeholder = document.createElement("div");
            placeholder.className = "card-hand-widget__empty";
            placeholder.textContent = "Рука пуста";
            this.viewport.innerHTML = "";
            this.viewport.appendChild(placeholder);
        }
    }

    private getVisibleCount(): number {
        const pitch = this.options.cardHeight + this.options.gap;
        if (pitch <= 0) {
            return 1;
        }
        return Math.max(1, Math.floor((this.viewport.clientHeight + this.options.gap) / pitch));
    }

    private getFirstVisibleIndex(): number {
        const pitch = this.options.cardHeight + this.options.gap;
        return Math.max(0, Math.floor(this.viewport.scrollTop / pitch));
    }

    private initializeResizeHandling() {
        if (typeof ResizeObserver !== "undefined") {
            this.resizeObserver = new ResizeObserver(() => {
                this.updateViewportHeight();
            });
            this.resizeObserver.observe(this.panel);
        } else {
            const listener = () => this.updateViewportHeight();
            window.addEventListener("resize", listener);
            this.removeWindowResizeListener = () => window.removeEventListener("resize", listener);
        }
    }

    private updateViewportHeight = () => {
        const panelHeight = this.panel.clientHeight;
        if (!panelHeight) {
            return;
        }
        const style = window.getComputedStyle(this.panel);
        const paddingTop = parseFloat(style.paddingTop) || 0;
        const paddingBottom = parseFloat(style.paddingBottom) || 0;
        const gap = parseFloat(style.rowGap || style.gap || "0") || 0;
        const available = panelHeight - paddingTop - paddingBottom - this.header.offsetHeight - gap;
        const target = Math.max(this.options.minViewportHeight, available);
        if (Number.isFinite(target)) {
            this.viewport.style.height = `${target}px`;
        }
    };

    private updateChipEmptyState(chip: HTMLDivElement, isEmpty: boolean) {
        chip.classList.toggle("card-hand-widget__chip--empty", isEmpty);
    }

    private getEffectDescription(effect: InternalCard["effect"]): string {
        switch (effect) {
            case "move":
                return "Переместитесь в соседнюю область.";
            case "attack":
                return "Атакуйте угрозу поблизости.";
            case "hide":
                return "Сокройтесь от взгляда врагов.";
            case "search":
                return "Исследуйте местность и найдите улики.";
            case "evade":
                return "Сбросьте внимание одного врага и выйдите из боя.";
            case "smoke":
                return "Ослепите всех врагов дымом и выйдите из боя, получив 1 урон.";
            case "heal":
                return "Восстановите 2 единицы здоровья, перевязав раны.";
        }
    }

    private createZoneChip(label: string, modifier?: string): ZoneChipElements {
        const chip = document.createElement("div");
        chip.className = "card-hand-widget__chip";
        if (modifier) {
            chip.classList.add(`card-hand-widget__chip--${modifier}`);
        }

        const labelSpan = document.createElement("span");
        labelSpan.className = "card-hand-widget__chip-label";
        labelSpan.textContent = label;

        const countSpan = document.createElement("span");
        countSpan.className = "card-hand-widget__chip-value";
        countSpan.textContent = "0";

        chip.append(labelSpan, countSpan);

        return { element: chip, count: countSpan };
    }

    private createOverlayRoot(): HTMLElement {
        const root = document.createElement("div");
        root.className = "card-hand-widget__overlay-root";
        document.body.appendChild(root);
        return root;
    }

    private static injectStyles() {
        if (this.stylesInjected) {
            return;
        }
        const style = document.createElement("style");
        style.textContent = `
            .card-hand-widget__overlay-root {
                position: fixed;
                inset: 0;
                display: flex;
                align-items: flex-end;
                justify-content: center;
                padding: 6px 10px 10px;
                pointer-events: none;
                z-index: 2000;
            }

            .card-hand-widget__overlay-root > * {
                pointer-events: auto;
            }

            .card-hand-widget__panel {
                position: relative;
                display: flex;
                flex-direction: column;
                gap: 4px;
                padding: 6px 10px 10px;
                background: rgba(11, 15, 25, 0.9);
                border: 1px solid rgba(148, 163, 184, 0.3);
                border-radius: 14px;
                color: #f8fafc;
                box-shadow: 0 24px 40px rgba(15, 23, 42, 0.5);
            }

            .card-hand-widget__panel--translucent {
                backdrop-filter: blur(16px);
            }

            .card-hand-widget__panel--focused {
                box-shadow: 0 32px 64px rgba(15, 23, 42, 0.6);
            }

            .card-hand-widget__header {
                display: flex;
                align-items: center;
                gap: 4px;
                min-height: 0;
            }

            .card-hand-widget__instructions {
                font-size: 12px;
                color: rgba(226, 232, 240, 0.72);
                flex: 1;
                min-width: 0;
                text-overflow: ellipsis;
                overflow: hidden;
                white-space: nowrap;
            }

            .card-hand-widget__zones {
                display: none;
                align-items: center;
                gap: 5px;
                flex-shrink: 0;
            }

            .card-hand-widget__chip {
                display: inline-flex;
                align-items: center;
                gap: 3px;
                padding: 2px 7px;
                border-radius: 999px;
                border: 1px solid rgba(148, 163, 184, 0.35);
                background: rgba(30, 41, 59, 0.6);
                font-size: 11px;
                color: rgba(226, 232, 240, 0.85);
                transition: opacity 160ms ease;
            }

            .card-hand-widget__chip-label {
                font-weight: 500;
                letter-spacing: 0.02em;
            }

            .card-hand-widget__chip-value {
                font-weight: 600;
                color: #f8fafc;
                font-size: 12px;
            }

            .card-hand-widget__chip--deck {
                background: rgba(30, 64, 175, 0.45);
                border-color: rgba(129, 161, 193, 0.4);
            }

            .card-hand-widget__chip--discard {
                background: rgba(94, 51, 73, 0.55);
                border-color: rgba(244, 114, 182, 0.35);
            }

            .card-hand-widget__chip--empty {
                opacity: 0.65;
            }

            .card-hand-widget__end-turn {
                flex-shrink: 0;
                border-radius: 999px;
                border: 1px solid rgba(250, 204, 21, 0.4);
                background: rgba(250, 204, 21, 0.12);
                color: rgba(254, 249, 195, 0.95);
                font-size: 11px;
                font-weight: 600;
                letter-spacing: 0.05em;
                text-transform: uppercase;
                padding: 5px 12px;
                transition: transform 120ms ease, box-shadow 120ms ease, background 120ms ease, border-color 120ms ease;
                cursor: pointer;
            }

            .card-hand-widget__end-turn:hover {
                background: rgba(250, 204, 21, 0.2);
                border-color: rgba(250, 204, 21, 0.55);
                box-shadow: 0 8px 18px rgba(250, 204, 21, 0.18);
                transform: translateY(-1px);
            }

            .card-hand-widget__end-turn:focus-visible {
                outline: none;
                box-shadow: 0 0 0 2px rgba(250, 204, 21, 0.45);
            }

            .card-hand-widget__end-turn:disabled {
                opacity: 0.55;
                cursor: not-allowed;
                box-shadow: none;
                transform: none;
            }

            .card-hand-widget__end-turn--pending {
                opacity: 0.75;
            }

            .card-hand-widget__progress {
                margin-left: auto;
                font-size: 12px;
                opacity: 0.75;
                display: none;
            }

            .card-hand-widget__viewport {
                position: relative;
                overflow-x: hidden;
                overflow-y: auto;
                border-radius: 16px;
                background: rgba(15, 23, 42, 0.55);
                border: 1px solid rgba(148, 163, 184, 0.25);
                outline: none;
            }

            .card-hand-widget__viewport:focus-visible {
                box-shadow: 0 0 0 2px rgba(250, 204, 21, 0.45);
            }

            .card-hand-widget__viewport--empty {
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 16px;
                color: rgba(226, 232, 240, 0.8);
            }

            .card-hand-widget__viewport::-webkit-scrollbar {
                display: none;
            }

            .card-hand-widget__empty {
                animation: card-hand-widget__pulse 1.6s ease-in-out infinite;
            }

            @keyframes card-hand-widget__pulse {
                0%, 100% { opacity: 0.55; }
                50% { opacity: 1; }
            }

            .card-hand-widget__strip {
                display: flex;
                flex-direction: column;
                align-items: stretch;
                position: relative;
                width: 100%;
                min-height: 100%;
                gap: 4px;
                padding: 0;
                transition: transform 0.3s ease;
            }

            .card-hand-widget__strip--centered {
                align-items: center;
            }

            .card-hand-widget__card-wrapper {
                position: relative;
                display: flex;
                justify-content: center;
                align-items: center;
                align-self: center;
                width: 100%;
                max-width: 100%;
                transition: transform 0.2s ease, filter 0.2s ease;
            }

            .card-hand-widget__card-wrapper--enter {
                animation: card-hand-widget__enter 0.4s ease;
            }

            .card-hand-widget__card-wrapper--leaving {
                animation: card-hand-widget__leave 0.4s ease forwards;
            }

            @keyframes card-hand-widget__enter {
                0% { transform: translateY(40px) scale(0.85); opacity: 0; }
                60% { transform: translateY(-4px) scale(1.05); opacity: 1; }
                100% { transform: translateY(0) scale(1); }
            }

            @keyframes card-hand-widget__leave {
                0% { transform: translateY(0) scale(1); opacity: 1; }
                100% { transform: translateY(-120px) scale(0.85); opacity: 0; }
            }

            .card-hand-widget__card {
                display: block;
                width: 100%;
                max-width: 100%;
                background: transparent;
                border: none;
                padding: 0;
                margin: 0;
                cursor: grab;
                font: inherit;
                color: inherit;
            }

            .card-hand-widget__card:focus-visible {
                outline: none;
            }

            .card-hand-widget__card:active {
                cursor: grabbing;
            }

            .card-hand-widget__card-inner {
                position: relative;
                display: flex;
                flex-direction: column;
                gap: 12px;
                padding: 14px 16px 18px;
                width: 100%;
                border-radius: 14px;
                background: linear-gradient(145deg, rgba(15, 23, 42, 0.94), rgba(30, 41, 59, 0.78));
                border: 1px solid rgba(148, 163, 184, 0.25);
                box-shadow: 0 12px 28px rgba(15, 23, 42, 0.4);
                text-align: left;
            }

            .card-hand-widget__card-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 10px;
            }

            .card-hand-widget__title {
                font-size: 18px;
                font-weight: 600;
                letter-spacing: 0.02em;
                color: #f8fafc;
            }

            .card-hand-widget__cost-chip {
                border-radius: 999px;
                padding: 3px 9px;
                background: rgba(14, 116, 144, 0.35);
                border: 1px solid rgba(34, 211, 238, 0.45);
                color: rgba(224, 242, 254, 0.95);
                font-weight: 600;
            }

            .card-hand-widget__card-body {
                display: flex;
                flex-direction: column;
                gap: 12px;
                font-size: 13px;
                color: rgba(226, 232, 240, 0.9);
                line-height: 1.45;
            }

            .card-hand-widget__flavor {
                font-style: italic;
                color: rgba(148, 163, 184, 0.85);
            }

            .card-hand-widget__effect {
                display: flex;
                flex-direction: column;
                gap: 5px;
            }

            .card-hand-widget__effect-text {
                margin: 0;
                font-size: 14px;
                color: rgba(148, 163, 184, 0.95);
            }

            .card-hand-widget__shade {
                position: absolute;
                left: 10px;
                right: 10px;
                height: 40px;
                pointer-events: none;
                opacity: 0;
                transition: opacity 160ms ease;
                background: linear-gradient(to bottom, rgba(15, 23, 42, 0.65), transparent);
            }

            .card-hand-widget__shade--bottom {
                top: auto;
                bottom: 10px;
                transform: rotate(180deg);
            }

            .card-hand-widget__shade--visible {
                opacity: 1;
            }

            .card-hand-widget__nav {
                position: absolute;
                left: calc(50% - 14px);
                width: 28px;
                height: 28px;
                border-radius: 999px;
                background: rgba(30, 41, 59, 0.75);
                border: 1px solid rgba(148, 163, 184, 0.35);
                color: rgba(226, 232, 240, 0.85);
                display: flex;
                align-items: center;
                justify-content: center;
                opacity: 0;
                pointer-events: none;
                transition: opacity 160ms ease, transform 160ms ease;
            }

            .card-hand-widget__nav--visible {
                opacity: 1;
                pointer-events: auto;
            }

            .card-hand-widget__nav--up {
                top: 6px;
            }

            .card-hand-widget__nav--down {
                bottom: 6px;
            }

            .card-hand-widget__card-wrapper--dragging {
                transform: translateZ(${CARD_ELEVATION}px) scale(1.02);
                filter: drop-shadow(0 18px 32px rgba(15, 23, 42, 0.55));
            }

            .card-hand-widget__card-wrapper--error {
                animation: card-hand-widget__shake 0.36s ease;
            }

            @keyframes card-hand-widget__shake {
                0%, 100% { transform: translateX(0); }
                20% { transform: translateX(-6px); }
                40% { transform: translateX(6px); }
                60% { transform: translateX(-4px); }
                80% { transform: translateX(4px); }
            }

            .card-hand-widget__drag-arrow {
                position: fixed;
                top: 0;
                left: 0;
                height: 4px;
                border-radius: 999px;
                background: rgba(250, 204, 21, 0.8);
                transform-origin: 0 50%;
                pointer-events: none;
                opacity: 0;
                transition: opacity 120ms ease;
            }

            .card-hand-widget__drag-arrow--visible {
                opacity: 1;
            }

            .card-hand-widget__drag-arrow-head {
                position: absolute;
                right: 0;
                top: 0;
                width: 12px;
                height: 12px;
                background: rgba(250, 204, 21, 0.9);
                border-radius: 50%;
                box-shadow: 0 0 12px rgba(250, 204, 21, 0.6);
            }
        `;
        document.head.appendChild(style);
        this.stylesInjected = true;
    }
}
