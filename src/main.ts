import './style.css'
import { createDraggabilly } from "./widgets/draggeble-utils/draggeble-utils";
import { MovablePanels } from "./widgets/movable-panels/movable-panels";
import { CardHand, type CardEffect } from "./widgets/card-hand/card-hand";
import { CardHandController } from "./widgets/card-hand/card-hand-controller";
import { GameLoopPanel, type GamePhase } from "./widgets/game-loop-panel/game-loop-panel";
import { createDebugButton } from "./widgets/debug/debug";
import { DebugPanel } from "./widgets/debug-panel/debug-panel";
import { DraggableContainer } from "./widgets/draggable-container/draggable-container";
import cardsSource from "./data/cards.json";
import rulesSource from "./data/rules.json";
import mapSource from "./data/map.json";
import eventDeckSource from "./data/event-deck.json";
import characterSource from "./data/character.json";
import { EventDeck, type EventDeckConfig } from "./widgets/event-deck/event-deck";
import { CharacterCard, type CharacterCardState, type CharacterEffect } from "./widgets/character-card/character-card";
import {
    ExpeditionMap,
    type ExpeditionMapCharacterConfig,
    type ExpeditionMapConfig,
    type TerritoryConfig,
    type TerritoryConnectionType,
} from "./widgets/expedition-map/expedition-map";
import { GameEngineWidget } from "./widgets/game-engine/game-engine";
import {
    GameEngineStore,
    GameEngineDebugFacade,
    UpdateDefeatProgressCommand,
    UpdateVictoryProgressCommand,
    TriggerEventDeckCommand,
    RevealEventsCommand,
    DiscardRevealedEventCommand,
    type GameProgressSlice,
    type GameViewModel,
    createInitialDeckStateFromConfig,
} from "./widgets/game-engine/game-engine-store";
import type { HandCardDefinition } from "./widgets/game-engine/game-engine-cards";
import { GameEngineMapAdapter } from "./widgets/game-engine/game-engine-map-adapter";
import { GameEngineEventDeckAdapter } from "./widgets/game-engine/game-engine-event-deck-adapter";

type CardsConfig = {
    initialDeck: HandCardDefinition[];
};

type VictoryProgress = {
    collectedClues: number;
    ritualSegments: number;
    finalSeal: boolean;
};

type DefeatProgress = {
    doom: number;
    cultActivity: number;
    awakening: boolean;
};

type CounterRequirement<Key extends string> = {
    label: string;
    type: "counter";
    progressKey: Key;
    target: number;
};

type FlagRequirement<Key extends string> = {
    label: string;
    type: "flag";
    progressKey: Key;
    target: boolean;
};

type Requirement<Key extends string> = CounterRequirement<Key> | FlagRequirement<Key>;

type ChapterConfig<Key extends string> = {
    title: string;
    description: string;
    image?: string;
    requirement: Requirement<Key>;
};

type RulesConfig = {
    victory: ChapterConfig<keyof VictoryProgress>[];
    defeat: ChapterConfig<keyof DefeatProgress>[];
};

type CharacterData = Omit<CharacterCardState, "portraitUrl"> & {
    id: string;
    portrait?: string;
};

const cardsConfig = cardsSource as CardsConfig;
const rulesConfig = rulesSource as RulesConfig;
const expeditionMapConfig = mapSource as ExpeditionMapConfig;
const eventDeckConfig = eventDeckSource as EventDeckConfig;
const characterConfig = characterSource as CharacterData;

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <div id="main-split">
    <div id="left">
        <div id="left-split">
            <div id="left-top">
                <div id="hand-panel"></div>
            </div>
            <div id="left-bottom"></div>
        </div>
    </div>
    <div id="middle">
        <div id="middle-split">
            <div id="middle-top">
                <div id="map-panel"></div>
            </div>
            <div id="middle-bottom">
                <div id="character-panel"></div>
            </div>
        </div>
    </div>
    <div id="right">
        <div id="right-split">
            <div id="right-top"></div>
            <div id="right-bottom"></div>
        </div>
    </div>
  </div>
