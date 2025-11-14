import { createDebugButton } from "./widgets/debug/debug";
import { DebugPanel } from "./widgets/debug-panel/debug-panel";
import { DraggableContainer } from "./widgets/draggable-container/draggable-container";
import {
    GameEngineDebugFacade,
    GameEngineStore,
    UpdateDefeatProgressCommand,
    UpdateVictoryProgressCommand,
    type GameProgressSlice,
    type GameViewModel,
} from "./widgets/game-engine/game-engine-store";
import type { CardHand } from "./widgets/card-hand/card-hand";
import type { CardHandController } from "./widgets/card-hand/card-hand-controller";
import type { ExpeditionMapCharacterConfig, TerritoryConfig, TerritoryConnectionType } from "./widgets/expedition-map/expedition-map";

export type SetupDebugPanelOptions = {
    store: GameEngineStore;
    debugFacade: GameEngineDebugFacade;
    cardHand: CardHand;
    cardHandController: CardHandController;
    onViewModelChange: (listener: (viewModel: GameViewModel) => void) => () => void;
};

let debugCharacterCursor = 0;

export function setupDebugPanel({ store, debugFacade, cardHand, cardHandController, onViewModelChange }: SetupDebugPanelOptions): void {
    const debugPanel = new DebugPanel(null, { title: "Debug панель" });
    const debugPanelContainer = new DraggableContainer(debugPanel.element, {
        initialPosition: { bottom: 24, right: 24 },
    });

    const debugToggleButton = document.createElement("button");
    debugToggleButton.type = "button";
    debugToggleButton.className = "debug-panel-toggle";
    debugToggleButton.title = "Показать или спрятать debug панель";
    document.body.appendChild(debugToggleButton);

    let isDebugPanelVisible = false;
    const applyDebugPanelVisibility = () => {
        debugPanelContainer.element.style.display = isDebugPanelVisible ? "inline-block" : "none";
        debugToggleButton.textContent = isDebugPanelVisible ? "Спрятать debug панель" : "Показать debug панель";
        debugToggleButton.setAttribute("aria-pressed", isDebugPanelVisible ? "true" : "false");
    };

    debugToggleButton.addEventListener("click", () => {
        isDebugPanelVisible = !isDebugPanelVisible;
        applyDebugPanelVisibility();
    });

    applyDebugPanelVisibility();

    let latestViewModel: GameViewModel = store.getViewModel();

    const victoryGroup = debugPanel.addGroup("Параметры победы");
    const victoryCluesControl = debugPanel.addNumericControl(victoryGroup, "Собранные улики", {
        get: () => readProgressNumber(latestViewModel.victoryProgress, "collectedClues"),
        set: (value) => {
            store.dispatch(new UpdateVictoryProgressCommand({ collectedClues: value }));
            latestViewModel = store.getViewModel();
        },
        min: 0,
    });
    const victorySegmentsControl = debugPanel.addNumericControl(victoryGroup, "Сегменты ритуала", {
        get: () => readProgressNumber(latestViewModel.victoryProgress, "ritualSegments"),
        set: (value) => {
            store.dispatch(new UpdateVictoryProgressCommand({ ritualSegments: value }));
            latestViewModel = store.getViewModel();
        },
        min: 0,
    });
    const finalSealControl = debugPanel.addBooleanControl(victoryGroup, "Финальная печать", {
        get: () => readProgressFlag(latestViewModel.victoryProgress, "finalSeal"),
        set: (value) => {
            store.dispatch(new UpdateVictoryProgressCommand({ finalSeal: value }));
            latestViewModel = store.getViewModel();
        },
    });

    const defeatGroup = debugPanel.addGroup("Параметры поражения");
    const doomControl = debugPanel.addNumericControl(defeatGroup, "Очки гибели", {
        get: () => readProgressNumber(latestViewModel.defeatProgress, "doom"),
        set: (value) => {
            store.dispatch(new UpdateDefeatProgressCommand({ doom: value }));
            latestViewModel = store.getViewModel();
        },
        min: 0,
    });
    const cultActivityControl = debugPanel.addNumericControl(defeatGroup, "Активность культа", {
        get: () => readProgressNumber(latestViewModel.defeatProgress, "cultActivity"),
        set: (value) => {
            store.dispatch(new UpdateDefeatProgressCommand({ cultActivity: value }));
            latestViewModel = store.getViewModel();
        },
        min: 0,
    });
    const awakeningControl = debugPanel.addBooleanControl(defeatGroup, "Пробуждение Древнего", {
        get: () => readProgressFlag(latestViewModel.defeatProgress, "awakening"),
        set: (value) => {
            store.dispatch(new UpdateDefeatProgressCommand({ awakening: value }));
            latestViewModel = store.getViewModel();
        },
    });

    const victoryCluesValueEl = resolveValueElement(victoryCluesControl);
    const victorySegmentsValueEl = resolveValueElement(victorySegmentsControl);
    const finalSealValueEl = resolveValueElement(finalSealControl);
    const doomValueEl = resolveValueElement(doomControl);
    const cultActivityValueEl = resolveValueElement(cultActivityControl);
    const awakeningValueEl = resolveValueElement(awakeningControl);

    const updateProgressControls = () => {
        if (victoryCluesValueEl) {
            victoryCluesValueEl.textContent = String(
                readProgressNumber(latestViewModel.victoryProgress, "collectedClues"),
            );
        }

        if (victorySegmentsValueEl) {
            victorySegmentsValueEl.textContent = String(
                readProgressNumber(latestViewModel.victoryProgress, "ritualSegments"),
            );
        }

        if (finalSealValueEl) {
            finalSealValueEl.textContent = formatBoolean(
                readProgressFlag(latestViewModel.victoryProgress, "finalSeal"),
            );
        }

        if (doomValueEl) {
            doomValueEl.textContent = String(readProgressNumber(latestViewModel.defeatProgress, "doom"));
        }

        if (cultActivityValueEl) {
            cultActivityValueEl.textContent = String(
                readProgressNumber(latestViewModel.defeatProgress, "cultActivity"),
            );
        }

        if (awakeningValueEl) {
            awakeningValueEl.textContent = formatBoolean(
                readProgressFlag(latestViewModel.defeatProgress, "awakening"),
            );
        }
    };

    onViewModelChange((viewModel) => {
        latestViewModel = viewModel;
        updateProgressControls();
    });

    const cardsGroup = debugPanel.addGroup("Карты");
    const addCardButton = createDebugButton("Добавить карту", () => {
        cardHandController.addDebugCard();
    });
    cardsGroup.appendChild(addCardButton);

    const openCardHandButton = createDebugButton("Показать CardHand", () => {
        cardHand.focus();
    });
    cardsGroup.appendChild(openCardHandButton);

    const mapGroup = debugPanel.addGroup("Карта");
    const addTerritoryButton = createDebugButton("Добавить территорию", () => {
        const territory = createRandomTerritory(debugFacade.getTerritoryIds());
        debugFacade.addTerritory(territory);
    });
    mapGroup.appendChild(addTerritoryButton);

    const addCharacterButton = createDebugButton("Добавить персонажа", () => {
        const territoryIds = debugFacade.getTerritoryIds();
        if (territoryIds.length === 0) {
            console.warn("Нет доступных территорий для размещения персонажа.");
            return;
        }

        const territoryId = territoryIds[Math.floor(Math.random() * territoryIds.length)];
        const characterToken = createRandomMapCharacterToken();
        debugFacade.placeCharacter(territoryId, characterToken);
    });
    mapGroup.appendChild(addCharacterButton);

    const eventsGroup = debugPanel.addGroup("События");
    const triggerEventButton = createDebugButton("Вызвать событие", () => {
        debugFacade.triggerEventDeck();
    });
    const reshuffleEventsButton = createDebugButton("Перемешать сброс событий", () => {
        debugFacade.reshuffleEventDeck();
    });
    eventsGroup.append(triggerEventButton, reshuffleEventsButton);
}

