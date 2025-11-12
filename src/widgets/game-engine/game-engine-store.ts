import { generateCardInstanceId, type HandCardContent, type HandCardDefinition } from "./game-engine-cards";
import { type GameCommand, type GameEngine, type GameEvent, type GameViewModel } from "./game-engine";

type GameEngineStoreOptions = {
    initialHand?: readonly HandCardDefinition[];
    createDebugCard?: () => HandCardDefinition;
};

export type GameEngineStoreState = {
    readonly hand: readonly HandCardContent[];
};

export type GameEngineStoreViewModel = GameViewModel & {
    readonly hand: readonly HandCardContent[];
};

export type GameEngineStoreSubscriber = (event: GameEvent, viewModel: GameEngineStoreViewModel) => void;

export type GameEngineStoreContext = {
    readonly state: Readonly<GameEngineStoreState>;
    readonly createCardContent: (definition: HandCardDefinition) => HandCardContent;
    readonly findCardByInstanceId: (instanceId: string) => HandCardContent | undefined;
    readonly createDebugCard?: () => HandCardDefinition;
};

export interface GameEngineStoreCommand {
    execute(context: GameEngineStoreContext): GameEvent[];
}

export abstract class BaseGameEngineStoreCommand implements GameEngineStoreCommand {
    abstract execute(context: GameEngineStoreContext): GameEvent[];
}

export class GameEngineStore {
    private readonly engine: GameEngine;
    private readonly subscribers = new Set<GameEngineStoreSubscriber>();
    private state: GameEngineStoreState;
    private viewModel: GameEngineStoreViewModel;
    private readonly createDebugCard?: () => HandCardDefinition;
    private readonly unsubscribeFromEngine: () => void;

    constructor(engine: GameEngine, options: GameEngineStoreOptions = {}) {
        this.engine = engine;
        this.createDebugCard = options.createDebugCard;

        const initialHand = (options.initialHand ?? []).map((definition) => this.createCardContent(definition));
        this.state = { hand: initialHand };
        this.viewModel = { ...engine.getViewModel(), hand: this.state.hand };

        this.unsubscribeFromEngine = this.engine.subscribe(this.handleEngineEvent);
    }

    public getViewModel(): GameEngineStoreViewModel {
        return this.viewModel;
    }

    public subscribe(subscriber: GameEngineStoreSubscriber): () => void {
        this.subscribers.add(subscriber);
        subscriber({ type: "state:sync" }, this.viewModel);
        return () => this.unsubscribe(subscriber);
    }

    public unsubscribe(subscriber: GameEngineStoreSubscriber): void {
        this.subscribers.delete(subscriber);
    }

    public dispatch(command: GameCommand | GameEngineStoreCommand): GameEvent[] {
        if (command instanceof BaseGameEngineStoreCommand) {
            const events = command.execute(this.createContext()) ?? [];
            for (const event of events) {
                this.applyEvent(event);
                this.notify(event);
            }
            return events;
        }

        return this.engine.dispatch(command as GameCommand);
    }

    public destroy(): void {
        this.unsubscribeFromEngine();
        this.subscribers.clear();
    }

    private readonly handleEngineEvent = (event: GameEvent, viewModel: GameViewModel): void => {
        this.viewModel = { ...viewModel, hand: this.state.hand };
        this.notify(event);
    };

    private createContext(): GameEngineStoreContext {
        return {
            state: this.state,
            createCardContent: (definition) => this.createCardContent(definition),
            findCardByInstanceId: (instanceId) => this.findCardByInstanceId(instanceId),
            createDebugCard: this.createDebugCard,
        };
    }

    private createCardContent(definition: HandCardDefinition): HandCardContent {
        return {
            ...definition,
            instanceId: generateCardInstanceId(definition.id),
        };
    }

    private findCardByInstanceId(instanceId: string): HandCardContent | undefined {
        return this.state.hand.find((card) => card.instanceId === instanceId);
    }

    private applyEvent(event: GameEvent): void {
        switch (event.type) {
            case "card:added": {
                const nextHand = [...this.state.hand, event.card];
                this.state = { hand: nextHand };
                this.viewModel = { ...this.viewModel, hand: nextHand };
                return;
            }
            case "card:consumed": {
                const nextHand = this.state.hand.filter((card) => card.instanceId !== event.card.instanceId);
                this.state = { hand: nextHand };
                this.viewModel = { ...this.viewModel, hand: nextHand };
                return;
            }
            case "hand:sync": {
                const nextHand = [...event.hand];
                this.state = { hand: nextHand };
                this.viewModel = { ...this.viewModel, hand: nextHand };
                return;
            }
            default: {
                return;
            }
        }
    }

    private notify(event: GameEvent): void {
        if (this.subscribers.size === 0) {
            return;
        }

        for (const subscriber of this.subscribers) {
            subscriber(event, this.viewModel);
        }
    }
}

export class DrawCardCommand extends BaseGameEngineStoreCommand {
    constructor(private readonly definition: HandCardDefinition) {
        super();
    }

    execute(context: GameEngineStoreContext): GameEvent[] {
        const card = context.createCardContent(this.definition);
        const nextHand = [...context.state.hand, card];
        return [
            { type: "card:added", card, reason: "draw" },
            { type: "hand:sync", hand: nextHand },
        ];
    }
}

export class ConsumeCardCommand extends BaseGameEngineStoreCommand {
    constructor(private readonly instanceId: string) {
        super();
    }

    execute(context: GameEngineStoreContext): GameEvent[] {
        const card = context.findCardByInstanceId(this.instanceId);
        if (!card) {
            return [];
        }

        const nextHand = context.state.hand.filter((entry) => entry.instanceId !== card.instanceId);
        return [
            { type: "card:consumed", card, reason: "consume" },
            { type: "hand:sync", hand: nextHand },
        ];
    }
}

export class AddDebugCardCommand extends BaseGameEngineStoreCommand {
    execute(context: GameEngineStoreContext): GameEvent[] {
        const factory = context.createDebugCard;
        if (!factory) {
            return [
                { type: "log", channel: "system", message: "hand:debug_card_factory:missing" },
            ];
        }

        const definition = factory();
        if (!definition) {
            return [
                { type: "log", channel: "system", message: "hand:debug_card_factory:empty" },
            ];
        }
        const card = context.createCardContent(definition);
        const nextHand = [...context.state.hand, card];

        return [
            { type: "card:added", card, reason: "debug" },
            { type: "hand:sync", hand: nextHand },
            { type: "log", channel: "system", message: `hand:debug_card_added:${card.id}` },
        ];
    }
}