`

// -- ui components
const movablePanels = new MovablePanels()

const characterRoot = document.getElementById('character-panel')
const { portrait, id: characterId, ...characterStateWithoutPortrait } = characterConfig
const initialCharacterState: CharacterCardState = {
    ...characterStateWithoutPortrait,
    portraitUrl: portrait,
}

const baseCharacterEffects: CharacterEffect[] = (initialCharacterState.effects ?? []).map((effect) => ({ ...effect }))

function buildCharacterEffects(viewModel: GameViewModel): CharacterEffect[] {
    const effects = baseCharacterEffects.map((effect) => ({ ...effect }))
    const engaged = viewModel.engagedEnemies

    if (engaged.length > 0) {
        const names = engaged.map((enemy) => enemy.name).join(', ')
        effects.push({
            id: 'engaged-enemies',
            name: `Сражается с ${engaged.length} врагами`,
            description: names ? `Противники: ${names}.` : undefined,
        })
    }

    return effects
}

if (characterRoot) {
    characterRoot.dataset.characterId = characterId
}

const characterCard = new CharacterCard(characterRoot, initialCharacterState)

const handRoot = document.getElementById('hand-panel')
let debugCharacterCursor = 0

let cardHandController: CardHandController

const cardHand = new CardHand(handRoot, {
    onMoveCardDrop: (card, territoryId) => cardHandController.onDrop(card, territoryId),
    onMoveCardTargetMissing: (card) => cardHandController.onDropTargetMissing(card),
    onCardConsumed: (card) => cardHandController.handleCardConsumed(card),
    onMoveCardDropFailure: (card, territoryId, message) =>
        cardHandController.onDropFailure(card, territoryId, message),
    onEndTurn: () => cardHandController?.handleEndTurn(),
})

const mapContainer = document.getElementById('map-panel');
const expeditionMap = new ExpeditionMap(mapContainer, expeditionMapConfig);

const eventDeckRoot = document.getElementById('right-top');
const eventDeck = new EventDeck(eventDeckRoot, eventDeckConfig);
const initialDeckState = createInitialDeckStateFromConfig(eventDeckConfig);

const engineRoot = document.getElementById('right-bottom');
const gameEngineStore = new GameEngineStore(
    {
        player: {
            id: characterId,
            name: initialCharacterState.name,
            image: portrait,
        },
        mapConfig: expeditionMapConfig,
        initialActions: initialCharacterState.actionPoints,
        playerCount: 1,
        initialDeckState,
        playerHealth: initialCharacterState.health,
    },
    {
        initialDeck: cardsConfig.initialDeck,
        createDebugCard: () => createRandomCard(),
    },
);

eventDeck.setIntentHandlers({
    onTrigger: () => {
        gameEngineStore.dispatch(new TriggerEventDeckCommand());
    },
    onReveal: (count) => {
        gameEngineStore.dispatch(new RevealEventsCommand(count));
    },
    onDiscard: (cardInstanceId) => {
        gameEngineStore.dispatch(new DiscardRevealedEventCommand(cardInstanceId));
    },
});

const mapAdapter = new GameEngineMapAdapter(gameEngineStore, expeditionMap);
const eventDeckAdapter = new GameEngineEventDeckAdapter(gameEngineStore, eventDeck);

let latestViewModel: GameViewModel = gameEngineStore.getViewModel();

gameEngineStore.subscribe((_event, viewModel) => {
    latestViewModel = viewModel;
    characterCard.setState({
        actionPoints: viewModel.actionsRemaining,
        health: viewModel.playerHealth,
        effects: buildCharacterEffects(viewModel),
    });
});

const gameEngineDebug = new GameEngineDebugFacade(gameEngineStore);

const gameEngineWidget = new GameEngineWidget(engineRoot, gameEngineStore);

gameEngineStore.initialize();

cardHandController = new CardHandController({ cardHand, store: gameEngineStore })
cardHandController.initialize()

// -- game loop timelines
const victoryPhases: GamePhase[] = rulesConfig.victory.map((chapter) => createPhase(chapter));
const defeatPhases: GamePhase[] = rulesConfig.defeat.map((chapter) => createPhase(chapter));

const gameLoopRoot = document.getElementById('left-bottom');

const gameLoopPanel = new GameLoopPanel(gameLoopRoot, {
    victoryPhases,
    defeatPhases,
});

const debugPanel = new DebugPanel(null, { title: 'Debug панель' });
const debugPanelContainer = new DraggableContainer(debugPanel.element, {
    initialPosition: { bottom: 24, right: 24 },
});

const debugToggleButton = document.createElement('button');
debugToggleButton.type = 'button';
debugToggleButton.className = 'debug-panel-toggle';
debugToggleButton.title = 'Показать или спрятать debug панель';
document.body.appendChild(debugToggleButton);

let isDebugPanelVisible = false;
const applyDebugPanelVisibility = () => {
    debugPanelContainer.element.style.display = isDebugPanelVisible ? 'inline-block' : 'none';
    debugToggleButton.textContent = isDebugPanelVisible ? 'Спрятать debug панель' : 'Показать debug панель';
    debugToggleButton.setAttribute('aria-pressed', isDebugPanelVisible ? 'true' : 'false');
};

debugToggleButton.addEventListener('click', () => {
    isDebugPanelVisible = !isDebugPanelVisible;
    applyDebugPanelVisibility();
});

applyDebugPanelVisibility();

const victoryGroup = debugPanel.addGroup('Параметры победы');
const victoryCluesControl = debugPanel.addNumericControl(victoryGroup, 'Собранные улики', {
    get: () => readProgressNumber(latestViewModel.victoryProgress, 'collectedClues'),
    set: (value) => {
        gameEngineStore.dispatch(new UpdateVictoryProgressCommand({ collectedClues: value }));
        latestViewModel = gameEngineStore.getViewModel();
    },
    min: 0,
});
const victorySegmentsControl = debugPanel.addNumericControl(victoryGroup, 'Сегменты ритуала', {
    get: () => readProgressNumber(latestViewModel.victoryProgress, 'ritualSegments'),
    set: (value) => {
        gameEngineStore.dispatch(new UpdateVictoryProgressCommand({ ritualSegments: value }));
        latestViewModel = gameEngineStore.getViewModel();
    },
    min: 0,
});
const finalSealControl = debugPanel.addBooleanControl(victoryGroup, 'Финальная печать', {
    get: () => readProgressFlag(latestViewModel.victoryProgress, 'finalSeal'),
    set: (value) => {
        gameEngineStore.dispatch(new UpdateVictoryProgressCommand({ finalSeal: value }));
        latestViewModel = gameEngineStore.getViewModel();
    },
});

const defeatGroup = debugPanel.addGroup('Параметры поражения');
const doomControl = debugPanel.addNumericControl(defeatGroup, 'Очки гибели', {
    get: () => readProgressNumber(latestViewModel.defeatProgress, 'doom'),
    set: (value) => {
        gameEngineStore.dispatch(new UpdateDefeatProgressCommand({ doom: value }));
        latestViewModel = gameEngineStore.getViewModel();
    },
    min: 0,
});
const cultActivityControl = debugPanel.addNumericControl(defeatGroup, 'Активность культа', {
    get: () => readProgressNumber(latestViewModel.defeatProgress, 'cultActivity'),
    set: (value) => {
        gameEngineStore.dispatch(new UpdateDefeatProgressCommand({ cultActivity: value }));
        latestViewModel = gameEngineStore.getViewModel();
    },
    min: 0,
});
const awakeningControl = debugPanel.addBooleanControl(defeatGroup, 'Пробуждение Древнего', {
    get: () => readProgressFlag(latestViewModel.defeatProgress, 'awakening'),
    set: (value) => {
        gameEngineStore.dispatch(new UpdateDefeatProgressCommand({ awakening: value }));
        latestViewModel = gameEngineStore.getViewModel();
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
            readProgressNumber(latestViewModel.victoryProgress, 'collectedClues'),
        );
    }

    if (victorySegmentsValueEl) {
        victorySegmentsValueEl.textContent = String(
            readProgressNumber(latestViewModel.victoryProgress, 'ritualSegments'),
        );
    }

    if (finalSealValueEl) {
        finalSealValueEl.textContent = formatBoolean(
            readProgressFlag(latestViewModel.victoryProgress, 'finalSeal'),
        );
    }

    if (doomValueEl) {
        doomValueEl.textContent = String(readProgressNumber(latestViewModel.defeatProgress, 'doom'));
    }

    if (cultActivityValueEl) {
        cultActivityValueEl.textContent = String(
            readProgressNumber(latestViewModel.defeatProgress, 'cultActivity'),
        );
    }

    if (awakeningValueEl) {
        awakeningValueEl.textContent = formatBoolean(
            readProgressFlag(latestViewModel.defeatProgress, 'awakening'),
        );
    }
};

const synchronizeViewModel = (viewModel: GameViewModel) => {
    latestViewModel = viewModel;
    gameLoopPanel.updateProgress(viewModel.victoryProgress, viewModel.defeatProgress);
    updateProgressControls();
};

synchronizeViewModel(latestViewModel);

gameEngineStore.subscribe((_event, viewModel) => {
    synchronizeViewModel(viewModel);
});

const cardsGroup = debugPanel.addGroup('Карты');
const addCardButton = createDebugButton('Добавить карту', () => {
    cardHandController.addDebugCard()
})
cardsGroup.appendChild(addCardButton);

const openCardHandButton = createDebugButton('Показать CardHand', () => {
    cardHand.focus()
})

cardsGroup.appendChild(openCardHandButton)

const mapGroup = debugPanel.addGroup('Карта');
const addTerritoryButton = createDebugButton('Добавить территорию', () => {
    const territory = createRandomTerritory(gameEngineDebug.getTerritoryIds());
    gameEngineDebug.addTerritory(territory);
});
mapGroup.appendChild(addTerritoryButton);

const addCharacterButton = createDebugButton('Добавить персонажа', () => {
    const territoryIds = gameEngineDebug.getTerritoryIds();
    if (territoryIds.length === 0) {
        console.warn('Нет доступных территорий для размещения персонажа.');
        return;
    }

    const territoryId = territoryIds[Math.floor(Math.random() * territoryIds.length)];
    const characterToken = createRandomMapCharacterToken();
    gameEngineDebug.placeCharacter(territoryId, characterToken);
});
mapGroup.appendChild(addCharacterButton);

const eventsGroup = debugPanel.addGroup('События');
const triggerEventButton = createDebugButton('Вызвать событие', () => {
    gameEngineDebug.triggerEventDeck();
});
const reshuffleEventsButton = createDebugButton('Перемешать сброс событий', () => {
    gameEngineDebug.reshuffleEventDeck();
});
eventsGroup.append(triggerEventButton, reshuffleEventsButton);

function createRandomCard(): HandCardDefinition {
    const seed = Math.floor(Math.random() * 1000)
    const id = `debug-${Date.now()}-${seed}`
    const palette = ['#1d4ed8', '#0ea5e9', '#22c55e', '#6366f1', '#f97316', '#ec4899']
    const base = palette[seed % palette.length]
    const accent = palette[(seed + 3) % palette.length]
    const textColor = '#f8fafc'
    const svg = `
        <svg xmlns='http://www.w3.org/2000/svg' width='320' height='200' viewBox='0 0 320 200'>
            <defs>
                <linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>
                    <stop offset='0%' stop-color='${base}' />
                    <stop offset='100%' stop-color='${accent}' />
                </linearGradient>
            </defs>
            <rect width='320' height='200' rx='24' fill='url(#g)' />
            <text x='50%' y='50%' fill='${textColor}' font-family='system-ui, sans-serif' font-size='28' text-anchor='middle' dominant-baseline='middle'>${seed}</text>
        </svg>
    `
    const image = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
    const effects: CardEffect[] = ['move', 'attack', 'hide', 'search']
    return {
        id,
        title: `Случайная карта ${seed}`,
        description: 'Экспериментальная карта для отладки интерфейса.',
        image,
        cost: 1 + (seed % 4),
        effect: effects[seed % effects.length],
    }
}

function createRandomTerritory(existingTerritoryIds: readonly string[]): TerritoryConfig {
    const seed = Math.floor(Math.random() * 1000)
    const id = `debug-territory-${Date.now()}-${seed}`
    const palette = ['#0ea5e9', '#22d3ee', '#a855f7', '#f97316', '#f43f5e', '#22c55e']
    const base = palette[seed % palette.length]
    const accent = palette[(seed + 3) % palette.length]
    const glow = palette[(seed + 1) % palette.length]
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
    `
    const image = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`

    const connections: { targetId: string; type: TerritoryConnectionType }[] = []
    if (existingTerritoryIds.length > 0) {
        const targetId = existingTerritoryIds[Math.floor(Math.random() * existingTerritoryIds.length)]
        const type: TerritoryConnectionType = Math.random() > 0.5 ? 'two-way' : 'one-way'
        connections.push({ targetId, type })
    }

    return {
        id,
        back: {
            title: `Неизведанная область ${seed}`,
        },
        front: {
            title: `Исследованная область ${seed}`,
            description: 'Временная территория для проверки интерфейса карты.',
            image,
        },
        connections,
    }
}

function createRandomMapCharacterToken(): ExpeditionMapCharacterConfig {
    const seed = debugCharacterCursor
    debugCharacterCursor += 1

    const id = `debug-character-${Date.now()}-${seed}`
    const names = [
        'Скиталец',
        'Авантюрист',
        'Мистик',
        'Рассказчик',
        'Выживший',
        'Страж',
        'Искатель',
    ]
    const colors = ['#2563eb', '#dc2626', '#f97316', '#9333ea', '#0f766e', '#16a34a', '#c2410c']

    const name = names[seed % names.length]
    const color = colors[seed % colors.length]
    const accent = colors[(seed + 3) % colors.length]

    const encodeColor = (value: string) => value.replace('#', '%23')
    const baseColor = encodeColor(color)
    const accentColor = encodeColor(accent)
    const image =
        "data:image/svg+xml;utf8," +
        `<svg xmlns='http://www.w3.org/2000/svg' width='128' height='128' viewBox='0 0 128 128'>` +
        `<defs><linearGradient id='grad' x1='0' y1='0' x2='1' y2='1'><stop offset='0%' stop-color='${baseColor}'/><stop offset='100%' stop-color='${accentColor}'/></linearGradient></defs>` +
        `<rect width='128' height='128' rx='28' fill='url(%23grad)'/>` +
        `<circle cx='36' cy='34' r='18' fill='${accentColor}' opacity='0.35'/>` +
        `<circle cx='100' cy='90' r='26' fill='${accentColor}' opacity='0.5'/>` +
        `</svg>`

    return {
        id,
        name: `${name} ${seed + 1}`,
        color,
        textColor: '#f8fafc',
        image,
    }
}

function readProgressNumber(slice: GameProgressSlice, key: string): number {
    const value = slice[key];
    return typeof value === 'number' ? value : 0;
}

function readProgressFlag(slice: GameProgressSlice, key: string): boolean {
    return slice[key] === true;
}

function formatBoolean(value: boolean): string {
    return value ? 'Да' : 'Нет';
}

function resolveValueElement(row: HTMLElement): HTMLSpanElement | null {
    const element = row.children[2];
    return element instanceof HTMLSpanElement ? element : null;
}

function createPhase<ProgressKey extends string>(chapter: ChapterConfig<ProgressKey>): GamePhase {
    const {title, description, image, requirement} = chapter;

    if (requirement.type === 'counter') {
        const key = requirement.progressKey;
        return {
            title,
            description,
            image,
            statusLabel: requirement.label,
            statusValue: (progress) => {
                const value = progress[key];
                const numeric = typeof value === 'number' ? value : 0;
                return `${numeric} / ${requirement.target}`;
            },
            condition: (progress) => {
                const value = progress[key];
                const numeric = typeof value === 'number' ? value : 0;
                return numeric >= requirement.target;
            },
        };
    }

    const key = requirement.progressKey;
    return {
        title,
        description,
        image,
        statusLabel: requirement.label,
        statusValue: (progress) => formatBoolean(progress[key] === true),
        condition: (progress) => Boolean(progress[key]) === requirement.target,
    };
}

