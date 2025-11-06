import './style.css'
import { setupCounter } from './counter.ts'
import {createDraggabilly} from "./draggeble_utils.ts";
import {MovablePanels} from "./movable_panels.ts";

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

setupCounter(document.querySelector<HTMLButtonElement>('#counter')!)
