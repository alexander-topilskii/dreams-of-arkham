import { CardHandDnd, type CardHandDragStartInfo, type DropTarget } from "./card-hand-dnd";
import { CardHandState, type InternalCard } from "./card-hand-state";
import { CardHandView } from "./card-hand-view";

export type CardEffect = "move" | "attack" | "hide" | "search" | "evade" | "smoke" | "heal";

export type CardHandCard = {
    id: string;
    title: string;
    description: string;
    cost: number;
    effect: CardEffect;
    artUrl?: string;
    instanceId?: string;
};

export type CardHandViewport = {
    start: number;
    end: number;
};

export type CardHandDropResult =
    | { status: "success" }
    | { status: "error"; message?: string };

export type CardHandDeckInfo = {
    drawPileCount: number;
    discardPileCount: number;
};

export type CardHandEnemyDropContext = {
    source?: "effect" | "token" | "unknown";
    effectId?: string;
};

export type CardHandOptions = {
    cards?: CardHandCard[];
    height?: number;
    cardWidth?: number;
    cardHeight?: number;
    gap?: number;
    translucent?: boolean;
    enableTouchInertia?: boolean;
    onViewportChange?: (viewport: CardHandViewport) => void;
    onMoveCardDrop?: (card: CardHandCard, territoryId: string) => CardHandDropResult | Promise<CardHandDropResult>;
    onMoveCardDropFailure?: (card: CardHandCard, territoryId: string, message?: string) => void;
    onMoveCardTargetMissing?: (card: CardHandCard) => void;
    onPlayerCardDrop?: (card: CardHandCard) => CardHandDropResult | Promise<CardHandDropResult>;
    onPlayerCardDropFailure?: (card: CardHandCard, message?: string) => void;
    onEnemyCardDrop?: (
        card: CardHandCard,
        enemyId: string,
        context?: CardHandEnemyDropContext,
    ) => CardHandDropResult | Promise<CardHandDropResult>;
    onEnemyCardDropFailure?: (
        card: CardHandCard,
        enemyId: string,
        message?: string,
        context?: CardHandEnemyDropContext,
    ) => void;
    onCardConsumed?: (card: CardHandCard) => void;
    onEndTurn?: () => void | Promise<void>;
};

export class CardHand {
    private readonly state: CardHandState;
    private readonly view: CardHandView;
    private readonly dnd: CardHandDnd;

    private readonly onMoveCardDrop?: CardHandOptions["onMoveCardDrop"];
    private readonly onMoveCardDropFailure?: CardHandOptions["onMoveCardDropFailure"];
    private readonly onMoveCardTargetMissing?: CardHandOptions["onMoveCardTargetMissing"];
    private readonly onPlayerCardDrop?: CardHandOptions["onPlayerCardDrop"];
    private readonly onPlayerCardDropFailure?: CardHandOptions["onPlayerCardDropFailure"];
    private readonly onEnemyCardDrop?: CardHandOptions["onEnemyCardDrop"];
    private readonly onEnemyCardDropFailure?: CardHandOptions["onEnemyCardDropFailure"];
    private readonly onCardConsumed?: CardHandOptions["onCardConsumed"];
    private readonly onEndTurn?: CardHandOptions["onEndTurn"];

    private endTurnPending = false;

    constructor(root?: HTMLElement | null, options: CardHandOptions = {}) {
        const translucent = options.translucent ?? true;
        const minViewportHeight = options.height ?? 300;
        const cardWidth = options.cardWidth ?? 336;
        const cardHeight = options.cardHeight ?? Math.floor(cardWidth * 1.1);
        const gap = options.gap ?? 10;
        const enableTouchInertia = options.enableTouchInertia ?? true;

        this.onMoveCardDrop = options.onMoveCardDrop;
        this.onMoveCardDropFailure = options.onMoveCardDropFailure;
        this.onMoveCardTargetMissing = options.onMoveCardTargetMissing;
        this.onPlayerCardDrop = options.onPlayerCardDrop;
        this.onPlayerCardDropFailure = options.onPlayerCardDropFailure;
        this.onEnemyCardDrop = options.onEnemyCardDrop;
        this.onEnemyCardDropFailure = options.onEnemyCardDropFailure;
        this.onCardConsumed = options.onCardConsumed;
        this.onEndTurn = options.onEndTurn;

        this.state = new CardHandState(options.cards ?? []);

        this.view = new CardHandView(
            {
                onCardDragStart: this.handleCardDragStart,
                onViewportChange: options.onViewportChange,
                onEndTurnClick: this.onEndTurn ? this.handleEndTurnClick : undefined,
                getCards: () => this.state.getCards(),
                getCardByInstanceId: (id) => this.state.getCardByInstanceId(id),
            },
            {
                root: root ?? undefined,
                translucent,
                minViewportHeight,
                cardWidth,
                cardHeight,
                gap,
                enableTouchInertia,
                endTurnEnabled: Boolean(this.onEndTurn),
            },
        );

        this.view.renderCards(this.state.getCards());

        this.dnd = new CardHandDnd(this.view, {
            onDrop: this.handleDrop,
        });
    }

