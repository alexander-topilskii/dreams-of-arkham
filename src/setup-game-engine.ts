import { CardHand, type CardEffect } from "./widgets/card-hand/card-hand";
import { CardHandController } from "./widgets/card-hand/card-hand-controller";
import { CharacterCard, type CharacterCardState, type CharacterEffect } from "./widgets/character-card/character-card";
import { EventDeck, type EventDeckConfig } from "./widgets/event-deck/event-deck";
import { ExpeditionMap, type ExpeditionMapConfig } from "./widgets/expedition-map/expedition-map";
import { GameLoopPanel, type GamePhase } from "./widgets/game-loop-panel/game-loop-panel";
import { GameEngineWidget } from "./widgets/game-engine/game-engine";
import {
    DiscardRevealedEventCommand,
    GameEngineDebugFacade,
    GameEngineStore,
    RevealEventsCommand,
    TriggerEventDeckCommand,
    createInitialDeckStateFromConfig,
    type GameViewModel,
} from "./widgets/game-engine/game-engine-store";
import type { HandCardDefinition } from "./widgets/game-engine/game-engine-cards";
import { GameEngineEventDeckAdapter } from "./widgets/game-engine/game-engine-event-deck-adapter";
import { GameEngineMapAdapter } from "./widgets/game-engine/game-engine-map-adapter";

export type CardsConfig = {
    initialDeck: HandCardDefinition[];
};

export type VictoryProgress = {
    collectedClues: number;
    ritualSegments: number;
    finalSeal: boolean;
};

export type DefeatProgress = {
    doom: number;
    cultActivity: number;
    awakening: boolean;
};

type Requirement<Key extends string> = CounterRequirement<Key> | FlagRequirement<Key>;

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

export type ChapterConfig<Key extends string> = {
    title: string;
    description: string;
    image?: string;
    requirement: Requirement<Key>;
};

export type RulesConfig = {
    victory: ChapterConfig<keyof VictoryProgress>[];
    defeat: ChapterConfig<keyof DefeatProgress>[];
};

export type CharacterData = Omit<CharacterCardState, "portraitUrl"> & {
    id: string;
    portrait?: string;
};

export type SetupGameEngineOptions = {
    containers: {
        hand: HTMLElement | null;
        map: HTMLElement | null;
        eventDeck: HTMLElement | null;
        engine: HTMLElement | null;
        character: HTMLElement | null;
        gameLoop: HTMLElement | null;
    };
    configs: {
        cards: CardsConfig;
        rules: RulesConfig;
        expeditionMap: ExpeditionMapConfig;
        eventDeck: EventDeckConfig;
        character: CharacterData;
    };
};

export type SetupGameEngineResult = {
    store: GameEngineStore;
    debugFacade: GameEngineDebugFacade;
    cardHand: CardHand;
    cardHandController: CardHandController;
    gameLoopPanel: GameLoopPanel;
    getLatestViewModel: () => GameViewModel;
    onViewModelChange: (listener: (viewModel: GameViewModel) => void) => () => void;
};

