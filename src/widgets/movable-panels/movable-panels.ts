import Split from "split.js";


export class MovablePanels {

    leftPanel = document.getElementById('left')!;
    middlePanel = document.getElementById('middle')!;
    rightPanel = document.getElementById('right')!;
    leftTopPanel = document.getElementById('left-top')!;
    leftBottomPanel = document.getElementById('left-bottom')!;
    middleTopPanel = document.getElementById('middle-top')!;
    middleBottomPanel = document.getElementById('middle-bottom')!;
    rightTopPanel = document.getElementById('right-top')!;
    rightBottomPanel = document.getElementById('right-bottom')!;

    listeners = new Set<() => void>();
    triggerRightResize = () => { this.listeners.forEach(h => h()); };

    leftSplit = Split(['#left', '#middle', '#right'], {
        sizes: [25, 25, 50],
        minSize: [160, 160, 200],
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
        onDrag: () => {
            this.triggerRightResize()
        },
    });

    middleTopBottomSplit = Split(['#middle-top', '#middle-bottom'], {
        sizes: [50, 50],
        minSize: [80, 80],
        gutterSize: 8,
        direction: 'vertical',
        onDrag: () => {
            this.triggerRightResize()
        },
    });

    rightTopBottomSplit = Split(['#right-top', '#right-bottom'], {
        sizes: [65, 35],
        minSize: [120, 80],
        gutterSize: 8,
        direction: 'vertical',
        onDrag: () => {
            this.triggerRightResize()
        },
    });

    addOnLeftLeftRightPanelSizeChanged(listener : ()=> void) {
        this.listeners.add(listener)
    }
}




