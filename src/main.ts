import './style.css'
import {createDraggabilly} from "./utils/draggeble_utils.ts";
import {MovablePanels} from "./utils/movable_panels.ts";
import {SimpleCardHand} from "./utils/simple_card_hand";
import {GameLoopPanel, type GamePhase} from "./utils/game_loop_panel";
import {createDebugButton} from "./utils/debug";

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
    cards: [
        'Мистическое видение',
        'Улики улицы Инсмут',
        'Загадочный ключ',
        'Зов Бездны',
        'Талисман хранителя',
    ],
})

// -- game loop timelines
const victoryProgress = {
    collectedClues: 0,
    ritualSegments: 0,
    finalSeal: false,
}

const defeatProgress = {
    doom: 0,
    cultActivity: 0,
    awakening: false,
}

const victoryPhases: GamePhase[] = [
    {
        title: 'Сбор улик',
        description: 'Агенты обследуют Мискатоник и собирают улики, чтобы понять слабости Древнего.',
        image: '/icon.svg',
        duration: 45,
        condition: () => victoryProgress.collectedClues >= 3,
    },
    {
        title: 'Расшифровка гримуара',
        description: 'Прорицатели объединяют усилия, чтобы собрать ритуал изгнания по найденным фрагментам.',
        image: '/icon.jpg',
        duration: 40,
        condition: () => victoryProgress.ritualSegments >= 2,
    },
    {
        title: 'Ритуал печати',
        description: 'Команда проводит обряд запечатывания портала, удерживая полчища культистов.',
        image: '/cthulhu.svg',
        duration: 35,
        condition: () => victoryProgress.finalSeal,
    },
]

const defeatPhases: GamePhase[] = [
    {
        title: 'Рост гибели',
        description: 'Культисты наращивают присутствие, распространяя ужас по улицам Аркхэма.',
        image: '/icon.jpg',
        duration: 30,
        condition: () => defeatProgress.doom >= 4,
    },
    {
        title: 'Темный ритуал',
        description: 'Чёрные свечи гаснут одна за другой — культисты завершают подготовку портала.',
        image: '/icon.svg',
        duration: 35,
        condition: () => defeatProgress.cultActivity >= 3,
    },
    {
        title: 'Пробуждение',
        description: 'Грохот за гранью разрывает тишину — Древний готов выйти в наш мир.',
        image: '/cthulhu.svg',
        duration: 45,
        condition: () => defeatProgress.awakening,
    },
]

const gameLoopRoot = document.getElementById('left-bottom');

const gameLoopPanel = new GameLoopPanel(gameLoopRoot, {
    victoryPhases,
    defeatPhases,
});

window.setInterval(() => {
    if (victoryProgress.collectedClues < 3) {
        victoryProgress.collectedClues += 1;
    }
}, 7000);

window.setInterval(() => {
    if (victoryProgress.collectedClues >= 3 && victoryProgress.ritualSegments < 2) {
        victoryProgress.ritualSegments += 1;
    }
}, 9000);

window.setTimeout(() => {
    victoryProgress.finalSeal = true;
}, 32000);

window.setInterval(() => {
    if (defeatProgress.doom < 4) {
        defeatProgress.doom += 1;
    }
}, 8000);

window.setInterval(() => {
    if (defeatProgress.doom >= 2 && defeatProgress.cultActivity < 3) {
        defeatProgress.cultActivity += 1;
    }
}, 11000);

window.setTimeout(() => {
    defeatProgress.awakening = true;
}, 42000);

document.body
    ?.appendChild(
        createDebugButton(
            "add",
            () => {
                simpleHand.addCard("new random card " + Math.random())
            }
        )
    );