export function setupGameEngine({ containers, configs }: SetupGameEngineOptions): SetupGameEngineResult {
    const {
        character: characterRoot,
        hand: handRoot,
        map: mapRoot,
        eventDeck: eventDeckRoot,
        engine: engineRoot,
        gameLoop,
    } = containers;
    const { character: characterConfig, expeditionMap: expeditionMapConfig, eventDeck: eventDeckConfig, cards: cardsConfig, rules: rulesConfig } =
        configs;

    const { portrait, id: characterId, ...characterStateWithoutPortrait } = characterConfig;
    const initialCharacterState: CharacterCardState = {
        ...characterStateWithoutPortrait,
        portraitUrl: portrait,
    };
    const baseCharacterEffects: CharacterEffect[] = (initialCharacterState.effects ?? []).map((effect) => ({ ...effect }));

    if (characterRoot) {
        characterRoot.dataset.characterId = characterId;
    }

    const characterCard = new CharacterCard(characterRoot, initialCharacterState);

    let cardHandController: CardHandController;
    const cardHand = new CardHand(handRoot, {
        onMoveCardDrop: (card, territoryId) => cardHandController.onDrop(card, territoryId),
        onMoveCardTargetMissing: (card) => cardHandController.onDropTargetMissing(card),
        onCardConsumed: (card) => cardHandController.handleCardConsumed(card),
        onMoveCardDropFailure: (card, territoryId, message) =>
            cardHandController.onDropFailure(card, territoryId, message),
        onPlayerCardDrop: (card) => cardHandController.onDropOnPlayer(card),
        onEnemyCardDrop: (card, enemyId, context) => cardHandController.onDropOnEnemy(card, enemyId, context),
        onEndTurn: () => cardHandController?.handleEndTurn(),
    });

    const expeditionMap = new ExpeditionMap(mapRoot, expeditionMapConfig);

    const eventDeck = new EventDeck(eventDeckRoot, eventDeckConfig);
    const initialDeckState = createInitialDeckStateFromConfig(eventDeckConfig);

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

    new GameEngineMapAdapter(gameEngineStore, expeditionMap);
    new GameEngineEventDeckAdapter(gameEngineStore, eventDeck);

    let latestViewModel: GameViewModel = gameEngineStore.getViewModel();
    const viewModelListeners = new Set<(viewModel: GameViewModel) => void>();

    const notifyViewModelListeners = (viewModel: GameViewModel) => {
        for (const listener of viewModelListeners) {
            listener(viewModel);
        }
    };

    const updateCharacterCard = (viewModel: GameViewModel) => {
        const effects = buildCharacterEffects(baseCharacterEffects, viewModel);
        characterCard.setState({
            actionPoints: viewModel.actionsRemaining,
            health: viewModel.playerHealth,
            effects,
        });
    };

    const debugFacade = new GameEngineDebugFacade(gameEngineStore);
    new GameEngineWidget(engineRoot, gameEngineStore);

    cardHandController = new CardHandController({ cardHand, store: gameEngineStore });
    cardHandController.initialize();

    const victoryPhases: GamePhase[] = rulesConfig.victory.map((chapter) => createPhase(chapter));
    const defeatPhases: GamePhase[] = rulesConfig.defeat.map((chapter) => createPhase(chapter));

    const gameLoopPanel = new GameLoopPanel(gameLoop, {
        victoryPhases,
        defeatPhases,
    });

    const synchronizeViewModel = (viewModel: GameViewModel) => {
        latestViewModel = viewModel;
        updateCharacterCard(viewModel);
        gameLoopPanel.updateProgress(viewModel.victoryProgress, viewModel.defeatProgress);
        notifyViewModelListeners(viewModel);
    };

    gameEngineStore.subscribe((_event, viewModel) => {
        synchronizeViewModel(viewModel);
    });

    synchronizeViewModel(latestViewModel);

    gameEngineStore.initialize();

    return {
        store: gameEngineStore,
        debugFacade,
        cardHand,
        cardHandController,
        gameLoopPanel,
        getLatestViewModel: () => latestViewModel,
        onViewModelChange: (listener) => {
            viewModelListeners.add(listener);
            listener(latestViewModel);
            return () => {
                viewModelListeners.delete(listener);
            };
        },
    };
}

function buildCharacterEffects(baseEffects: CharacterEffect[], viewModel: GameViewModel): CharacterEffect[] {
    const effects = baseEffects.map((effect) => ({ ...effect }));
    const engaged = viewModel.engagedEnemies;

    if (engaged.length > 0) {
        const names = engaged.map((enemy) => enemy.name).join(", ");

        effects.push({
            id: "engaged-summary",
            name: `Сражается с ${engaged.length} врагами`,
            description: names ? `Противники: ${names}.` : undefined,
        });

        for (const enemy of engaged) {
            effects.push({
                id: `enemy-${enemy.id}`,
                name: enemy.name,
                description: "Перетащите карту атаки или уворота, чтобы взаимодействовать.",
                enemyId: enemy.id,
            });
        }
    }

    return effects;
}

function createPhase<ProgressKey extends string>(chapter: ChapterConfig<ProgressKey>): GamePhase {
    const { title, description, image, requirement } = chapter;

    if (requirement.type === "counter") {
        const key = requirement.progressKey;
        return {
            title,
            description,
            image,
            statusLabel: requirement.label,
            statusValue: (progress) => {
                const value = progress[key];
                const numeric = typeof value === "number" ? value : 0;
                return `${numeric} / ${requirement.target}`;
            },
            condition: (progress) => {
                const value = progress[key];
                const numeric = typeof value === "number" ? value : 0;
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

function formatBoolean(value: unknown): string {
    return value ? "Да" : "Нет";
}

function createRandomCard(): HandCardDefinition {
    const seed = Math.floor(Math.random() * 1000);
    const id = `debug-${Date.now()}-${seed}`;
    const palette = ["#1d4ed8", "#0ea5e9", "#22c55e", "#6366f1", "#f97316", "#ec4899"];
    const base = palette[seed % palette.length];
    const accent = palette[(seed + 3) % palette.length];
    const textColor = "#f8fafc";
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
    `;
    const image = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
    const effects: CardEffect[] = ["move", "attack", "hide", "search"];
    return {
        id,
        title: `Случайная карта ${seed}`,
        description: "Экспериментальная карта для отладки интерфейса.",
        image,
        cost: 1 + (seed % 4),
        effect: effects[seed % effects.length],
    };
}
