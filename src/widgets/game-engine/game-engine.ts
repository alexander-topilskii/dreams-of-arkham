import { EventDeck } from "../event-deck/event-deck";
import { ExpeditionMap, type ExpeditionMapConfig, type TerritoryConfig } from "../expedition-map/expedition-map";
import type { HandCardContent } from "./game-engine-cards";

const STYLE_ID = "game-engine-widget-styles";

function ensureStylesMounted() {
    if (document.getElementById(STYLE_ID)) {
        return;
    }

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
        .game-engine-widget {
            display: flex;
            flex-direction: column;
            gap: 12px;
            width: 100%;
            border-radius: 16px;
            border: 1px solid rgba(148, 163, 184, 0.18);
            background: linear-gradient(145deg, rgba(30, 41, 59, 0.9), rgba(15, 23, 42, 0.95));
            box-shadow: 0 18px 32px rgba(15, 23, 42, 0.45);
            padding: 16px;
            margin-top: var(--pad, 12px);
            max-height: calc(100% - var(--pad, 12px));
            overflow-y: auto;
            overflow-x: hidden;
            color: #e2e8f0;
            font-family: "Rubik", "Segoe UI", system-ui, sans-serif;
        }

        .game-engine-widget__header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 8px;
        }

        .game-engine-widget__title {
            margin: 0;
            font-size: 0.95rem;
            letter-spacing: 0.08em;
            text-transform: uppercase;
            opacity: 0.8;
        }

        .game-engine-widget__state {
            font-size: 0.85rem;
            color: rgba(226, 232, 240, 0.75);
        }

        .game-engine-widget__body {
            display: grid;
            gap: 16px;
            grid-template-columns: repeat(auto-fit, minmax(0, 1fr));
            min-height: 0;
        }

        .game-engine-widget__column {
            display: flex;
            flex-direction: column;
            gap: 8px;
            min-width: 0;
            min-height: 0;
        }

        .game-engine-widget__column-title {
            margin: 0;
            font-size: 0.8rem;
            letter-spacing: 0.06em;
            text-transform: uppercase;
            color: rgba(226, 232, 240, 0.6);
        }

        .game-engine-widget__log {
            list-style: none;
            margin: 0;
            padding: 0;
            display: flex;
            flex-direction: column;
            gap: 6px;
            font-size: 0.9rem;
            min-height: 80px;
        }

        .game-engine-widget__log-item {
            padding: 8px 10px;
            border-radius: 10px;
            background: rgba(15, 23, 42, 0.55);
            border: 1px solid rgba(148, 163, 184, 0.15);
            line-height: 1.4;
        }

        .game-engine-widget__log-item--system {
            font-family: "JetBrains Mono", "Fira Code", monospace;
            font-size: 0.8rem;
            letter-spacing: 0.03em;
            color: rgba(148, 163, 184, 0.85);
        }

        .game-engine-widget__empty {
            padding: 8px 10px;
            border-radius: 10px;
            border: 1px dashed rgba(148, 163, 184, 0.3);
            color: rgba(226, 232, 240, 0.45);
            font-size: 0.85rem;
            text-align: center;
        }
    `;

    document.head.appendChild(style);
}

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
    | { type: 'state:sync' }
    | { type: 'log'; channel: 'user' | 'system'; message: string }
    | { type: 'actions:update'; actionsRemaining: number }
    | { type: 'location:reveal'; locationId: string }
    | { type: 'player:place'; locationId: string }
    | { type: 'location:set'; locationId: string }
    | { type: 'move:success'; card: MoveCardDescriptor; from: string; to: string }
    | { type: 'move:failure'; card: MoveCardDescriptor; reason: MoveFailureReason; message: string }
    | { type: 'turn:ended'; actionsRemaining: number; drawnEvents: number }
    | { type: 'card:added'; card: HandCardContent; reason?: 'draw' | 'debug' | 'manual' }
    | { type: 'card:consumed'; card: HandCardContent; reason?: 'consume' | 'discard' | 'debug' }
    | { type: 'hand:sync'; hand: readonly HandCardContent[] };

export type GameEventSubscriber = (event: GameEvent, viewModel: GameViewModel) => void;

export interface GameEngineContext {
    readonly state: Readonly<GameEngineState>;
    readonly config: GameEngineConfig;
    readonly eventDeck?: EventDeck;
    readonly playerCount: number;
    readonly initialActions: number;
}

export interface GameCommand {
    execute(context: GameEngineContext): GameEvent[];
}

export type MoveCardDescriptor = {
    id: string;
    title: string;
    cost: number;
};

export type MoveFailureReason = 'no-current-location' | 'unknown-location' | 'not-adjacent' | 'not-enough-actions';

export class GameEngine {
    private readonly root: HTMLElement;
    private readonly config: GameEngineConfig;
    private readonly territoryLookup = new Map<string, TerritoryConfig>();
    private readonly eventDeck?: EventDeck;
    private readonly playerCount: number;
    private readonly initialActions: number;

    private readonly userLogList: HTMLUListElement;
    private readonly systemLogList: HTMLUListElement;
    private readonly stateElement: HTMLDivElement;

    private state: GameEngineState;
    private readonly subscribers = new Set<GameEventSubscriber>();
    private readonly executedCommands: GameCommand[] = [];
    private initialized = false;

    constructor(root: HTMLElement | null | undefined, config: GameEngineConfig) {
        this.root = root ?? document.createElement("div");
        this.config = config;
        this.eventDeck = config.eventDeck;

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
        this.state = {
            currentLocationId: null,
            actionsRemaining: this.initialActions,
            userLog: [],
            systemLog: [],
        };

        this.config.onActionsChange?.(this.state.actionsRemaining);

        ensureStylesMounted();

        this.root.classList.add("game-engine-widget");
        this.root.innerHTML = "";

        const header = document.createElement("div");
        header.className = "game-engine-widget__header";

        const title = document.createElement("h2");
        title.className = "game-engine-widget__title";
        title.textContent = "Игровой движок";

        this.stateElement = document.createElement("div");
        this.stateElement.className = "game-engine-widget__state";

        header.append(title, this.stateElement);

        const body = document.createElement("div");
        body.className = "game-engine-widget__body";

        const userColumn = document.createElement("section");
        userColumn.className = "game-engine-widget__column";

        const userTitle = document.createElement("h3");
        userTitle.className = "game-engine-widget__column-title";
        userTitle.textContent = "Хроники";

        this.userLogList = document.createElement("ul");
        this.userLogList.className = "game-engine-widget__log";

        userColumn.append(userTitle, this.userLogList);

        const systemColumn = document.createElement("section");
        systemColumn.className = "game-engine-widget__column";

        const systemTitle = document.createElement("h3");
        systemTitle.className = "game-engine-widget__column-title";
        systemTitle.textContent = "Системный журнал";

        this.systemLogList = document.createElement("ul");
        this.systemLogList.className = "game-engine-widget__log";

        systemColumn.append(systemTitle, this.systemLogList);

        body.append(userColumn, systemColumn);

        this.root.append(header, body);

        this.render();
    }

    public initialize(): void {
        if (this.initialized) {
            return;
        }
        this.initialized = true;
        this.bootstrapInitialLocation();
    }


    public dispatch(command: GameCommand): GameEvent[] {
        const context: GameEngineContext = {
            state: this.state,
            config: this.config,
            eventDeck: this.eventDeck,
            playerCount: this.playerCount,
            initialActions: this.initialActions,
        };

        const events = command.execute(context) ?? [];

        for (const event of events) {
            this.applyEvent(event);
            this.notifySubscribers(event);
        }

        this.executedCommands.push(command);
        this.render();

        return events;
    }

    public subscribe(subscriber: GameEventSubscriber): () => void {
        this.subscribers.add(subscriber);
        subscriber({ type: 'state:sync' }, this.getViewModel());
        return () => this.unsubscribe(subscriber);
    }

    public unsubscribe(subscriber: GameEventSubscriber): void {
        this.subscribers.delete(subscriber);
    }

    public getViewModel(): GameViewModel {
        return this.buildViewModel();
    }

    private notifySubscribers(event: GameEvent): void {
        if (this.subscribers.size === 0) {
            return;
        }

        const viewModel = this.getViewModel();
        for (const subscriber of this.subscribers) {
            subscriber(event, viewModel);
        }
    }

    private applyEvent(event: GameEvent): void {
        switch (event.type) {
            case 'state:sync': {
                return;
            }
            case 'log': {
                this.appendLog(event.channel, event.message);
                return;
            }
            case 'actions:update': {
                this.updateActions(event.actionsRemaining);
                return;
            }
            case 'location:reveal': {
                this.revealLocation(event.locationId);
                return;
            }
            case 'player:place': {
                this.placePlayer(event.locationId);
                return;
            }
            case 'location:set': {
                this.setCurrentLocation(event.locationId);
                return;
            }
            case 'move:success':
            case 'move:failure':
            case 'turn:ended': {
                return;
            }
            case 'card:added':
            case 'card:consumed':
            case 'hand:sync': {
                return;
            }
        }
    }

    private appendLog(channel: 'user' | 'system', message: string): void {
        if (channel === 'user') {
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
            locationId
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
            hand: [],
        };
    }

    private bootstrapInitialLocation(): void {
        const territory = this.config.mapConfig.territories[0];
        if (!territory) {
            const event: GameEvent = {
                type: 'log',
                channel: 'system',
                message: 'bootstrap: нет доступных территорий для размещения персонажа',
            };
            this.applyEvent(event);
            this.notifySubscribers(event);
            this.render();
            return;
        }

        this.dispatch(new EnterLocationCommand(territory.id));
    }

    private render(): void {
        const viewModel = this.getViewModel();
        const actionsText = `Действия: ${viewModel.actionsRemaining}`;

        if (viewModel.currentLocationTitle) {
            this.stateElement.textContent = `Текущая локация: ${viewModel.currentLocationTitle} · ${actionsText}`;
        } else {
            this.stateElement.textContent = `Текущая локация: неизвестно · ${actionsText}`;
        }

        this.renderLog(this.userLogList, viewModel.userLog, "Пока ничего не произошло.");
        this.renderLog(
            this.systemLogList,
            viewModel.systemLog,
            "Системных действий не зарегистрировано.",
            true
        );
    }

    private renderLog(
        list: HTMLUListElement,
        items: readonly string[],
        emptyLabel: string,
        isSystem = false
    ): void {
        list.innerHTML = "";

        if (!items.length) {
            const empty = document.createElement("li");
            empty.className = "game-engine-widget__empty";
            empty.textContent = emptyLabel;
            list.appendChild(empty);
            return;
        }

        for (const item of items) {
            const li = document.createElement("li");
            li.className =
                "game-engine-widget__log-item" + (isSystem ? " game-engine-widget__log-item--system" : "");
            li.textContent = item;
            list.appendChild(li);
        }
    }

    private resolveLocationTitle(id: string): string | null {
        const territory = this.getTerritory(id);
        return territory ? territory.front.title : null;
    }

    private getTerritory(id: string): TerritoryConfig | undefined {
        return this.territoryLookup.get(id);
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

    return fromTerritory.connections.some((connection) => connection.targetId === toId);
}

function resolveEventNoun(amount: number): string {
    const mod10 = amount % 10;
    const mod100 = amount % 100;

    if (mod10 === 1 && mod100 !== 11) {
        return "событие";
    }

    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) {
        return "события";
    }

    return "событий";
}

export class MoveWithCardCommand implements GameCommand {
    constructor(private readonly card: MoveCardDescriptor, private readonly targetLocationId: string) {}

    public execute(context: GameEngineContext): GameEvent[] {
        const { card, targetLocationId } = this;
        const events: GameEvent[] = [];
        const targetTerritory = findTerritory(context.config.mapConfig, targetLocationId);

        if (!targetTerritory) {
            const message = `Локация ${targetLocationId} не найдена на карте.`;
            events.push({ type: 'log', channel: 'system', message: `move_denied:unknown_location:${targetLocationId}` });
            events.push({ type: 'log', channel: 'user', message });
            events.push({ type: 'move:failure', card, reason: 'unknown-location', message });
            return events;
        }

        const currentLocationId = context.state.currentLocationId;
        if (!currentLocationId) {
            const message = `Персонаж ещё не размещён на карте. Использование «${card.title}» невозможно.`;
            events.push({ type: 'log', channel: 'user', message });
            events.push({ type: 'log', channel: 'system', message: `move_denied:no_current_location:${card.id}` });
            events.push({ type: 'move:failure', card, reason: 'no-current-location', message });
            return events;
        }

        if (!isAdjacent(context.config.mapConfig, currentLocationId, targetLocationId)) {
            const currentTitle = findTerritory(context.config.mapConfig, currentLocationId)?.front.title ?? currentLocationId;
            const message = `${targetTerritory.front.title} слишком далеко от ${currentTitle}.`;
            events.push({ type: 'log', channel: 'user', message });
            events.push({
                type: 'log',
                channel: 'system',
                message: `move_denied:not_adjacent:${currentLocationId}->${targetLocationId}`,
            });
            events.push({ type: 'move:failure', card, reason: 'not-adjacent', message });
            return events;
        }

        if (context.state.actionsRemaining < card.cost) {
            const message = `Недостаточно действий для «${card.title}»: требуется ${card.cost}, доступно ${context.state.actionsRemaining}.`;
            events.push({ type: 'log', channel: 'user', message });
            events.push({
                type: 'log',
                channel: 'system',
                message: `move_denied:not_enough_actions:${card.id}:${card.cost}>${context.state.actionsRemaining}`,
            });
            events.push({ type: 'move:failure', card, reason: 'not-enough-actions', message });
            return events;
        }

        const nextActions = context.state.actionsRemaining - card.cost;
        const playerName = context.config.player.name;
        const userMessage = `${playerName} использует «${card.title}» и перемещается в ${targetTerritory.front.title}.`;

        events.push({ type: 'actions:update', actionsRemaining: nextActions });
        events.push({ type: 'location:reveal', locationId: targetLocationId });
        events.push({ type: 'player:place', locationId: targetLocationId });
        events.push({ type: 'location:set', locationId: targetLocationId });
        events.push({ type: 'log', channel: 'user', message: userMessage });
        events.push({
            type: 'log',
            channel: 'system',
            message: `move:${card.id}:${currentLocationId}->${targetLocationId}`,
        });
        events.push({ type: 'move:success', card, from: currentLocationId, to: targetLocationId });

        return events;
    }
}

export class EndTurnCommand implements GameCommand {
    public execute(context: GameEngineContext): GameEvent[] {
        const events: GameEvent[] = [];
        const playerName = context.config.player.name;

        events.push({ type: 'log', channel: 'user', message: `${playerName} завершает ход.` });
        events.push({ type: 'log', channel: 'system', message: `turn:end:start:${playerName}` });

        let drawn = 0;
        let userMessageHandled = false;

        const deck = context.eventDeck;
        if (!deck) {
            events.push({ type: 'log', channel: 'system', message: 'turn:end:event_deck:missing' });
            events.push({
                type: 'log',
                channel: 'user',
                message: 'Колода событий недоступна — этап событий пропущен.',
            });
            userMessageHandled = true;
        } else if (context.playerCount <= 0) {
            events.push({ type: 'log', channel: 'system', message: 'turn:end:event_deck:skipped:no_players' });
            userMessageHandled = true;
        } else {
            const cards = deck.revealEvents(context.playerCount);
            drawn = cards.length;

            if (drawn === 0) {
                events.push({ type: 'log', channel: 'system', message: 'turn:end:event_deck:empty' });
                events.push({ type: 'log', channel: 'user', message: 'Новых событий не произошло.' });
                userMessageHandled = true;
            }
        }

        if (drawn > 0) {
            const noun = resolveEventNoun(drawn);
            events.push({ type: 'log', channel: 'user', message: `Судьба раскрывает ${drawn} ${noun}.` });
            events.push({ type: 'log', channel: 'system', message: `turn:end:events:${drawn}` });
        } else {
            events.push({ type: 'log', channel: 'system', message: 'turn:end:events:0' });
            if (!userMessageHandled) {
                events.push({ type: 'log', channel: 'user', message: 'Новых событий не произошло.' });
            }
        }

        events.push({ type: 'actions:update', actionsRemaining: context.initialActions });
        events.push({
            type: 'log',
            channel: 'user',
            message: `Очки действий восстановлены до ${context.initialActions}.`,
        });
        events.push({
            type: 'log',
            channel: 'system',
            message: `turn:end:actions_reset:${context.initialActions}`,
        });

        events.push({ type: 'turn:ended', actionsRemaining: context.initialActions, drawnEvents: drawn });

        return events;
    }
}

export class PostLogCommand implements GameCommand {
    constructor(private readonly channel: 'user' | 'system', private readonly message: string) {}

    public execute(): GameEvent[] {
        return [{ type: 'log', channel: this.channel, message: this.message }];
    }
}

export class EnterLocationCommand implements GameCommand {
    constructor(private readonly locationId: string) {}

    public execute(context: GameEngineContext): GameEvent[] {
        const territory = findTerritory(context.config.mapConfig, this.locationId);
        if (!territory) {
            return [
                {
                    type: 'log',
                    channel: 'system',
                    message: `enter_location: территория ${this.locationId} не найдена`,
                },
            ];
        }

        const events: GameEvent[] = [
            { type: 'location:reveal', locationId: this.locationId },
            { type: 'player:place', locationId: this.locationId },
            { type: 'location:set', locationId: this.locationId },
        ];

        const playerName = context.config.player.name;
        events.push({ type: 'log', channel: 'user', message: `${playerName} заходит на ${territory.front.title}` });
        events.push({ type: 'log', channel: 'system', message: `enter_location:${this.locationId}` });

        return events;
    }
}
