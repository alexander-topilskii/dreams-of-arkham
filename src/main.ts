import './style.css'
import {createDraggabilly} from "./utils/draggeble_utils.ts";
import {MovablePanels} from "./utils/movable_panels.ts";
import {SimpleCardHand} from "./utils/simple_card_hand";
import {createDebugButton} from "./utils/debug";

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <div id="main-split">
    <div id="box"></div>

    <div id="left">
        Левая панель

        <div id="left-split">
            <div id="left-top">
            </div>
            <div id="left-bottom">
                left bottom
            </div>
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

document.body
    ?.appendChild(
        createDebugButton(
            "add",
            () => {
                simpleHand.addCard("new random card " + Math.random())
            }
        )
    );
