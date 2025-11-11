import { ExpeditionMap, type ExpeditionMapConfig } from "../expedition-map/expedition-map";

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
        }

        .game-engine-widget__column {
            display: flex;
            flex-direction: column;
            gap: 8px;
            min-width: 0;
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
};

export type GameEngineConfig = {
    player: GameEnginePlayerConfig;
    map: ExpeditionMap;
    mapConfig: ExpeditionMapConfig;
};

export type GameEngineState = {
    currentLocationId: string | null;
};

export interface GameEngineContext {
    readonly engine: GameEngine;
    readonly state: Readonly<GameEngineState>;
    readonly config: GameEngineConfig;
}

export interface GameCommand {
    execute(context: GameEngineContext): void;
}

export class GameEngine {
    private readonly root: HTMLElement;
    private readonly config: GameEngineConfig;

    private readonly userLogList: HTMLUListElement;
    private readonly systemLogList: HTMLUListElement;
    private readonly stateElement: HTMLDivElement;

    private state: GameEngineState = { currentLocationId: null };
    private readonly userHistory: string[] = [];
    private readonly systemHistory: string[] = [];
    private readonly executedCommands: GameCommand[] = [];
    private initialized = false;

    constructor(root: HTMLElement | null | undefined, config: GameEngineConfig) {
        this.root = root ?? document.createElement("div");
        this.config = config;

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

    public dispatch(command: GameCommand): void {
        this.executedCommands.push(command);
        command.execute({ engine: this, state: this.state, config: this.config });
        this.render();
    }

    public logUserMessage(message: string): void {
        this.userHistory.push(message);
    }

    public logSystemMessage(message: string): void {
        this.systemHistory.push(message);
    }

    public setCurrentLocation(locationId: string): void {
        this.state = { ...this.state, currentLocationId: locationId };
    }

    public revealLocation(locationId: string): void {
        this.config.map.revealTerritory(locationId);
    }

    public placePlayer(locationId: string): void {
        const { player } = this.config;
        this.config.map.placeCharacter(
            {
                id: player.id,
                name: player.name,
                label: player.label,
                color: player.color,
                textColor: player.textColor,
            },
            locationId
        );
    }

    private bootstrapInitialLocation(): void {
        const territory = this.config.mapConfig.territories[0];
        if (!territory) {
            this.logSystemMessage("bootstrap: нет доступных территорий для размещения персонажа");
            this.render();
            return;
        }

        this.dispatch(new EnterLocationCommand(territory.id));
    }

    private render(): void {
        const locationTitle = this.state.currentLocationId
            ? this.resolveLocationTitle(this.state.currentLocationId)
            : null;

        if (locationTitle) {
            this.stateElement.textContent = `Текущая локация: ${locationTitle}`;
        } else {
            this.stateElement.textContent = "Текущая локация: неизвестно";
        }

        this.renderLog(this.userLogList, this.userHistory, "Пока ничего не произошло.");
        this.renderLog(this.systemLogList, this.systemHistory, "Системных действий не зарегистрировано.", true);
    }

    private renderLog(list: HTMLUListElement, items: string[], emptyLabel: string, isSystem = false): void {
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
            li.className = "game-engine-widget__log-item" + (isSystem ? " game-engine-widget__log-item--system" : "");
            li.textContent = item;
            list.appendChild(li);
        }
    }

    private resolveLocationTitle(id: string): string | null {
        const territory = this.config.mapConfig.territories.find((entry) => entry.id === id);
        return territory ? territory.front.title : null;
    }
}

export class EnterLocationCommand implements GameCommand {
    constructor(private readonly locationId: string) {}

    public execute(context: GameEngineContext): void {
        const { engine, config } = context;
        const territory = config.mapConfig.territories.find((entry) => entry.id === this.locationId);
        if (!territory) {
            engine.logSystemMessage(`enter_location: территория ${this.locationId} не найдена`);
            return;
        }

        engine.revealLocation(this.locationId);
        engine.placePlayer(this.locationId);
        engine.setCurrentLocation(this.locationId);

        const playerName = config.player.name;
        engine.logUserMessage(`${playerName} заходит на ${territory.front.title}`);
        engine.logSystemMessage(`enter_location:${this.locationId}`);
    }
}