function readProgressNumber(slice: GameProgressSlice, key: string): number {
    const value = slice[key];
    return typeof value === "number" ? value : 0;
}

function readProgressFlag(slice: GameProgressSlice, key: string): boolean {
    return slice[key] === true;
}

function formatBoolean(value: boolean): string {
    return value ? "Да" : "Нет";
}

function resolveValueElement(row: HTMLElement): HTMLSpanElement | null {
    const element = row.children[2];
    return element instanceof HTMLSpanElement ? element : null;
}

function createRandomTerritory(existingTerritoryIds: readonly string[]): TerritoryConfig {
    const seed = Math.floor(Math.random() * 1000);
    const id = `debug-territory-${Date.now()}-${seed}`;
    const palette = ["#0ea5e9", "#22d3ee", "#a855f7", "#f97316", "#f43f5e", "#22c55e"];
    const base = palette[seed % palette.length];
    const accent = palette[(seed + 3) % palette.length];
    const glow = palette[(seed + 1) % palette.length];
    const svg = `
        <svg xmlns='http://www.w3.org/2000/svg' width='320' height='320' viewBox='0 0 320 320'>
            <defs>
                <linearGradient id='bg' x1='0' y1='0' x2='1' y2='1'>
                    <stop offset='0%' stop-color='${base}' />
                    <stop offset='100%' stop-color='${accent}' />
                </linearGradient>
            </defs>
            <rect width='320' height='320' fill='url(#bg)' />
            <circle cx='160' cy='120' r='72' fill='${glow}' opacity='0.35' />
            <path d='M80 260 L160 140 L240 260 Z' fill='rgba(15,23,42,0.45)' />
        </svg>
    `;
    const image = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;

    const connections: { targetId: string; type: TerritoryConnectionType }[] = [];
    if (existingTerritoryIds.length > 0) {
        const targetId = existingTerritoryIds[Math.floor(Math.random() * existingTerritoryIds.length)];
        const type: TerritoryConnectionType = Math.random() > 0.5 ? "two-way" : "one-way";
        connections.push({ targetId, type });
    }

    return {
        id,
        back: {
            title: `Неизведанная область ${seed}`,
        },
        front: {
            title: `Исследованная область ${seed}`,
            description: "Временная территория для проверки интерфейса карты.",
            image,
        },
        connections,
    };
}

