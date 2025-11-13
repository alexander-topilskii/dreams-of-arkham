import { CardHand, type CardHandCard, type CardHandDropResult } from "./card-hand";
import {
    AddDebugCardCommand,
    AttackEnemyWithCardCommand,
    ConsumeCardCommand,
    EndTurnCommand,
    EvadeAllEnemiesWithCardCommand,
    EvadeEnemyWithCardCommand,
    GameEngineStore,
    type GameEvent,
    type GameViewModel,
    HealWithCardCommand,
    MoveWithCardCommand,
    PostLogCommand,
    type HandCardDescriptor,
} from "../game-engine/game-engine-store";
import type { HandCardContent } from "../game-engine/game-engine-cards";

export type CardHandControllerDependencies = {
    cardHand: CardHand;
    store: GameEngineStore;
};

export class CardHandController {
    private readonly store: GameEngineStore;
    private readonly cardHand: CardHand;
    private readonly unsubscribeFromStore?: () => void;
    private lastDropResult?: CardHandDropResult;

    constructor(dependencies: CardHandControllerDependencies) {
        this.store = dependencies.store;
        this.cardHand = dependencies.cardHand;
        this.unsubscribeFromStore = this.store.subscribe(this.handleStoreEvent);
    }

    initialize(): void {
        this.syncHand(this.store.getViewModel());
    }

    addDebugCard(): void {
        this.store.dispatch(new AddDebugCardCommand());
    }

    onDrop(card: CardHandCard, territoryId: string): CardHandDropResult {
        const descriptor: HandCardDescriptor = {
            id: card.id,
            title: card.title,
            cost: card.cost,
        };
        this.lastDropResult = undefined;

        switch (card.effect) {
            case "move":
                this.store.dispatch(new MoveWithCardCommand(descriptor, territoryId));
                break;
            case "attack":
                this.store.dispatch(new AttackEnemyWithCardCommand(descriptor, territoryId));
                break;
            case "evade":
                this.store.dispatch(new EvadeEnemyWithCardCommand(descriptor, territoryId));
                break;
            case "smoke":
                this.store.dispatch(new EvadeAllEnemiesWithCardCommand(descriptor, territoryId));
                break;
            case "heal":
                this.store.dispatch(new HealWithCardCommand(descriptor, territoryId));
                break;
            default:
                this.lastDropResult = {
                    status: "error",
                    message: "Эффект этой карты пока не поддерживается.",
                };
                return this.lastDropResult;
        }
        const result: CardHandDropResult =
            this.lastDropResult ?? { status: "error", message: "Не удалось применить эффект карты." };
        this.lastDropResult = undefined;
        return result;
    }

    onDropFailure(_card: CardHandCard, _territoryId: string, _message?: string): void {
        // Outcome handling now arrives through engine events — nothing additional is required here.
    }

    onDropTargetMissing(card: CardHandCard): void {
        const prompt = `Выберите локацию для «${card.title}».`;
        this.store.dispatch(new PostLogCommand("user", prompt));
        this.store.dispatch(new PostLogCommand("system", `move_hint:target_missing:${card.id}`));
    }

    handleCardConsumed(card: CardHandCard): void {
        if (!card.instanceId) {
            return;
        }
        this.store.dispatch(new ConsumeCardCommand(card.instanceId));
    }

    handleEndTurn(): void {
        this.store.dispatch(new EndTurnCommand());
    }

    destroy(): void {
        this.unsubscribeFromStore?.();
    }

    private readonly handleStoreEvent = (event: GameEvent, viewModel: GameViewModel): void => {
        switch (event.type) {
            case "state:sync":
                this.syncHand(viewModel);
                break;
            case "hand:sync":
                this.syncHand(viewModel);
                break;
            case "hand:refill":
                this.syncHand(viewModel);
                break;
            case "card:consumed":
                this.cardHand.removeCard(event.card.instanceId);
                break;
            case "move:success":
                this.lastDropResult = { status: "success" };
                break;
            case "move:failure":
                this.lastDropResult = { status: "error", message: event.message };
                break;
            case "card:play:success":
                this.lastDropResult = { status: "success" };
                break;
            case "card:play:failure":
                this.lastDropResult = { status: "error", message: event.message };
                break;
        }
    };

    private syncHand(viewModel: GameViewModel): void {
        const cards = viewModel.hand.map((card) => this.toCardHandCard(card));
        this.cardHand.setCards(cards);
        const deck = viewModel.handDeck;
        this.cardHand.setDeckInfo({
            drawPileCount: deck.drawPileCount,
            discardPileCount: deck.discardPileCount,
        });
    }

    private toCardHandCard(card: HandCardContent): CardHandCard {
        const { image, ...rest } = card;
        return {
            ...rest,
            artUrl: image,
        };
    }
}
