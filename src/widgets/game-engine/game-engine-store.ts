import { EventDeck } from "../event-deck/event-deck";
import {
    type ExpeditionMap,
    type ExpeditionMapConfig,
    type TerritoryConfig,
} from "../expedition-map/expedition-map";
import {
    generateCardInstanceId,
    type HandCardContent,
    type HandCardDefinition,
} from "./game-engine-cards";

export type GameEnginePlayerConfig = {
    id: string;
    name: string;
    label?: string;
    color?: string;
    textColor?: string;
    image?: string;
};

export type GameEngineConfig = {
    player: GameEnginePlayerConfig;
    map: ExpeditionMap;
    mapConfig: ExpeditionMapConfig;
    initialActions: number;
    playerCount?: number;
    eventDeck?: EventDeck;
    onActionsChange?: (actions: number) => void;
};

export type GameEngineState = {
    currentLocationId: string | null;
    actionsRemaining: number;
    userLog: readonly string[];
    systemLog: readonly string[];
};

export type GameViewModel = {
    readonly currentLocationId: string | null;
    readonly currentLocationTitle: string | null;
    readonly actionsRemaining: number;
    readonly userLog: readonly string[];
    readonly systemLog: readonly string[];
    readonly hand: readonly HandCardContent[];
};

export type GameEvent =
    | { type: "state:sync" }
    | { type: "log"; channel: "user" | "system"; message: string }
    | { type: "actions:update"; actionsRemaining: number }
    | { type: "location:reveal"; locationId: string }
    | { type: "player:place"; locationId: string }
    | { type: "location:set"; locationId: string }
    | { type: "move:success"; card: MoveCardDescriptor; from: string; to: string }
    | { type: "move:failure"; card: MoveCardDescriptor; reason: MoveFailureReason; message: string }
    | { type: "turn:ended"; actionsRemaining: number; drawnEvents: number }
    | { type: "card:added"; card: HandCardContent; reason?: "draw" | "debug" | "manual" }
    | { type: "card:consumed"; card: HandCardContent; reason?: "consume" | "discard" | "debug" }
    | { type: "hand:sync"; hand: readonly HandCardContent[] };

export type GameEventSubscriber = (event: GameEvent, viewModel: GameViewModel) => void;

export type MoveCardDescriptor = {
    id: string;
    title: string;
    cost: number;
};

export type MoveFailureReason =
    | "no-current-location"
    | "unknown-location"
    | "not-adjacent"
    | "not-enough-actions";

export type GameEngineContext = {
    readonly state: Readonly<GameEngineState>;
    readonly config: GameEngineConfig;
    readonly eventDeck?: EventDeck;
    readonly playerCount: number;
    readonly initialActions: number;
};

export type GameEngineStoreContext = GameEngineContext & {
    readonly hand: readonly HandCardContent[];
    readonly createCardContent: (definition: HandCardDefinition) => HandCardContent;
    readonly findCardByInstanceId: (instanceId: string) => HandCardContent | undefined;
    readonly createDebugCard?: () => HandCardDefinition | undefined;
};

export interface GameCommand {
    execute(context: GameEngineContext): GameEvent[];
}

export interface GameEngineStoreCommand {
    execute(context: GameEngineStoreContext): GameEvent[];
}

export abstract class BaseGameEngineStoreCommand implements GameEngineStoreCommand {
    abstract execute(context: GameEngineStoreContext): GameEvent[];
}

export type GameEngineStoreOptions = {
    readonly initialHand?: readonly HandCardDefinition[];
    readonly createDebugCard?: () => HandCardDefinition | undefined;
};

export class GameEngineStore {
    private readonly config: GameEngineConfig;
    private readonly eventDeck?: EventDeck;
    private readonly territoryLookup = new Map<string, TerritoryConfig>();
    private readonly playerCount: number;
    private readonly initialActions: number;
    private readonly subscribers = new Set<GameEventSubscriber>();
    private readonly executedCommands: GameCommand[] = [];
    private readonly createDebugCard?: () => HandCardDefinition | undefined;

    private initialized = false;
    private state: GameEngineState;
    private hand: readonly HandCardContent[];
    private viewModel: GameViewModel;

