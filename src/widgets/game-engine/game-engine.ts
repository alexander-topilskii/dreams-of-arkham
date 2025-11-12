import { GameEngineStore, type GameEvent, type GameViewModel } from "./game-engine-store";

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

export class GameEngineWidget {
    public readonly element: HTMLElement;

    private readonly store: GameEngineStore;
    private readonly stateElement: HTMLDivElement;
    private readonly userLogList: HTMLUListElement;
    private readonly systemLogList: HTMLUListElement;
    private unsubscribe?: () => void;

    constructor(root: HTMLElement | null | undefined, store: GameEngineStore) {
        this.element = root ?? document.createElement("div");
        this.store = store;

        ensureStylesMounted();

        this.element.classList.add("game-engine-widget");
        this.element.innerHTML = "";

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

        this.element.append(header, body);

        this.unsubscribe = this.store.subscribe(this.handleStoreEvent);
    }

    public destroy(): void {
        this.unsubscribe?.();
        this.unsubscribe = undefined;
    }

    private readonly handleStoreEvent = (_event: GameEvent, viewModel: GameViewModel): void => {
        this.render(viewModel);
    };

    private render(viewModel: GameViewModel): void {
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
            true,
        );
    }

    private renderLog(
        list: HTMLUListElement,
        items: readonly string[],
        emptyLabel: string,
        isSystem = false,
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
}

export { ensureStylesMounted };
