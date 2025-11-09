import './style.css'
import { createDraggabilly } from "./widgets/draggeble-utils/draggeble-utils";
import { MovablePanels } from "./widgets/movable-panels/movable-panels";
import { SimpleCardHand } from "./widgets/simple-card-hand/simple-card-hand";
import { GameLoopPanel, type GamePhase } from "./widgets/game-loop-panel/game-loop-panel";
import { createDebugButton } from "./widgets/debug/debug";
import cardsSource from "./data/cards.json";
import rulesSource from "./data/rules.json";

type CardsConfig = {
    initialHand: string[];
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

const cardsConfig = cardsSource as CardsConfig;
const rulesConfig = rulesSource as RulesConfig;

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <div id="main-split">
    <div id="box"></div>

    <div id="left">
        Левая панель

        <div id="left-split">
            <div id="left-top">
            </div>
            <div id="left-bottom"></div>
        </div>
    </div>
    <div id="right">
        Правая панель
        text text
    </div>
  </div>
`

// -- ui components
const draggableBox = createDraggabilly(document.getElementById('box')!)
const movablePanels = new MovablePanels()

const handRoot = document.getElementById('sample-hand')
const simpleHand = new SimpleCardHand(handRoot, {
    cards: cardsConfig.initialHand,
})

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

const debugRoot = document.getElementById('left-top');
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
        simpleHand.addCard(`Случайная карта ${Math.floor(Math.random() * 1000)}`)
    });
    cardsGroup.appendChild(addCardButton);
    panel.appendChild(cardsGroup);
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