    constructor(config: GameEngineConfig, options: GameEngineStoreOptions = {}) {
        this.config = config;
        this.eventDeck = config.eventDeck;
        this.createDebugCard = options.createDebugCard;

        const configuredPlayerCount = config.playerCount;
        const normalizedPlayerCount =
            typeof configuredPlayerCount === "number" && Number.isFinite(configuredPlayerCount)
                ? Math.max(1, Math.floor(configuredPlayerCount))
                : 1;
        this.playerCount = normalizedPlayerCount;

        for (const territory of config.mapConfig.territories) {
            this.territoryLookup.set(territory.id, territory);
        }

        const initialActions = Number.isFinite(config.initialActions)
            ? Math.max(0, Math.floor(config.initialActions))
            : 0;
        this.initialActions = initialActions;

        const initialHand = (options.initialHand ?? []).map((definition) => this.createCardContent(definition));
        this.hand = initialHand;

        this.state = {
            currentLocationId: null,
            actionsRemaining: this.initialActions,
            userLog: [],
            systemLog: [],
        };

        this.viewModel = this.buildViewModel();
        this.config.onActionsChange?.(this.state.actionsRemaining);
    }

    public initialize(): void {
        if (this.initialized) {
            return;
        }
        this.initialized = true;
        this.bootstrapInitialLocation();
    }

    public getViewModel(): GameViewModel {
        return this.viewModel;
    }

    public subscribe(subscriber: GameEventSubscriber): () => void {
        this.subscribers.add(subscriber);
        subscriber({ type: "state:sync" }, this.viewModel);
        return () => this.unsubscribe(subscriber);
    }

    public unsubscribe(subscriber: GameEventSubscriber): void {
        this.subscribers.delete(subscriber);
    }

    public dispatch(command: GameCommand | GameEngineStoreCommand): GameEvent[] {
        const events =
            command instanceof BaseGameEngineStoreCommand
                ? command.execute(this.createStoreContext()) ?? []
                : command.execute(this.createBaseContext()) ?? [];

        for (const event of events) {
            this.applyEvent(event);
            this.notify(event);
        }

        if (!(command instanceof BaseGameEngineStoreCommand)) {
            this.executedCommands.push(command);
        }

        return events;
    }

    private createBaseContext(): GameEngineContext {
        return {
            state: this.state,
            config: this.config,
            eventDeck: this.eventDeck,
            playerCount: this.playerCount,
            initialActions: this.initialActions,
        };
    }

    private createStoreContext(): GameEngineStoreContext {
        return {
            ...this.createBaseContext(),
            hand: this.hand,
            createCardContent: (definition) => this.createCardContent(definition),
            findCardByInstanceId: (instanceId) => this.findCardByInstanceId(instanceId),
            createDebugCard: this.createDebugCard,
        };
    }

    private applyEvent(event: GameEvent): void {
        switch (event.type) {
            case "state:sync": {
                break;
            }
            case "log": {
                this.appendLog(event.channel, event.message);
                break;
            }
            case "actions:update": {
                this.updateActions(event.actionsRemaining);
                break;
            }
            case "location:reveal": {
                this.revealLocation(event.locationId);
                break;
            }
            case "player:place": {
                this.placePlayer(event.locationId);
                break;
            }
            case "location:set": {
                this.setCurrentLocation(event.locationId);
                break;
            }
            case "move:success":
            case "move:failure":
            case "turn:ended": {
                break;
            }
            case "card:added": {
                this.hand = [...this.hand, event.card];
                break;
            }
            case "card:consumed": {
                this.hand = this.hand.filter((card) => card.instanceId !== event.card.instanceId);
                break;
            }
            case "hand:sync": {
                this.hand = [...event.hand];
                break;
            }
        }

        this.viewModel = this.buildViewModel();
    }

    private notify(event: GameEvent): void {
        if (this.subscribers.size === 0) {
            return;
        }

        for (const subscriber of this.subscribers) {
            subscriber(event, this.viewModel);
        }
    }

    private appendLog(channel: "user" | "system", message: string): void {
        if (channel === "user") {
            this.state = {
                ...this.state,
                userLog: [...this.state.userLog, message],
            };
            return;
        }

        this.state = {
            ...this.state,
            systemLog: [...this.state.systemLog, message],
        };
    }

    private updateActions(actions: number): void {
        const normalized = Math.max(0, actions);
        this.state = {
            ...this.state,
            actionsRemaining: normalized,
        };
        this.config.onActionsChange?.(this.state.actionsRemaining);
    }

    private revealLocation(locationId: string): void {
        this.config.map.revealTerritory(locationId);
    }

    private placePlayer(locationId: string): void {
        const { player } = this.config;
        this.config.map.placeCharacter(
            {
                id: player.id,
                name: player.name,
                label: player.label,
                color: player.color,
                textColor: player.textColor,
                image: player.image,
            },
            locationId,
        );
    }

    private setCurrentLocation(locationId: string | null): void {
        this.state = { ...this.state, currentLocationId: locationId };
    }

