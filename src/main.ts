import './style.css'
import {createDraggabilly} from "./draggeble_utils.ts";
import {MovablePanels} from "./movable_panels.ts";
import { CardHand } from './card_hand.ts'

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <div id="main-split">
    <div id="box"></div>

    <div id="left">
        Левая панель

        <div id="left-split">
            <div id="left-top">
                <div id="sample-hand"></div>
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
if (handRoot) {
    new CardHand(handRoot, {
        cards: [
            'Мистическое видение',
            'Улики улицы Инсмут',
            'Загадочный ключ',
            'Зов Бездны',
            'Талисман хранителя',
        ],
    })
}
