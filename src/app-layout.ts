import { MovablePanels } from "./widgets/movable-panels/movable-panels";

export type AppLayoutElements = {
    handPanel: HTMLElement | null;
    characterPanel: HTMLElement | null;
    mapPanel: HTMLElement | null;
    leftBottomPanel: HTMLElement | null;
    rightTopPanel: HTMLElement | null;
    rightBottomPanel: HTMLElement | null;
};

export type SetupAppLayoutResult = AppLayoutElements & {
    movablePanels: MovablePanels;
};

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
`;

    const movablePanels = new MovablePanels();

    return {
        movablePanels,
        handPanel: document.getElementById("hand-panel"),
        characterPanel: document.getElementById("character-panel"),
        mapPanel: document.getElementById("map-panel"),
        leftBottomPanel: document.getElementById("left-bottom"),
        rightTopPanel: document.getElementById("right-top"),
        rightBottomPanel: document.getElementById("right-bottom"),
    };
}