function createRandomMapCharacterToken(): ExpeditionMapCharacterConfig {
    const seed = debugCharacterCursor;
    debugCharacterCursor += 1;

    const id = `debug-character-${Date.now()}-${seed}`;
    const names = [
        "Скиталец",
        "Авантюрист",
        "Мистик",
        "Рассказчик",
        "Выживший",
        "Страж",
        "Искатель",
    ];
    const colors = ["#2563eb", "#dc2626", "#f97316", "#9333ea", "#0f766e", "#16a34a", "#c2410c"];

    const name = names[seed % names.length];
    const color = colors[seed % colors.length];
    const accent = colors[(seed + 3) % colors.length];

    const encodeColor = (value: string) => value.replace("#", "%23");
    const baseColor = encodeColor(color);
    const accentColor = encodeColor(accent);
    const image =
        "data:image/svg+xml;utf8," +
        `<svg xmlns='http://www.w3.org/2000/svg' width='128' height='128' viewBox='0 0 128 128'>` +
        `<defs><linearGradient id='grad' x1='0' y1='0' x2='1' y2='1'><stop offset='0%' stop-color='${baseColor}'/><stop offset='100%' stop-color='${accentColor}'/></linearGradient></defs>` +
        `<rect width='128' height='128' rx='28' fill='url(%23grad)'/>` +
        `<circle cx='36' cy='34' r='18' fill='${accentColor}' opacity='0.35'/>` +
        `<circle cx='100' cy='90' r='26' fill='${accentColor}' opacity='0.5'/>` +
        `</svg>`;

    return {
        id,
        name: `${name} ${seed + 1}`,
        color,
        textColor: "#f8fafc",
        image,
    };
}
