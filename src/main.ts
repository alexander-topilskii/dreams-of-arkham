import './style.css'
import { createDraggabilly } from "./widgets/draggeble-utils/draggeble-utils";
import { MovablePanels } from "./widgets/movable-panels/movable-panels";
import { CardHand, type CardEffect, type CardHandCard, type CardHandDropResult } from "./widgets/card-hand/card-hand";
import { GameLoopPanel, type GamePhase } from "./widgets/game-loop-panel/game-loop-panel";
import { createDebugButton } from "./widgets/debug/debug";
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
import { GameEngine, type MoveAttemptResult, type MoveCardDescriptor } from "./widgets/game-engine/game-engine";

type HandCardDefinition = {
    id: string;
    title: string;
    description: string;
    image?: string;
    cost: number;
    effect: CardEffect;
};

type HandCardContent = HandCardDefinition & {
    instanceId: string;
};

type CardsConfig = {
    initialHand: HandCardDefinition[];
};

function generateCardInstanceId(baseId: string): string {
    const normalized = baseId?.trim() ? baseId.trim() : "card";
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
        return `${normalized}-${crypto.randomUUID()}`;
    }
    const randomPart = Math.random().toString(36).slice(2, 10);
    return `${normalized}-${Date.now()}-${randomPart}`;
}

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

type NumericControlConfig = {
    get: () => number;
    set: (value: number) => void;
    min?: number;
    max?: number;
    step?: number;
    onChange: () => void;
};

type BooleanControlConfig = {
    get: () => boolean;
    set: (value: boolean) => void;
    onChange: () => void;
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
const handCards: HandCardContent[] = cardsConfig.initialHand.map((card) => ({
    ...card,
    instanceId: generateCardInstanceId(card.id),
}))

let cardHand: CardHand | null = null

let debugCharacterCursor = 0

const renderCardHand = () => {
    const cardSummaries: CardHandCard[] = handCards.map((card) => ({
        id: card.id,
        title: card.title,
        description: card.description,
        cost: card.cost,
        effect: card.effect,
        artUrl: card.image,
        instanceId: card.instanceId,
    }))

    if (!cardHand) {
        cardHand = new CardHand(handRoot, {
            cards: cardSummaries,
            onMoveCardDrop: handleMoveCardDrop,
            onMoveCardTargetMissing: handleMoveCardTargetMissing,
            onCardConsumed: handleCardConsumed,
            onMoveCardDropFailure: handleMoveCardDropFailure,
        })
        return
    }

    cardHand.setCards(cardSummaries)
}

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
    onActionsChange: (actions) => {
        characterCard.setState({ actionPoints: actions })
    },
});
gameEngine.initialize();

function handleCardConsumed(card: CardHandCard): void {
    if (!card.instanceId) {
        return;
    }
    const index = handCards.findIndex((entry) => entry.instanceId === card.instanceId);
    if (index !== -1) {
        handCards.splice(index, 1);
    }
}

function handleMoveCardDrop(card: CardHandCard, territoryId: string): CardHandDropResult {
    const descriptor: MoveCardDescriptor = {
        id: card.id,
        title: card.title,
        cost: card.cost,
    };
    const result: MoveAttemptResult = gameEngine.attemptMoveWithCard(descriptor, territoryId);
    if (result.success) {
        return { status: 'success' };
    }
    return { status: 'error', message: result.message };
}

function handleMoveCardDropFailure(_card: CardHandCard, _territoryId: string, _message?: string): void {
    // Game engine already logs and re-renders failure outcomes inside attemptMoveWithCard.
}

function handleMoveCardTargetMissing(card: CardHandCard): void {
    const prompt = `Выберите локацию для «${card.title}».`;
    gameEngine.logUserMessage(prompt);
    gameEngine.logSystemMessage(`move_hint:target_missing:${card.id}`);
    gameEngine.refresh();
}

renderCardHand();

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

let debugRoot: HTMLDivElement | null = null;
if (engineRoot instanceof HTMLElement) {
    debugRoot = document.createElement('div');
    debugRoot.style.marginTop = '16px';
    engineRoot.appendChild(debugRoot);
}

