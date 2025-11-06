import './style.css'
import {createDraggabilly} from "./utils/draggeble_utils.ts";
import {MovablePanels} from "./utils/movable_panels.ts";
import {CardHand} from './utils/card_hand.ts'

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
          <div id="sample-hand"></div>
    </div>
</div>
`

// -- ui components
const draggableBox = createDraggabilly(document.getElementById('box')!)
const movablePanels = new MovablePanels()

const handRoot = document.getElementById('sample-hand')
const hand = new CardHand(
    handRoot,
    {
        cards: [
            'Мистическое видение',
            'Улики улицы Инсмут',
            'Загадочный ключ',
            'Зов Бездны',
            'Талисман хранителя',
        ],
    }
)


const button = document.createElement('button');
button.textContent = 'добавить карту';
button.id = 'left-top-add-button';
document.getElementById('left-top')?.appendChild(button);

button.addEventListener('click', () => {
    hand.addCard("new random card " + Math.random())
});