    private buildViewModel(): GameViewModel {
        const locationTitle = this.state.currentLocationId
            ? this.resolveLocationTitle(this.state.currentLocationId)
            : null;

        return {
            currentLocationId: this.state.currentLocationId,
            currentLocationTitle: locationTitle,
            actionsRemaining: this.state.actionsRemaining,
            userLog: this.state.userLog,
            systemLog: this.state.systemLog,
            hand: this.hand,
        };
    }

    private bootstrapInitialLocation(): void {
        const territory = this.config.mapConfig.territories[0];
        if (!territory) {
            const event: GameEvent = {
                type: "log",
                channel: "system",
                message: "bootstrap: нет доступных территорий для размещения персонажа",
            };
            this.applyEvent(event);
            this.notify(event);
            return;
        }

        this.dispatch(new EnterLocationCommand(territory.id));
    }

    private resolveLocationTitle(id: string): string | null {
        const territory = this.getTerritory(id);
        return territory ? territory.front.title : null;
    }

    private getTerritory(id: string): TerritoryConfig | undefined {
        return this.territoryLookup.get(id);
    }

    private createCardContent(definition: HandCardDefinition): HandCardContent {
        return {
            ...definition,
            instanceId: generateCardInstanceId(definition.id),
        };
    }

    private findCardByInstanceId(instanceId: string): HandCardContent | undefined {
        return this.hand.find((card) => card.instanceId === instanceId);
    }
}

function findTerritory(mapConfig: ExpeditionMapConfig, id: string): TerritoryConfig | undefined {
    return mapConfig.territories.find((entry) => entry.id === id);
}

function isAdjacent(mapConfig: ExpeditionMapConfig, fromId: string, toId: string): boolean {
    if (fromId === toId) {
        return false;
    }

    const fromTerritory = findTerritory(mapConfig, fromId);
    if (!fromTerritory) {
        return false;
    }

    return fromTerritory.connections.some((connection) => {
        if (connection.targetId === toId) {
            return true;
        }

        if (connection.type !== "two-way") {
            return false;
        }

        const targetTerritory = findTerritory(mapConfig, connection.targetId);
        if (!targetTerritory) {
            return false;
        }

        return targetTerritory.connections.some((targetConnection) => targetConnection.targetId === fromId);
    });
}

function resolveEventNoun(count: number): string {
    const remainder10 = count % 10;
    const remainder100 = count % 100;

    if (remainder10 === 1 && remainder100 !== 11) {
        return "событие";
    }

    if (remainder10 >= 2 && remainder10 <= 4 && (remainder100 < 12 || remainder100 > 14)) {
        return "события";
    }

    return "событий";
}

export class MoveWithCardCommand implements GameCommand {
    constructor(private readonly card: MoveCardDescriptor, private readonly targetLocationId: string) {}

    public execute(context: GameEngineContext): GameEvent[] {
        const card = this.card;
        const targetLocationId = this.targetLocationId;
        const events: GameEvent[] = [];

        const currentLocationId = context.state.currentLocationId;
        if (!currentLocationId) {
            const reason: MoveFailureReason = "no-current-location";
            const message = `${context.config.player.name} не знает, где находится. Карта не сработала.`;
            events.push({ type: "log", channel: "user", message });
            events.push({ type: "log", channel: "system", message: `move:${card.id}:failure:${reason}` });
            events.push({ type: "move:failure", card, reason, message });
            return events;
        }

        const mapConfig = context.config.mapConfig;
        const targetTerritory = findTerritory(mapConfig, targetLocationId);
        if (!targetTerritory) {
            const reason: MoveFailureReason = "unknown-location";
            const message = `${context.config.player.name} пытается добраться до неизвестной локации.`;
            events.push({ type: "log", channel: "user", message });
            events.push({ type: "log", channel: "system", message: `move:${card.id}:failure:${reason}` });
            events.push({ type: "move:failure", card, reason, message });
            return events;
        }

        if (!isAdjacent(mapConfig, currentLocationId, targetLocationId)) {
            const reason: MoveFailureReason = "not-adjacent";
            const message = `${context.config.player.name} не может пройти напрямую в ${targetTerritory.front.title}.`;
            events.push({ type: "log", channel: "user", message });
            events.push({ type: "log", channel: "system", message: `move:${card.id}:failure:${reason}` });
            events.push({ type: "move:failure", card, reason, message });
            return events;
        }

        if (context.state.actionsRemaining < card.cost) {
            const reason: MoveFailureReason = "not-enough-actions";
            const message = `${context.config.player.name} устал и не может потратить ${card.cost} действий.`;
            events.push({ type: "log", channel: "user", message });
            events.push({ type: "log", channel: "system", message: `move:${card.id}:failure:${reason}` });
            events.push({ type: "move:failure", card, reason, message });
            return events;
        }

        const nextActions = context.state.actionsRemaining - card.cost;
        const playerName = context.config.player.name;
        const userMessage = `${playerName} использует «${card.title}» и перемещается в ${targetTerritory.front.title}.`;

        events.push({ type: "actions:update", actionsRemaining: nextActions });
        events.push({ type: "location:reveal", locationId: targetLocationId });
        events.push({ type: "player:place", locationId: targetLocationId });
        events.push({ type: "location:set", locationId: targetLocationId });
        events.push({ type: "log", channel: "user", message: userMessage });
        events.push({
            type: "log",
            channel: "system",
            message: `move:${card.id}:${currentLocationId}->${targetLocationId}`,
        });
        events.push({ type: "move:success", card, from: currentLocationId, to: targetLocationId });

        return events;
    }
}

