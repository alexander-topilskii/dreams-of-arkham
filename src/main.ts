import './style.css'
import { createDraggabilly } from "./widgets/draggeble-utils/draggeble-utils";
import { MovablePanels } from "./widgets/movable-panels/movable-panels";
import { CardHand, type CardEffect } from "./widgets/card-hand/card-hand";
import {
    CardHandController,
    generateCardInstanceId,
    type HandCardContent,
    type HandCardDefinition,
} from "./widgets/card-hand/card-hand-controller";
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
import { CharacterCard, type CharacterCardState } from "./widgets/character-card/character-card";
import {
    ExpeditionMap,
    type ExpeditionMapCharacterConfig,
    type ExpeditionMapConfig,
    type TerritoryConfig,
    type TerritoryConnectionType,
} from "./widgets/expedition-map/expedition-map";
import { GameEngine } from "./widgets/game-engine/game-engine";

type CardsConfig = {
    initialHand: HandCardDefinition[];
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

type CharacterData = Omit<CharacterCardState, 'portraitUrl'> & {
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
            <div id="left-top"></div>
            <div id="left-bottom"></div>
        </div>
    </div>
    <div id="middle">
        <div id="middle-split">
            <div id="middle-top">
                <div id="map-panel"></div>
            </div>
            <div id="middle-bottom">
                <div id="sample-hand"></div>
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

const characterRoot = document.getElementById('left-top')
const { portrait, id: characterId, ...characterStateWithoutPortrait } = characterConfig
const initialCharacterState: CharacterCardState = {
    ...characterStateWithoutPortrait,
    portraitUrl: portrait,
}

if (characterRoot) {
    characterRoot.dataset.characterId = characterId
}

const characterCard = new CharacterCard(characterRoot, initialCharacterState)

const handRoot = document.getElementById('sample-hand')
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

const engineRoot = document.getElementById('right-bottom');
const gameEngine = new GameEngine(engineRoot, {
    player: {
        id: characterId,
        name: initialCharacterState.name,
        image: portrait,
    },
    map: expeditionMap,
    mapConfig: expeditionMapConfig,
    initialActions: initialCharacterState.actionPoints,
    playerCount: 1,
    eventDeck,
    onActionsChange: (actions) => {
        characterCard.setState({ actionPoints: actions })
    },
});
gameEngine.initialize();

cardHandController = new CardHandController(
    { cardHand, gameEngine },
    {
        initialCards: cardsConfig.initialHand,
        createDebugCard: () => createRandomCard(generateCardInstanceId),
    },
)
cardHandController.initialize()

// -- game loop timelines
const victoryProgress: VictoryProgress = {
    collectedClues: 0,
    ritualSegments: 0,
    finalSeal: false,
}

const defeatProgress: DefeatProgress = {
    doom: 0,
    cultActivity: 0,
    awakening: false,
}

const victoryPhases: GamePhase[] = rulesConfig.victory.map((chapter) =>
    createPhase(chapter, victoryProgress)
)

const defeatPhases: GamePhase[] = rulesConfig.defeat.map((chapter) =>
    createPhase(chapter, defeatProgress)
)

const gameLoopRoot = document.getElementById('left-bottom');

const gameLoopPanel = new GameLoopPanel(gameLoopRoot, {
    victoryPhases,
    defeatPhases,
});

gameLoopPanel.evaluate();

const syncTimelines = () => {
    gameLoopPanel.evaluate();
};

const debugPanel = new DebugPanel(null, { title: 'Debug панель' });
new DraggableContainer(debugPanel.element, {
    initialPosition: { bottom: 24, right: 24 },
});

const victoryGroup = debugPanel.addGroup('Параметры победы');
debugPanel.addNumericControl(victoryGroup, 'Собранные улики', {
    get: () => victoryProgress.collectedClues,
    set: (value) => {
        victoryProgress.collectedClues = value;
    },
    min: 0,
    onChange: syncTimelines,
});
debugPanel.addNumericControl(victoryGroup, 'Сегменты ритуала', {
    get: () => victoryProgress.ritualSegments,
    set: (value) => {
        victoryProgress.ritualSegments = value;
    },
    min: 0,
    onChange: syncTimelines,
});
debugPanel.addBooleanControl(victoryGroup, 'Финальная печать', {
    get: () => victoryProgress.finalSeal,
    set: (value) => {
        victoryProgress.finalSeal = value;
    },
    onChange: syncTimelines,
});

const defeatGroup = debugPanel.addGroup('Параметры поражения');
debugPanel.addNumericControl(defeatGroup, 'Очки гибели', {
    get: () => defeatProgress.doom,
    set: (value) => {
        defeatProgress.doom = value;
    },
    min: 0,
    onChange: syncTimelines,
});
debugPanel.addNumericControl(defeatGroup, 'Активность культа', {
    get: () => defeatProgress.cultActivity,
    set: (value) => {
        defeatProgress.cultActivity = value;
    },
    min: 0,
    onChange: syncTimelines,
});
debugPanel.addBooleanControl(defeatGroup, 'Пробуждение Древнего', {
    get: () => defeatProgress.awakening,
    set: (value) => {
        defeatProgress.awakening = value;
    },
    onChange: syncTimelines,
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
    expeditionMap.addTerritory(createRandomTerritory(expeditionMap));
});
mapGroup.appendChild(addTerritoryButton);

const addCharacterButton = createDebugButton('Добавить персонажа', () => {
    const territoryIds = expeditionMap.getTerritoryIds();
    if (territoryIds.length === 0) {
        console.warn('Нет доступных территорий для размещения персонажа.');
        return;
    }

    const territoryId = territoryIds[Math.floor(Math.random() * territoryIds.length)];
    const characterToken = createRandomMapCharacterToken();
    expeditionMap.placeCharacter(characterToken, territoryId);
});
mapGroup.appendChild(addCharacterButton);

const eventsGroup = debugPanel.addGroup('События');
const triggerEventButton = createDebugButton('Вызвать событие', () => {
    eventDeck.triggerEvent();
});
const reshuffleEventsButton = createDebugButton('Перемешать сброс событий', () => {
    eventDeck.reshuffleDiscard();
});
eventsGroup.append(triggerEventButton, reshuffleEventsButton);

function createRandomCard(
    generateInstanceId: (baseId: string) => string = generateCardInstanceId,
): HandCardContent {
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
        instanceId: generateInstanceId(id),
    }
}

function createRandomTerritory(map: ExpeditionMap): TerritoryConfig {
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

    const existing = map.getTerritoryIds()
    const connections: { targetId: string; type: TerritoryConnectionType }[] = []
    if (existing.length > 0) {
        const targetId = existing[Math.floor(Math.random() * existing.length)]
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

function createPhase<Progress extends Record<string, number | boolean>>(
    chapter: ChapterConfig<Extract<keyof Progress, string>>,
    progress: Progress,
): GamePhase {
    const {title, description, image, requirement} = chapter;

    if (requirement.type === 'counter') {
        const key = requirement.progressKey as keyof Progress;
        return {
            title,
            description,
            image,
            statusLabel: requirement.label,
            statusValue: () => `${Number(progress[key])} / ${requirement.target}`,
            condition: () => Number(progress[key]) >= requirement.target,
        };
    }

    const key = requirement.progressKey as keyof Progress;
    return {
        title,
        description,
        image,
        statusLabel: requirement.label,
        statusValue: () => (Boolean(progress[key]) ? 'Да' : 'Нет'),
        condition: () => Boolean(progress[key]) === requirement.target,
    };
}