    addCard(card: CardHandCard) {
        const { card: internalCard, index } = this.state.addCard(card);
        this.view.addCard(internalCard, index);
        this.view.scrollToCard(internalCard.instanceId);
    }

    focus() {
        this.view.focus();
    }

    setCards(cards: CardHandCard[]) {
        const internalCards = this.state.setCards(cards);
        this.view.renderCards(internalCards);
    }

    setDeckInfo(info?: CardHandDeckInfo | null) {
        this.view.setDeckInfo(info);
    }

    removeCard(id: string) {
        const { card } = this.state.removeCard(id);
        if (!card) {
            return;
        }
        this.view.removeCard(card.instanceId);
    }

    destroy() {
        this.dnd.destroy();
        this.view.destroy();
    }

    private readonly handleCardDragStart = (card: InternalCard, info: CardHandDragStartInfo) => {
        this.dnd.beginDrag(card, info);
    };

    private readonly handleDrop = async (card: InternalCard, target: DropTarget | null) => {
        if (!target) {
            this.view.applyCardError(card.instanceId);
            this.onMoveCardTargetMissing?.(card);
            return;
        }

        if (target.type === "territory") {
            await this.resolveMoveDrop(card, target.territoryId);
            return;
        }

        if (target.type === "player") {
            await this.resolvePlayerDrop(card);
            return;
        }

        if (target.type === "enemy") {
            await this.resolveEnemyDrop(card, target);
            return;
        }

        this.view.applyCardError(card.instanceId);
    };

    private readonly handleEndTurnClick = async () => {
        if (!this.onEndTurn || this.endTurnPending) {
            return;
        }

        this.endTurnPending = true;
        this.view.setEndTurnPending(true);

        try {
            await this.onEndTurn();
        } catch (error) {
            console.error("CardHand: failed to end turn", error);
        } finally {
            this.endTurnPending = false;
            this.view.setEndTurnPending(false);
        }
    };

    private async resolveMoveDrop(card: InternalCard, territoryId: string) {
        if (!this.onMoveCardDrop) {
            console.warn("CardHand: onMoveCardDrop handler is not provided.");
            this.view.applyCardError(card.instanceId);
            return;
        }

        try {
            const result = await this.onMoveCardDrop(card, territoryId);
            if (result && result.status === "success") {
                this.onCardConsumed?.(card);
                this.removeCard(card.instanceId);
                return;
            }

            const message = result?.message;
            this.onMoveCardDropFailure?.(card, territoryId, message);
            this.view.applyCardError(card.instanceId);
        } catch (error) {
            const message = error instanceof Error ? error.message : undefined;
            console.error("CardHand: failed to resolve move drop", error);
            this.onMoveCardDropFailure?.(card, territoryId, message);
            this.view.applyCardError(card.instanceId);
        }
    }

    private async resolvePlayerDrop(card: InternalCard) {
        if (!this.onPlayerCardDrop) {
            console.warn("CardHand: onPlayerCardDrop handler is not provided.");
            this.view.applyCardError(card.instanceId);
            return;
        }

        try {
            const result = await this.onPlayerCardDrop(card);
            if (result && result.status === "success") {
                this.onCardConsumed?.(card);
                this.removeCard(card.instanceId);
                return;
            }

            const message = result?.message;
            this.onPlayerCardDropFailure?.(card, message);
            this.view.applyCardError(card.instanceId);
        } catch (error) {
            const message = error instanceof Error ? error.message : undefined;
            console.error("CardHand: failed to resolve player drop", error);
            this.onPlayerCardDropFailure?.(card, message);
            this.view.applyCardError(card.instanceId);
        }
    }

    private async resolveEnemyDrop(card: InternalCard, target: Extract<DropTarget, { type: "enemy" }>) {
        if (!this.onEnemyCardDrop) {
            console.warn("CardHand: onEnemyCardDrop handler is not provided.");
            this.view.applyCardError(card.instanceId);
            return;
        }

        const enemyId = target.enemyId;
        const context: CardHandEnemyDropContext = {
            source: target.source,
            effectId: target.effectId,
        };

        if (!enemyId) {
            this.view.applyCardError(card.instanceId);
            this.onEnemyCardDropFailure?.(card, enemyId, "Не удалось определить врага", context);
            return;
        }

        try {
            const result = await this.onEnemyCardDrop(card, enemyId, context);
            if (result && result.status === "success") {
                this.onCardConsumed?.(card);
                this.removeCard(card.instanceId);
                return;
            }

            const message = result?.message;
            this.onEnemyCardDropFailure?.(card, enemyId, message, context);
            this.view.applyCardError(card.instanceId);
        } catch (error) {
            const message = error instanceof Error ? error.message : undefined;
            console.error("CardHand: failed to resolve enemy drop", error);
            this.onEnemyCardDropFailure?.(card, enemyId, message, context);
            this.view.applyCardError(card.instanceId);
        }
    }
}