if (debugRoot) {
    const panel = createDebugPanel();
    debugRoot.appendChild(panel);

    const header = document.createElement('h2');
    header.textContent = 'Debug панель';
    header.style.margin = '0';
    header.style.fontSize = '14px';
    header.style.fontWeight = '600';
    panel.appendChild(header);

    const victoryGroup = createDebugGroup('Параметры победы');
    victoryGroup.appendChild(
        createNumericControl('Собранные улики', {
            get: () => victoryProgress.collectedClues,
            set: (value) => {
                victoryProgress.collectedClues = value;
            },
            min: 0,
            onChange: syncTimelines,
        })
    );
    victoryGroup.appendChild(
        createNumericControl('Сегменты ритуала', {
            get: () => victoryProgress.ritualSegments,
            set: (value) => {
                victoryProgress.ritualSegments = value;
            },
            min: 0,
            onChange: syncTimelines,
        })
    );
    victoryGroup.appendChild(
        createBooleanControl('Финальная печать', {
            get: () => victoryProgress.finalSeal,
            set: (value) => {
                victoryProgress.finalSeal = value;
            },
            onChange: syncTimelines,
        })
    );
    panel.appendChild(victoryGroup);

    const defeatGroup = createDebugGroup('Параметры поражения');
    defeatGroup.appendChild(
        createNumericControl('Очки гибели', {
            get: () => defeatProgress.doom,
            set: (value) => {
                defeatProgress.doom = value;
            },
            min: 0,
            onChange: syncTimelines,
        })
    );
    defeatGroup.appendChild(
        createNumericControl('Активность культа', {
            get: () => defeatProgress.cultActivity,
            set: (value) => {
                defeatProgress.cultActivity = value;
            },
            min: 0,
            onChange: syncTimelines,
        })
    );
    defeatGroup.appendChild(
        createBooleanControl('Пробуждение Древнего', {
            get: () => defeatProgress.awakening,
            set: (value) => {
                defeatProgress.awakening = value;
            },
            onChange: syncTimelines,
        })
    );
    panel.appendChild(defeatGroup);

    const cardsGroup = createDebugGroup('Карты');
    const addCardButton = createDebugButton('Добавить карту', () => {
        const card = createRandomCard()
        handCards.push(card)

        if (!cardHand) {
            renderCardHand()
            return
        }

        cardHand.addCard({
            id: card.id,
            title: card.title,
            description: card.description,
            cost: card.cost,
            effect: card.effect,
            artUrl: card.image,
            instanceId: card.instanceId,
        })
    })
    cardsGroup.appendChild(addCardButton);

    const openCardHandButton = createDebugButton('Показать CardHand', () => {
        cardHand?.focus()
    })

    cardsGroup.appendChild(openCardHandButton)
    panel.appendChild(cardsGroup);

    const mapGroup = createDebugGroup('Карта');
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
    panel.appendChild(mapGroup);

    const eventsGroup = createDebugGroup('События');
    const triggerEventButton = createDebugButton('Вызвать событие', () => {
        eventDeck.triggerEvent();
    });
    const reshuffleEventsButton = createDebugButton('Перемешать сброс событий', () => {
        eventDeck.reshuffleDiscard();
    });
    eventsGroup.append(triggerEventButton, reshuffleEventsButton);
    panel.appendChild(eventsGroup);
}

function createRandomCard(): HandCardContent {
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
        instanceId: generateCardInstanceId(id),
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

function createDebugPanel(): HTMLDivElement {
    const panel = document.createElement('div');
    panel.style.display = 'flex';
    panel.style.flexDirection = 'column';
    panel.style.gap = '12px';
    panel.style.padding = '16px';
    panel.style.background = 'rgba(15, 23, 42, 0.9)';
    panel.style.border = '1px solid rgba(148, 163, 184, 0.3)';
    panel.style.borderRadius = '12px';
    panel.style.color = '#e2e8f0';
    panel.style.fontFamily = 'system-ui, sans-serif';
    panel.style.fontSize = '13px';
    panel.style.maxWidth = '320px';
    panel.style.boxShadow = '0 8px 24px rgba(15, 23, 42, 0.35)';
    return panel;
}

function createDebugGroup(title: string): HTMLDivElement {
    const group = document.createElement('div');
    group.style.display = 'flex';
    group.style.flexDirection = 'column';
    group.style.gap = '8px';

    const heading = document.createElement('div');
    heading.textContent = title;
    heading.style.fontSize = '11px';
    heading.style.letterSpacing = '0.08em';
    heading.style.textTransform = 'uppercase';
    heading.style.opacity = '0.75';

    group.appendChild(heading);
    return group;
}

function createNumericControl(label: string, config: NumericControlConfig): HTMLDivElement {
    const row = document.createElement('div');
    row.style.display = 'grid';
    row.style.gridTemplateColumns = '1fr auto auto auto';
    row.style.alignItems = 'center';
    row.style.gap = '8px';

    const labelEl = document.createElement('span');
    labelEl.textContent = label;
    labelEl.style.whiteSpace = 'nowrap';
    labelEl.style.overflow = 'hidden';
    labelEl.style.textOverflow = 'ellipsis';

    const decreaseBtn = createDebugButton('−', () => {
        applyChange(-1);
    });
    const valueEl = document.createElement('span');
    valueEl.style.minWidth = '36px';
    valueEl.style.textAlign = 'center';
    valueEl.style.fontVariantNumeric = 'tabular-nums';

    const increaseBtn = createDebugButton('+', () => {
        applyChange(1);
    });

    const applyChange = (direction: number) => {
        const step = config.step ?? 1;
        const current = config.get();
        const next = current + direction * step;
        const min = config.min ?? Number.NEGATIVE_INFINITY;
        const max = config.max ?? Number.POSITIVE_INFINITY;
        const clamped = Math.min(max, Math.max(min, next));
        config.set(clamped);
        updateValue();
        config.onChange();
    };

    const updateValue = () => {
        valueEl.textContent = String(config.get());
    };

    updateValue();

    row.append(labelEl, decreaseBtn, valueEl, increaseBtn);
    return row;
}

function createBooleanControl(label: string, config: BooleanControlConfig): HTMLDivElement {
    const row = document.createElement('div');
    row.style.display = 'grid';
    row.style.gridTemplateColumns = '1fr auto auto auto';
    row.style.alignItems = 'center';
    row.style.gap = '8px';

    const labelEl = document.createElement('span');
    labelEl.textContent = label;
    labelEl.style.whiteSpace = 'nowrap';
    labelEl.style.overflow = 'hidden';
    labelEl.style.textOverflow = 'ellipsis';

    const disableBtn = createDebugButton('−', () => {
        config.set(false);
        updateValue();
        config.onChange();
    });

    const valueEl = document.createElement('span');
    valueEl.style.minWidth = '36px';
    valueEl.style.textAlign = 'center';

    const enableBtn = createDebugButton('+', () => {
        config.set(true);
        updateValue();
        config.onChange();
    });

    const updateValue = () => {
        valueEl.textContent = config.get() ? 'Да' : 'Нет';
    };

    updateValue();

    row.append(labelEl, disableBtn, valueEl, enableBtn);
    return row;
}
