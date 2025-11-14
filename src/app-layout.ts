import { MovablePanels } from './widgets/movable-panels/movable-panels'

export type AppLayoutElements = {
    handPanel: HTMLElement
    characterPanel: HTMLElement
    mapPanel: HTMLElement
    leftBottomPanel: HTMLElement
    rightTopPanel: HTMLElement
    rightBottomPanel: HTMLElement
}

export type SetupAppLayoutResult = AppLayoutElements & {
    movablePanels: MovablePanels
}

export function setupAppLayout(root: HTMLElement): SetupAppLayoutResult {
    root.innerHTML = `
  <div id="main-split">
    <div id="left">
        <div id="left-split">
            <div id="left-top">
                <div id="hand-panel"></div>
            </div>
            <div id="left-bottom"></div>
        </div>
    </div>
    <div id="middle">
        <div id="middle-split">
            <div id="middle-top">
                <div id="map-panel"></div>
            </div>
            <div id="middle-bottom">
                <div id="character-panel"></div>
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

    const query = <T extends HTMLElement>(selector: string): T => {
        const element = root.querySelector<T>(selector)
        if (!element) {
            throw new Error(`Не удалось найти элемент макета по селектору ${selector}`)
        }

        return element
    }

    const movablePanels = new MovablePanels()

    return {
        movablePanels,
        handPanel: query('#hand-panel'),
        characterPanel: query('#character-panel'),
        mapPanel: query('#map-panel'),
        leftBottomPanel: query('#left-bottom'),
        rightTopPanel: query('#right-top'),
        rightBottomPanel: query('#right-bottom'),
    }
}
