import Split from "split.js";

const PANEL_COOKIE_PREFIX = "doa_panels_";
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export class MovablePanels {

    private cookieName(key: string): string {
        return `${PANEL_COOKIE_PREFIX}${key}`;
    }

    private readCookie(key: string): string | undefined {
        const cookieName = `${key}=`;
        return document.cookie
            .split(";")
            .map(row => row.trim())
            .find(row => row.startsWith(cookieName))
            ?.substring(cookieName.length);
    }

    private writeCookie(key: string, value: string): void {
        document.cookie = `${key}=${value}; max-age=${ONE_YEAR_SECONDS}; path=/`;
    }

    private getStoredSizes(key: string, fallback: number[]): number[] {
        const raw = this.readCookie(this.cookieName(key));
        if (!raw) {
            return fallback;
        }
        try {
            const parsed = JSON.parse(decodeURIComponent(raw));
            if (Array.isArray(parsed) && parsed.length === fallback.length && parsed.every(v => typeof v === "number")) {
                return parsed as number[];
            }
        } catch (err) {
            console.warn("Failed to parse panel sizes cookie", key, err);
        }
        return fallback;
    }

    private persistSizes(key: string, sizes: number[]): void {
        const encoded = encodeURIComponent(JSON.stringify(sizes));
        this.writeCookie(this.cookieName(key), encoded);
    }

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
        sizes: this.getStoredSizes('left', [25, 25, 50]),
        minSize: [160, 160, 200],
        gutterSize: 4,
        direction: 'horizontal',
        onDrag: () => {
            this.triggerRightResize()
        },
        onDragEnd: () => {
            this.persistSizes('left', this.leftSplit.getSizes());
        }
    });

    leftTopBottomSplit = Split(['#left-top', '#left-bottom'], {
        sizes: this.getStoredSizes('leftVertical', [50, 50]),
        minSize: [50, 200],
        gutterSize: 4,
        direction: 'vertical',
        onDrag: () => {
            this.triggerRightResize()
        },
        onDragEnd: () => {
            this.persistSizes('leftVertical', this.leftTopBottomSplit.getSizes());
        }
    });

    middleTopBottomSplit = Split(['#middle-top', '#middle-bottom'], {
        sizes: this.getStoredSizes('middleVertical', [50, 50]),
        minSize: [80, 80],
        gutterSize: 4,
        direction: 'vertical',
        onDrag: () => {
            this.triggerRightResize()
        },
        onDragEnd: () => {
            this.persistSizes('middleVertical', this.middleTopBottomSplit.getSizes());
        }
    });

    rightTopBottomSplit = Split(['#right-top', '#right-bottom'], {
        sizes: this.getStoredSizes('rightVertical', [65, 35]),
        minSize: [120, 80],
        gutterSize: 4,
        direction: 'vertical',
        onDrag: () => {
            this.triggerRightResize()
        },
        onDragEnd: () => {
            this.persistSizes('rightVertical', this.rightTopBottomSplit.getSizes());
        }
    });

    addOnLeftLeftRightPanelSizeChanged(listener : ()=> void) {
        this.listeners.add(listener)
    }
}




