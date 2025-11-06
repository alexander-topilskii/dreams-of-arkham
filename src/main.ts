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
    </div>
  </div>
  <div id="hand-overlay">
      <div class="card-hand-wrapper">
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

button.style.position = 'absolute';
button.style.top = '10px';
button.style.left = '10px';
button.style.padding = '6px 12px';
button.style.background = '#1e293b';
button.style.color = 'white';
button.style.border = '1px solid rgba(255,255,255,0.15)';
button.style.borderRadius = '8px';
button.style.cursor = 'pointer';
button.style.backdropFilter = 'blur(6px)';
button.style.zIndex = '1000';

document.getElementById('left-top')?.appendChild(button);

button.addEventListener('click', () => {
    hand.addCard("new random card " + Math.random())
});