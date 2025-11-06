import Split from "split.js";


export class MovablePanels {

    leftPanel = document.getElementById('left')!;
    rightPanel = document.getElementById('right')!;
    leftTopPanel = document.getElementById('left-top')!;
    leftBottomPanel = document.getElementById('left-bottom')!;

    listeners = new Set<() => void>();
    triggerRightResize = () => { this.listeners.forEach(h => h()); };

    leftSplit = Split(['#left', '#right'], {
        sizes: [30, 70],
        minSize: [160, 200],
        gutterSize: 8,
        direction: 'horizontal',
        onDrag: () => {
            this.triggerRightResize()
        },
    });

    leftTopBottomSplit = Split(['#left-top', '#left-bottom'], {
        sizes: [50, 50],
        minSize: [50, 200],
        gutterSize: 8,
        direction: 'vertical',
    });

    addOnLeftLeftRightPanelSizeChanged(listener : ()=> void) {
        this.listeners.add(listener)
    }
}




