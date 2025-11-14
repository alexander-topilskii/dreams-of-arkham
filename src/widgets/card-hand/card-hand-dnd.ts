import type { InternalCard } from "./card-hand-state";

export type DropTarget =
    | { type: "territory"; territoryId: string }
    | { type: "player" }
    | { type: "enemy"; enemyId: string; effectId?: string; source?: "effect" | "token" | "unknown" };

export type CardHandDragStartInfo = {
    pointerId: number;
    pointerType: string;
    button: number;
    clientX: number;
    clientY: number;
    startX: number;
    startY: number;
};

export interface CardHandDragIndicator {
    show(): void;
    update(clientX: number, clientY: number): void;
    dispose(): void;
}

export interface CardHandDndSurface {
    setDragging(cardId: string, dragging: boolean): void;
    createDragIndicator(startX: number, startY: number): CardHandDragIndicator;
    getDropTargetAt(clientX: number, clientY: number): DropTarget | null;
}

export interface CardHandDndCallbacks {
    onDrop(card: InternalCard, target: DropTarget | null): Promise<void> | void;
    onDragCanceled?(card: InternalCard): void;
}

type ActiveDrag = {
    pointerId: number;
    card: InternalCard;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
    thresholdPassed: boolean;
    indicator: CardHandDragIndicator;
};

const DRAG_THRESHOLD = 12;

export class CardHandDnd {
    private readonly surface: CardHandDndSurface;
    private readonly callbacks: CardHandDndCallbacks;
    private activeDrag?: ActiveDrag;

    constructor(surface: CardHandDndSurface, callbacks: CardHandDndCallbacks) {
        this.surface = surface;
        this.callbacks = callbacks;
    }

    beginDrag(card: InternalCard, info: CardHandDragStartInfo) {
        if (info.pointerType === "mouse" && info.button !== 0) {
            return;
        }

        this.cancelActiveDrag();

        const indicator = this.surface.createDragIndicator(info.startX, info.startY);

        this.activeDrag = {
            pointerId: info.pointerId,
            card,
            startX: info.startX,
            startY: info.startY,
            originX: info.clientX,
            originY: info.clientY,
            thresholdPassed: false,
            indicator,
        };

        document.addEventListener("pointermove", this.handleDocumentPointerMove);
        document.addEventListener("pointerup", this.handleDocumentPointerUp);
        document.addEventListener("pointercancel", this.handleDocumentPointerUp);
    }

    destroy() {
        this.cancelActiveDrag();
    }

    private handleDocumentPointerMove = (event: PointerEvent) => {
        const drag = this.activeDrag;
        if (!drag || drag.pointerId !== event.pointerId) {
            return;
        }

        const distance = Math.hypot(event.clientX - drag.originX, event.clientY - drag.originY);
        if (!drag.thresholdPassed && distance > DRAG_THRESHOLD) {
            drag.thresholdPassed = true;
            this.surface.setDragging(drag.card.instanceId, true);
            drag.indicator.show();
        }

        if (drag.thresholdPassed) {
            drag.indicator.update(event.clientX, event.clientY);
        }
    };

    private handleDocumentPointerUp = async (event: PointerEvent) => {
        const drag = this.activeDrag;
        if (!drag || drag.pointerId !== event.pointerId) {
            return;
        }

        this.stopTrackingPointer();

        const { card, thresholdPassed } = drag;
        this.clearActiveDrag();

        if (!thresholdPassed) {
            this.callbacks.onDragCanceled?.(card);
            return;
        }

        const target = this.surface.getDropTargetAt(event.clientX, event.clientY);
        await this.callbacks.onDrop(card, target);
    };

    private stopTrackingPointer() {
        document.removeEventListener("pointermove", this.handleDocumentPointerMove);
        document.removeEventListener("pointerup", this.handleDocumentPointerUp);
        document.removeEventListener("pointercancel", this.handleDocumentPointerUp);
    }

    private clearActiveDrag() {
        if (!this.activeDrag) {
            return;
        }
        this.surface.setDragging(this.activeDrag.card.instanceId, false);
        this.activeDrag.indicator.dispose();
        this.activeDrag = undefined;
    }

    private cancelActiveDrag() {
        this.stopTrackingPointer();
        this.clearActiveDrag();
    }
}