export class EndTurnCommand implements GameCommand {
    public execute(context: GameEngineContext): GameEvent[] {
        const events: GameEvent[] = [];
        const playerName = context.config.player.name;

        events.push({ type: "log", channel: "user", message: `${playerName} завершает ход.` });
        events.push({ type: "log", channel: "system", message: `turn:end:start:${playerName}` });

        let drawn = 0;
        let userMessageHandled = false;

        const deck = context.eventDeck;
        if (!deck) {
            events.push({ type: "log", channel: "system", message: "turn:end:event_deck:missing" });
            events.push({
                type: "log",
                channel: "user",
                message: "Колода событий недоступна — этап событий пропущен.",
            });
            userMessageHandled = true;
        } else if (context.playerCount <= 0) {
            events.push({ type: "log", channel: "system", message: "turn:end:event_deck:skipped:no_players" });
            userMessageHandled = true;
        } else {
            const cards = deck.revealEvents(context.playerCount);
            drawn = cards.length;

            if (drawn === 0) {
                events.push({ type: "log", channel: "system", message: "turn:end:event_deck:empty" });
                events.push({ type: "log", channel: "user", message: "Новых событий не произошло." });
                userMessageHandled = true;
            }
        }

        if (drawn > 0) {
            const noun = resolveEventNoun(drawn);
            events.push({ type: "log", channel: "user", message: `Судьба раскрывает ${drawn} ${noun}.` });
            events.push({ type: "log", channel: "system", message: `turn:end:events:${drawn}` });
        } else {
            events.push({ type: "log", channel: "system", message: "turn:end:events:0" });
            if (!userMessageHandled) {
                events.push({ type: "log", channel: "user", message: "Новых событий не произошло." });
            }
        }

        events.push({ type: "actions:update", actionsRemaining: context.initialActions });
        events.push({
            type: "log",
            channel: "user",
            message: `Очки действий восстановлены до ${context.initialActions}.`,
        });
        events.push({
            type: "log",
            channel: "system",
            message: `turn:end:actions_reset:${context.initialActions}`,
        });

        events.push({ type: "turn:ended", actionsRemaining: context.initialActions, drawnEvents: drawn });

        return events;
    }
}

export class PostLogCommand implements GameCommand {
    constructor(private readonly channel: "user" | "system", private readonly message: string) {}

    public execute(): GameEvent[] {
        return [{ type: "log", channel: this.channel, message: this.message }];
    }
}

export class EnterLocationCommand implements GameCommand {
    constructor(private readonly locationId: string) {}

    public execute(context: GameEngineContext): GameEvent[] {
        const territory = findTerritory(context.config.mapConfig, this.locationId);
        if (!territory) {
            return [
                {
                    type: "log",
                    channel: "system",
                    message: `enter_location: территория ${this.locationId} не найдена`,
                },
            ];
        }

        const events: GameEvent[] = [
            { type: "location:reveal", locationId: this.locationId },
            { type: "player:place", locationId: this.locationId },
            { type: "location:set", locationId: this.locationId },
        ];

        const playerName = context.config.player.name;
        events.push({ type: "log", channel: "user", message: `${playerName} заходит на ${territory.front.title}` });
        events.push({ type: "log", channel: "system", message: `enter_location:${this.locationId}` });

        return events;
    }
}

export class DrawCardCommand extends BaseGameEngineStoreCommand {
    constructor(private readonly definition: HandCardDefinition) {
        super();
    }

    execute(context: GameEngineStoreContext): GameEvent[] {
        const card = context.createCardContent(this.definition);
        const nextHand = [...context.hand, card];
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

        const nextHand = context.hand.filter((entry) => entry.instanceId !== card.instanceId);
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
        const nextHand = [...context.hand, card];

        return [
            { type: "card:added", card, reason: "debug" },
            { type: "hand:sync", hand: nextHand },
            { type: "log", channel: "system", message: `hand:debug_card_added:${card.id}` },
        ];
    }
}
