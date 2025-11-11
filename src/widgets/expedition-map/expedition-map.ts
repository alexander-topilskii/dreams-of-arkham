export type TerritoryConnectionType = 'one-way' | 'two-way';

export type TerritoryConnection = {
    targetId: string;
    type: TerritoryConnectionType;
};

export type TerritorySide = {
    title: string;
    description?: string;
    image?: string;
};

export type TerritoryBase = {
    id: string;
    back: TerritorySide & { title: string };
    front: TerritorySide & { title: string; description: string; image: string };
    connections: TerritoryConnection[];
};

export type TerritoryPosition = { x: number; y: number };

export type TerritoryConfig = TerritoryBase & {
    position?: TerritoryPosition;
};

export type Territory = TerritoryBase & {
    position: TerritoryPosition;
};

export type ExpeditionMapCharacterConfig = {
    id: string;
    name?: string;
    label?: string;
    color?: string;
    textColor?: string;
};

export type ExpeditionMapCharacterPlacement = {
    territoryId: string;
    character: ExpeditionMapCharacterConfig;
};

export type ExpeditionMapConfig = {
    territories: TerritoryConfig[];
    characters?: ExpeditionMapCharacterPlacement[];
};

type TerritoryElement = HTMLDivElement & {
    __charactersContainer?: HTMLDivElement;
};

type TerritoryView = {
    data: Territory;
    element: TerritoryElement;
    isFlipped: boolean;
    charactersContainer: HTMLDivElement;
};

type CharacterView = {
    id: string;
    element: HTMLDivElement;
    territoryId: string;
};

const HEX_WIDTH = 156;
const HEX_HEIGHT = 180;
const HEX_RADIUS = HEX_HEIGHT / 2;
const SQRT_3 = Math.sqrt(3);
const MIN_MAP_WIDTH = 1600;
const MIN_MAP_HEIGHT = 1200;
const MAP_PADDING = 160;
const MOVE_THRESHOLD = 6;

type CubeCoordinate = { x: number; y: number; z: number };

const AUTO_CUBE_DIRECTIONS: CubeCoordinate[] = [
    { x: 1, y: -1, z: 0 },
    { x: 1, y: 0, z: -1 },
    { x: 0, y: 1, z: -1 },
    { x: -1, y: 1, z: 0 },
    { x: -1, y: 0, z: 1 },
    { x: 0, y: -1, z: 1 },
];

const HEX_POLYGON_POINTS = [
    { x: HEX_WIDTH * 0.25, y: 0 },
    { x: HEX_WIDTH * 0.75, y: 0 },
    { x: HEX_WIDTH, y: HEX_HEIGHT * 0.5 },
    { x: HEX_WIDTH * 0.75, y: HEX_HEIGHT },
    { x: HEX_WIDTH * 0.25, y: HEX_HEIGHT },
    { x: 0, y: HEX_HEIGHT * 0.5 },
];

const styleId = 'expedition-map-styles';

const styles = `
.expedition-map {
    position: relative;
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    background: rgba(15, 23, 42, 0.3);
    border: 1px solid rgba(148, 163, 184, 0.2);
    border-radius: 16px;
    overflow: hidden;
    backdrop-filter: blur(6px);
    --map-scale: 1;
}

.expedition-map__viewport {
    position: relative;
    flex: 1;
    min-height: 0;
    overflow: hidden;
    cursor: grab;
    touch-action: none;
}

.expedition-map__viewport:active {
    cursor: grabbing;
}

.expedition-map__content {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate3d(-50%, -50%, 0);
    width: ${MIN_MAP_WIDTH}px;
    height: ${MIN_MAP_HEIGHT}px;
    will-change: transform;
}


.expedition-map__connections {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 0;
}

.expedition-map__territories {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 1;
}

.expedition-map__territories > .map-territory {
    pointer-events: auto;
}

.map-territory {
    position: absolute;
    width: calc(${HEX_WIDTH}px * var(--map-scale));
    height: calc(${HEX_HEIGHT}px * var(--map-scale));
    transform: translate3d(var(--x), var(--y), 0);
    transform-origin: center;
    clip-path: polygon(25% 0, 75% 0, 100% 50%, 75% 100%, 25% 100%, 0 50%);
    transition: filter 0.2s ease;
    user-select: none;
}

.map-territory.is-dragging {
    filter: drop-shadow(0 12px 18px rgba(15, 23, 42, 0.55));
    transition: none;
    z-index: 10;
}

.map-territory__characters {
    position: absolute;
    top: calc(-12px * var(--map-scale));
    right: calc(-12px * var(--map-scale));
    display: flex;
    flex-wrap: wrap;
    gap: clamp(4px, 6px * var(--map-scale), 10px);
    justify-content: flex-end;
    pointer-events: none;
    max-width: calc(100% + 48px * var(--map-scale));
}

.map-territory__characters:empty {
    display: none;
}

.map-territory__character {
    width: clamp(24px, 32px * var(--map-scale), 44px);
    height: clamp(24px, 32px * var(--map-scale), 44px);
    border-radius: 999px;
    display: grid;
    place-items: center;
    font-family: "Rubik", "Segoe UI", system-ui, sans-serif;
    font-weight: 600;
    font-size: clamp(11px, 14px * var(--map-scale), 16px);
    letter-spacing: 0.04em;
    background: var(--character-color, rgba(30, 41, 59, 0.92));
    color: var(--character-text-color, #f8fafc);
    box-shadow: 0 8px 18px rgba(15, 23, 42, 0.35);
    border: 2px solid rgba(15, 23, 42, 0.6);
    padding: 0;
    pointer-events: none;
}

.map-territory__inner {
    position: relative;
    width: 100%;
    height: 100%;
    perspective: 900px;
}

.map-territory__face {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: clamp(12px, 16px * var(--map-scale), 28px);
    border-radius: 0;
    clip-path: inherit;
    backface-visibility: hidden;
    transition: opacity 0.25s ease, transform 0.45s ease;
}

.map-territory[data-state="back"] .map-territory__face--front {
    opacity: 0;
    pointer-events: none;
    transform: rotateY(180deg);
}

.map-territory[data-state="back"] .map-territory__face--back {
    opacity: 1;
    transform: rotateY(0deg);
}

.map-territory[data-state="front"] .map-territory__face--front {
    opacity: 1;
    transform: rotateY(0deg);
}

.map-territory[data-state="front"] .map-territory__face--back {
    opacity: 0;
    pointer-events: none;
    transform: rotateY(-180deg);
}

.map-territory__face--back {
    background: linear-gradient(135deg, rgba(51, 65, 85, 0.95), rgba(15, 23, 42, 0.95));
    color: #e2e8f0;
    font-family: "Rubik", "Segoe UI", system-ui, sans-serif;
    font-weight: 600;
    font-size: 16px;
    letter-spacing: 0.02em;
    text-align: center;
    align-items: center;
    justify-content: center;
}

.map-territory__face--front {
    background-size: cover;
    background-position: center;
    color: #f8fafc;
    font-family: "Rubik", "Segoe UI", system-ui, sans-serif;
    box-shadow: inset 0 -160px 120px -120px rgba(15, 23, 42, 0.85);
}

.map-territory__overlay {
    background: linear-gradient(180deg, rgba(15, 23, 42, 0.15) 0%, rgba(15, 23, 42, 0.85) 70%);
    border-radius: 0;
    clip-path: inherit;
    position: absolute;
    inset: 0;
    pointer-events: none;
}

.map-territory__front-content {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: clamp(4px, 6px * var(--map-scale), 12px);
    align-items: stretch;
}

.map-territory__text-frame {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: calc(100% - clamp(48px, 56px * var(--map-scale), 92px));
    max-width: 100%;
    max-height: calc(100% - clamp(72px, 84px * var(--map-scale), 128px));
    padding: clamp(10px, 12px * var(--map-scale), 18px);
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
    align-items: stretch;
    overflow: hidden;
}

.map-territory__text-frame::before {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: clamp(12px, 14px * var(--map-scale), 20px);
    border: 1px solid transparent;
    pointer-events: none;
}

.map-territory__text-frame > * {
    position: relative;
    z-index: 1;
}

.map-territory__title {
    font-size: 16px;
    font-weight: 700;
    text-transform: none;
    margin: 0;
    text-align: center;
    display: -webkit-box;
    -webkit-line-clamp: var(--title-lines, 2);
    -webkit-box-orient: vertical;
    overflow: hidden;
    text-overflow: ellipsis;
}

.map-territory__description {
    font-size: 12px;
    line-height: 1.4;
    opacity: 0.85;
    margin: 0;
    text-align: center;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: var(--description-lines, 3);
    overflow: hidden;
    text-overflow: ellipsis;
}

.expedition-map__legend {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    padding: 12px 16px;
    background: rgba(15, 23, 42, 0.45);
    border-top: 1px solid rgba(148, 163, 184, 0.18);
    font-family: "Rubik", "Segoe UI", system-ui, sans-serif;
    font-size: 12px;
    color: rgba(226, 232, 240, 0.85);
}

.expedition-map__legend-item {
    display: flex;
    align-items: center;
    gap: 8px;
}

.expedition-map__legend-arrow,
.expedition-map__legend-line {
    width: 36px;
    height: 4px;
    border-radius: 999px;
    position: relative;
    background: rgba(148, 163, 184, 0.65);
}

.expedition-map__legend-arrow::after {
    content: '';
    position: absolute;
    right: -6px;
    top: 50%;
    transform: translateY(-50%) rotate(45deg);
    width: 6px;
    height: 6px;
    border-top: 2px solid rgba(248, 250, 252, 0.9);
    border-right: 2px solid rgba(248, 250, 252, 0.9);
}

.expedition-map__controls {
    position: absolute;
    right: 16px;
    bottom: 16px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 8px;
    background: rgba(15, 23, 42, 0.55);
    border: 1px solid rgba(148, 163, 184, 0.25);
    border-radius: 12px;
    box-shadow: 0 10px 20px rgba(15, 23, 42, 0.45);
    backdrop-filter: blur(6px);
    z-index: 2;
    pointer-events: auto;
}

.expedition-map__controls-button {
    width: 36px;
    height: 36px;
    display: grid;
    place-items: center;
    border: 1px solid rgba(148, 163, 184, 0.35);
    border-radius: 8px;
    background: rgba(30, 41, 59, 0.85);
    color: #e2e8f0;
    font-family: "Rubik", "Segoe UI", system-ui, sans-serif;
    font-size: 18px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s ease, color 0.2s ease;
}

.expedition-map__controls-button:focus-visible {
    outline: 2px solid rgba(148, 163, 184, 0.65);
    outline-offset: 2px;
}

.expedition-map__controls-button:hover {
    background: rgba(51, 65, 85, 0.95);
    color: #f8fafc;
}

.expedition-map__controls-button:active {
    background: rgba(15, 23, 42, 0.95);
}
`;

function cloneTerritory<T>(value: T): T {
    if (typeof structuredClone === 'function') {
        return structuredClone(value);
    }

    return JSON.parse(JSON.stringify(value));
}

function ensureStyles() {
    if (document.getElementById(styleId)) {
        return;
    }

    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = styles;
    document.head.appendChild(style);
}

export class ExpeditionMap {
    private readonly root: HTMLElement;
    private readonly viewport: HTMLDivElement;
    private readonly content: HTMLDivElement;
    private readonly territoryLayer: HTMLDivElement;
    private readonly connectionsLayer: SVGSVGElement;
    private readonly connectionGroup: SVGGElement;
    private readonly territories = new Map<string, TerritoryView>();
    private readonly characters = new Map<string, CharacterView>();
    private mapSize = { width: MIN_MAP_WIDTH, height: MIN_MAP_HEIGHT };
    private coordinateOffset = { x: 0, y: 0 };
    private offset = { x: 0, y: 0 };
    private autoLayoutCursor = 0;
    private scale = 1;
    private readonly minScale = 0.5;
    private readonly maxScale = 2.8;
    private readonly scaleStep = 0.15;
    private zoomControls: {
        zoomIn: HTMLButtonElement;
        zoomOut: HTMLButtonElement;
        reset: HTMLButtonElement;
    } | null = null;

    constructor(root: HTMLElement | null, config: ExpeditionMapConfig) {
        if (!root) {
            throw new Error('ExpeditionMap: root element was not provided');
        }

        ensureStyles();

        this.root = document.createElement('div');
        this.root.className = 'expedition-map';

        this.viewport = document.createElement('div');
        this.viewport.className = 'expedition-map__viewport';

        this.content = document.createElement('div');
        this.content.className = 'expedition-map__content';

        this.connectionsLayer = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        this.connectionsLayer.classList.add('expedition-map__connections');
        this.applyMapSize();

        const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
        defs.innerHTML = `
            <marker id="map-arrow-end" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="rgba(226, 232, 240, 0.85)" />
            </marker>
        `;
        this.connectionsLayer.appendChild(defs);

        this.connectionGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        this.connectionGroup.setAttribute('stroke', 'rgba(148, 163, 184, 0.75)');
        this.connectionGroup.setAttribute('stroke-width', '4');
        this.connectionGroup.setAttribute('fill', 'none');
        this.connectionGroup.setAttribute('stroke-linecap', 'round');
        this.connectionGroup.setAttribute('stroke-linejoin', 'round');

        this.connectionsLayer.appendChild(this.connectionGroup);

        this.territoryLayer = document.createElement('div');
        this.territoryLayer.className = 'expedition-map__territories';

        this.content.appendChild(this.connectionsLayer);
        this.content.appendChild(this.territoryLayer);
        this.viewport.appendChild(this.content);
        this.viewport.appendChild(this.createControls());
        this.root.appendChild(this.viewport);
        this.root.appendChild(this.createLegend());
        root.appendChild(this.root);

        this.root.style.setProperty('--map-scale', this.scale.toString());

        this.initializePan();
        this.initializeZoom();

        const prepared = this.prepareInitialTerritories(config.territories);
        const territories = prepared.map((territory) => this.createTerritoryState(territory));
        this.bootstrapCoordinateSpace(territories);

        territories.forEach((territory) => {
            this.mountTerritory(territory);
        });

        this.refreshConnections();
        this.updateTerritoryScaleStyles();
        this.updateZoomControls();

        if (config.characters) {
            config.characters.forEach((placement) => {
                this.placeCharacter(placement.character, placement.territoryId);
            });
        }
    }

    public addTerritory(territory: TerritoryConfig): void {
        if (this.territories.has(territory.id)) {
            console.warn(`Territory with id "${territory.id}" already exists.`);
            return;
        }

        const prepared = this.createTerritoryState(territory);
        this.mountTerritory(prepared);
        this.refreshConnections();
        this.updateTerritoryScaleStyles();
        this.updateZoomControls();
    }

    private prepareInitialTerritories(source: TerritoryConfig[]): TerritoryConfig[] {
        const clones = source.map((territory) => cloneTerritory(territory) as TerritoryConfig);
        const missing = clones.filter((territory) => !territory.position);

        if (missing.length === 0) {
            return clones;
        }

        const distributed = this.computeEvenDistribution(missing.length);
        let cursor = 0;

        clones.forEach((territory) => {
            if (territory.position) {
                return;
            }

            territory.position = distributed[cursor] ?? this.acquireAutoPosition();
            cursor += 1;
        });

        this.autoLayoutCursor = distributed.length;

        return clones;
    }

    private computeEvenDistribution(count: number): TerritoryPosition[] {
        if (count === 0) {
            return [];
        }

        const rect = this.viewport.getBoundingClientRect();
        const viewportWidth = rect.width || this.viewport.clientWidth || this.root.clientWidth || MIN_MAP_WIDTH;
        const viewportHeight = rect.height || this.viewport.clientHeight || this.root.clientHeight || MIN_MAP_HEIGHT;
        const width = Math.max(viewportWidth, HEX_WIDTH + MAP_PADDING * 2);
        const height = Math.max(viewportHeight, HEX_HEIGHT + MAP_PADDING * 2);

        const columns = Math.ceil(Math.sqrt(count));
        const rows = Math.ceil(count / columns);

        const usableWidth = Math.max(width - MAP_PADDING * 2 - HEX_WIDTH, 0);
        const usableHeight = Math.max(height - MAP_PADDING * 2 - HEX_HEIGHT, 0);

        const horizontalStep = columns > 1 ? usableWidth / (columns - 1) : 0;
        const verticalStep = rows > 1 ? usableHeight / (rows - 1) : 0;

        const positions: TerritoryPosition[] = [];

        for (let row = 0; row < rows; row += 1) {
            for (let column = 0; column < columns; column += 1) {
                if (positions.length >= count) {
                    break;
                }

                positions.push({
                    x: Math.round(MAP_PADDING + column * horizontalStep),
                    y: Math.round(MAP_PADDING + row * verticalStep),
                });
            }
        }

        return positions;
    }

    private mountTerritory(territory: Territory): void {
        territory.position.x += this.coordinateOffset.x;
        territory.position.y += this.coordinateOffset.y;

        const element = this.createTerritoryElement(territory);
        this.territoryLayer.appendChild(element);

        const charactersContainer = element.__charactersContainer ?? this.createCharacterContainer(element);

        const view: TerritoryView = {
            data: territory,
            element,
            isFlipped: false,
            charactersContainer,
        };

        this.territories.set(territory.id, view);

        this.ensureMapFitsTerritories();

        territory.connections.forEach((connection) => {
            if (connection.type !== 'two-way') {
                return;
            }

            const target = this.territories.get(connection.targetId);
            if (!target) {
                return;
            }

            const exists = target.data.connections.some((link) => link.targetId === territory.id);
            if (!exists) {
                target.data.connections.push({ targetId: territory.id, type: 'two-way' });
            }
        });

        this.positionTerritory(view);
        view.element.style.setProperty('--description-lines', String(this.getDescriptionLineClamp()));
        view.element.style.setProperty('--title-lines', String(this.getTitleLineClamp()));
    }

    private createTerritoryState(source: TerritoryConfig): Territory {
        const clone = cloneTerritory(source) as TerritoryConfig;
        const position = clone.position ? { ...clone.position } : this.acquireAutoPosition();

        return {
            ...clone,
            position,
        };
    }

    private acquireAutoPosition(): TerritoryPosition {
        const axial = this.getAutoAxial(this.autoLayoutCursor);
        this.autoLayoutCursor += 1;
        return this.axialToPosition(axial.q, axial.r);
    }

    private getAutoAxial(index: number): { q: number; r: number } {
        if (index === 0) {
            return { q: 0, r: 0 };
        }

        let radius = 1;
        let count = 1;

        while (true) {
            const ringSize = radius * 6;

            if (index < count + ringSize) {
                let cube: CubeCoordinate = {
                    x: AUTO_CUBE_DIRECTIONS[4].x * radius,
                    y: AUTO_CUBE_DIRECTIONS[4].y * radius,
                    z: AUTO_CUBE_DIRECTIONS[4].z * radius,
                };

                let offset = index - count;

                for (let side = 0; side < AUTO_CUBE_DIRECTIONS.length; side += 1) {
                    const direction = AUTO_CUBE_DIRECTIONS[side];

                    for (let step = 0; step < radius; step += 1) {
                        if (offset === 0) {
                            return { q: cube.x, r: cube.z };
                        }

                        cube = {
                            x: cube.x + direction.x,
                            y: cube.y + direction.y,
                            z: cube.z + direction.z,
                        };

                        offset -= 1;
                    }
                }
            }

            count += ringSize;
            radius += 1;
        }
    }

    private axialToPosition(q: number, r: number): TerritoryPosition {
        const centerX = HEX_RADIUS * SQRT_3 * (q + r / 2);
        const centerY = HEX_RADIUS * 1.5 * r;

        return {
            x: Math.round(centerX - HEX_WIDTH / 2),
            y: Math.round(centerY - HEX_HEIGHT / 2),
        };
    }

    public getTerritoryIds(): string[] {
        return Array.from(this.territories.keys());
    }

    public placeCharacter(character: ExpeditionMapCharacterConfig, territoryId: string): void {
        const target = this.territories.get(territoryId);

        if (!target) {
            console.warn(`ExpeditionMap: territory with id "${territoryId}" was not found.`);
            return;
        }

        const id = character.id?.trim();
        if (!id) {
            console.warn('ExpeditionMap: character id must be provided.');
            return;
        }

        const label = this.resolveCharacterLabel(character);
        const color = character.color ?? this.getDefaultCharacterColor(id);
        const textColor = character.textColor ?? '#f8fafc';
        const title = character.name ?? character.label ?? id;

        let view = this.characters.get(id);

        if (!view) {
            const element = this.createCharacterElement();
            element.dataset.characterId = id;
            view = { id, element, territoryId };
            this.characters.set(id, view);
        }

        if (view.territoryId !== territoryId) {
            this.detachCharacterFromTerritory(view);
            view.territoryId = territoryId;
        }

        view.element.textContent = label;
        view.element.style.setProperty('--character-color', color);
        view.element.style.setProperty('--character-text-color', textColor);
        view.element.title = title;

        if (!target.charactersContainer.contains(view.element)) {
            target.charactersContainer.appendChild(view.element);
        }
    }

    public revealTerritory(territoryId: string): void {
        const view = this.territories.get(territoryId);

        if (!view) {
            console.warn(`ExpeditionMap: territory with id "${territoryId}" was not found.`);
            return;
        }

        if (view.isFlipped) {
            return;
        }

        view.isFlipped = true;
        view.element.dataset.state = 'front';
    }

    public removeCharacter(characterId: string): void {
        const view = this.characters.get(characterId);
        if (!view) {
            return;
        }

        this.detachCharacterFromTerritory(view);
        this.characters.delete(characterId);
    }

    private detachCharacterFromTerritory(view: CharacterView) {
        const territory = this.territories.get(view.territoryId);
        if (!territory) {
            return;
        }

        if (territory.charactersContainer.contains(view.element)) {
            territory.charactersContainer.removeChild(view.element);
        }
    }

    private createCharacterElement(): HTMLDivElement {
        const element = document.createElement('div');
        element.className = 'map-territory__character';
        return element;
    }

    private resolveCharacterLabel(character: ExpeditionMapCharacterConfig): string {
        const preferred = character.label?.trim();
        if (preferred) {
            return this.normalizeLabel(preferred);
        }

        if (character.name) {
            const initials = this.extractInitials(character.name);
            if (initials) {
                return initials;
            }
        }

        const idInitials = this.extractInitials(character.id);
        return idInitials || '?';
    }

    private normalizeLabel(value: string): string {
        const trimmed = value.trim();
        if (!trimmed) {
            return '?';
        }

        return trimmed.slice(0, 3).toUpperCase();
    }

    private extractInitials(source: string): string {
        const tokens = source
            .split(/[^\p{L}\p{N}]+/u)
            .map((part) => part.trim())
            .filter(Boolean);

        const chars: string[] = [];

        for (let i = 0; i < tokens.length && chars.length < 2; i += 1) {
            const token = tokens[i];
            const [first] = Array.from(token);
            if (first) {
                chars.push(first.toUpperCase());
            }
        }

        if (chars.length > 0) {
            return chars.join('').slice(0, 3);
        }

        const fallback = Array.from(source).find((char) => /[\p{L}\p{N}]/u.test(char));
        return fallback ? fallback.toUpperCase() : '';
    }

    private getDefaultCharacterColor(id: string): string {
        const palette = ['#6366f1', '#ec4899', '#22c55e', '#f59e0b', '#0ea5e9', '#f97316', '#14b8a6'];
        const index = Math.abs(this.hashString(id)) % palette.length;
        return palette[index] ?? '#1e293b';
    }

    private hashString(value: string): number {
        let hash = 0;
        for (let i = 0; i < value.length; i += 1) {
            hash = (hash << 5) - hash + value.charCodeAt(i);
            hash |= 0;
        }
        return hash;
    }

    private initializePan() {
        let isPanning = false;
        let pointerId: number | null = null;
        let startX = 0;
        let startY = 0;
        let originX = 0;
        let originY = 0;

        this.viewport.addEventListener('pointerdown', (event) => {
            if (event.button !== 0) {
                return;
            }

            const target = event.target as HTMLElement;
            if (target.closest('.map-territory')) {
                return;
            }

            isPanning = true;
            pointerId = event.pointerId;
            startX = event.clientX;
            startY = event.clientY;
            originX = this.offset.x;
            originY = this.offset.y;
            this.viewport.setPointerCapture(pointerId);
        });

        this.viewport.addEventListener('pointermove', (event) => {
            if (!isPanning || event.pointerId !== pointerId) {
                return;
            }

            const dx = event.clientX - startX;
            const dy = event.clientY - startY;

            this.offset = {
                x: originX + dx,
                y: originY + dy,
            };

            this.applyOffset();
            this.updateZoomControls();
        });

        const stopPan = (event: PointerEvent) => {
            if (!isPanning || event.pointerId !== pointerId) {
                return;
            }

            isPanning = false;
            pointerId = null;
            this.viewport.releasePointerCapture(event.pointerId);
        };

        this.viewport.addEventListener('pointerup', stopPan);
        this.viewport.addEventListener('pointercancel', stopPan);
    }

    private initializeZoom() {
        this.viewport.addEventListener(
            'wheel',
            (event) => {
                event.preventDefault();

                const rect = this.viewport.getBoundingClientRect();
                const anchor = {
                    x: event.clientX - rect.left,
                    y: event.clientY - rect.top,
                };

                const direction = event.deltaY < 0 ? 1 : -1;
                this.zoomByStep(direction as 1 | -1, anchor);
            },
            { passive: false },
        );
    }

    private applyOffset() {
        this.content.style.transform = `translate3d(calc(-50% + ${this.offset.x}px), calc(-50% + ${this.offset.y}px), 0)`;
    }

    private applyMapSize() {
        if (!this.content || !this.connectionsLayer) {
            return;
        }

        const width = this.mapSize.width * this.scale;
        const height = this.mapSize.height * this.scale;

        this.content.style.width = `${width}px`;
        this.content.style.height = `${height}px`;
        this.connectionsLayer.setAttribute(
            'viewBox',
            `${-width / 2} ${-height / 2} ${width} ${height}`,
        );
    }

    private zoomByStep(direction: 1 | -1, anchor?: { x: number; y: number }) {
        const factor = 1 + this.scaleStep;
        const nextScale = direction > 0 ? this.scale * factor : this.scale / factor;
        this.setScale(nextScale, anchor);
    }

    private setScale(nextScale: number, anchor?: { x: number; y: number }, force = false) {
        const clamped = Math.min(this.maxScale, Math.max(this.minScale, nextScale));

        if (!force && Math.abs(clamped - this.scale) < 0.0001) {
            return;
        }

        if (anchor) {
            this.adjustOffsetForZoom(clamped, anchor);
        }

        this.scale = clamped;
        this.root.style.setProperty('--map-scale', this.scale.toString());
        this.applyMapSize();
        this.applyOffset();
        this.territories.forEach((view) => this.positionTerritory(view));
        this.refreshConnections();
        this.updateTerritoryScaleStyles();
        this.updateZoomControls();
    }

    private adjustOffsetForZoom(nextScale: number, anchor: { x: number; y: number }) {
        const rect = this.viewport.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) {
            return;
        }

        const prevWidth = this.mapSize.width * this.scale;
        const prevHeight = this.mapSize.height * this.scale;
        const prevTopLeftX = rect.width / 2 - prevWidth / 2 + this.offset.x;
        const prevTopLeftY = rect.height / 2 - prevHeight / 2 + this.offset.y;

        const mapX = (anchor.x - prevTopLeftX) / this.scale;
        const mapY = (anchor.y - prevTopLeftY) / this.scale;

        const nextWidth = this.mapSize.width * nextScale;
        const nextHeight = this.mapSize.height * nextScale;
        const nextTopLeftX = anchor.x - mapX * nextScale;
        const nextTopLeftY = anchor.y - mapY * nextScale;

        this.offset = {
            x: nextTopLeftX - (rect.width / 2 - nextWidth / 2),
            y: nextTopLeftY - (rect.height / 2 - nextHeight / 2),
        };
    }

    private setMapSize(width: number, height: number) {
        const nextWidth = Math.max(width, MIN_MAP_WIDTH);
        const nextHeight = Math.max(height, MIN_MAP_HEIGHT);

        if (nextWidth === this.mapSize.width && nextHeight === this.mapSize.height) {
            return;
        }

        this.mapSize = { width: nextWidth, height: nextHeight };
        this.applyMapSize();
    }

    private bootstrapCoordinateSpace(territories: Territory[]) {
        if (territories.length === 0) {
            this.applyMapSize();
            return;
        }

        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;

        territories.forEach(({ position }) => {
            minX = Math.min(minX, position.x);
            minY = Math.min(minY, position.y);
            maxX = Math.max(maxX, position.x + HEX_WIDTH);
            maxY = Math.max(maxY, position.y + HEX_HEIGHT);
        });

        const offsetX = minX < MAP_PADDING ? MAP_PADDING - minX : 0;
        const offsetY = minY < MAP_PADDING ? MAP_PADDING - minY : 0;

        this.coordinateOffset = { x: offsetX, y: offsetY };

        const adjustedMaxX = maxX + offsetX;
        const adjustedMaxY = maxY + offsetY;

        this.setMapSize(adjustedMaxX + MAP_PADDING, adjustedMaxY + MAP_PADDING);
    }

    private ensureMapFitsTerritories() {
        if (this.territories.size === 0) {
            return;
        }

        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;

        this.territories.forEach((view) => {
            minX = Math.min(minX, view.data.position.x);
            minY = Math.min(minY, view.data.position.y);
            maxX = Math.max(maxX, view.data.position.x + HEX_WIDTH);
            maxY = Math.max(maxY, view.data.position.y + HEX_HEIGHT);
        });

        const shiftX = minX < MAP_PADDING ? MAP_PADDING - minX : 0;
        const shiftY = minY < MAP_PADDING ? MAP_PADDING - minY : 0;

        if (shiftX !== 0 || shiftY !== 0) {
            this.coordinateOffset.x += shiftX;
            this.coordinateOffset.y += shiftY;

            this.territories.forEach((view) => {
                view.data.position.x += shiftX;
                view.data.position.y += shiftY;
                this.positionTerritory(view);
            });

            maxX += shiftX;
            maxY += shiftY;
        }

        this.setMapSize(maxX + MAP_PADDING, maxY + MAP_PADDING);
    }

    private getDragBounds() {
        const minX = MAP_PADDING;
        const minY = MAP_PADDING;
        const maxX = Math.max(minX, this.mapSize.width - MAP_PADDING - HEX_WIDTH);
        const maxY = Math.max(minY, this.mapSize.height - MAP_PADDING - HEX_HEIGHT);

        return { minX, minY, maxX, maxY };
    }

    private clampTerritoryPosition(position: { x: number; y: number }) {
        const bounds = this.getDragBounds();
        position.x = Math.min(Math.max(position.x, bounds.minX), bounds.maxX);
        position.y = Math.min(Math.max(position.y, bounds.minY), bounds.maxY);
    }

    private createLegend(): HTMLDivElement {
        const legend = document.createElement('div');
        legend.className = 'expedition-map__legend';

        const bidirectional = document.createElement('div');
        bidirectional.className = 'expedition-map__legend-item';
        const bidirectionalLine = document.createElement('div');
        bidirectionalLine.className = 'expedition-map__legend-line';
        bidirectional.append(bidirectionalLine, document.createTextNode('Двусторонняя дорога'));

        const oneWay = document.createElement('div');
        oneWay.className = 'expedition-map__legend-item';
        const oneWayArrow = document.createElement('div');
        oneWayArrow.className = 'expedition-map__legend-arrow';
        oneWay.append(oneWayArrow, document.createTextNode('Односторонняя дорога'));

        legend.append(bidirectional, oneWay);
        return legend;
    }

    private createControls(): HTMLDivElement {
        const container = document.createElement('div');
        container.className = 'expedition-map__controls';

        const zoomIn = document.createElement('button');
        zoomIn.type = 'button';
        zoomIn.className = 'expedition-map__controls-button';
        zoomIn.textContent = '+';
        zoomIn.setAttribute('aria-label', 'Приблизить карту');
        zoomIn.addEventListener('pointerdown', (event) => event.stopPropagation());
        zoomIn.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            this.zoomIn();
        });

        const zoomOut = document.createElement('button');
        zoomOut.type = 'button';
        zoomOut.className = 'expedition-map__controls-button';
        zoomOut.textContent = '−';
        zoomOut.setAttribute('aria-label', 'Отдалить карту');
        zoomOut.addEventListener('pointerdown', (event) => event.stopPropagation());
        zoomOut.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            this.zoomOut();
        });

        const reset = document.createElement('button');
        reset.type = 'button';
        reset.className = 'expedition-map__controls-button';
        reset.textContent = '⟳';
        reset.setAttribute('aria-label', 'Сбросить масштаб и позицию');
        reset.addEventListener('pointerdown', (event) => event.stopPropagation());
        reset.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            this.resetView();
        });

        container.append(zoomIn, zoomOut, reset);
        this.zoomControls = { zoomIn, zoomOut, reset };

        return container;
    }

    private createTerritoryElement(territory: Territory): TerritoryElement {
        const wrapper = document.createElement('div') as TerritoryElement;
        wrapper.className = 'map-territory';
        wrapper.dataset.state = 'back';
        wrapper.style.setProperty('--x', `${territory.position.x * this.scale}px`);
        wrapper.style.setProperty('--y', `${territory.position.y * this.scale}px`);
        wrapper.style.setProperty('--description-lines', String(this.getDescriptionLineClamp()));
        wrapper.style.setProperty('--title-lines', String(this.getTitleLineClamp()));

        const inner = document.createElement('div');
        inner.className = 'map-territory__inner';

        const backFace = document.createElement('div');
        backFace.className = 'map-territory__face map-territory__face--back';
        backFace.textContent = territory.back.title;

        const frontFace = document.createElement('div');
        frontFace.className = 'map-territory__face map-territory__face--front';
        frontFace.style.backgroundImage = `url("${territory.front.image}")`;

        const overlay = document.createElement('div');
        overlay.className = 'map-territory__overlay';
        frontFace.appendChild(overlay);

        const textFrame = document.createElement('div');
        textFrame.className = 'map-territory__text-frame';

        const frontContent = document.createElement('div');
        frontContent.className = 'map-territory__front-content';

        const title = document.createElement('h3');
        title.className = 'map-territory__title';
        title.textContent = territory.front.title;

        const description = document.createElement('p');
        description.className = 'map-territory__description';
        description.textContent = territory.front.description;

        frontContent.append(title, description);
        textFrame.appendChild(frontContent);
        frontFace.appendChild(textFrame);

        inner.append(backFace, frontFace);
        wrapper.appendChild(inner);

        const characters = document.createElement('div');
        characters.className = 'map-territory__characters';
        wrapper.appendChild(characters);
        wrapper.__charactersContainer = characters;

        this.attachTerritoryInteractions(wrapper, territory);

        return wrapper;
    }

    private createCharacterContainer(element: TerritoryElement): HTMLDivElement {
        if (element.__charactersContainer) {
            return element.__charactersContainer;
        }

        const container = document.createElement('div');
        container.className = 'map-territory__characters';
        element.appendChild(container);
        element.__charactersContainer = container;
        return container;
    }

    private zoomIn(anchor?: { x: number; y: number }) {
        this.zoomByStep(1, anchor ?? this.getViewportCenter());
    }

    private zoomOut(anchor?: { x: number; y: number }) {
        this.zoomByStep(-1, anchor ?? this.getViewportCenter());
    }

    private resetView() {
        this.offset = { x: 0, y: 0 };
        this.setScale(1, undefined, true);
        this.offset = { x: 0, y: 0 };
        this.applyOffset();
        this.updateZoomControls();
    }

    private getViewportCenter(): { x: number; y: number } {
        const width = this.viewport.clientWidth || this.root.clientWidth || 0;
        const height = this.viewport.clientHeight || this.root.clientHeight || 0;
        return { x: width / 2, y: height / 2 };
    }

    private attachTerritoryInteractions(element: HTMLDivElement, territory: Territory) {
        let isDragging = false;
        let pointerId: number | null = null;
        let startX = 0;
        let startY = 0;
        let originX = 0;
        let originY = 0;
        let moved = false;

        const cleanup = () => {
            if (pointerId !== null) {
                element.releasePointerCapture(pointerId);
            }
            isDragging = false;
            pointerId = null;
            element.classList.remove('is-dragging');
        };

        const onPointerMove = (event: PointerEvent) => {
            if (pointerId === null || event.pointerId !== pointerId) {
                return;
            }

            const dxScreen = event.clientX - startX;
            const dyScreen = event.clientY - startY;
            const dx = dxScreen / this.scale;
            const dy = dyScreen / this.scale;

            if (isDragging) {
                moved = true;
                territory.position.x = originX + dx;
                territory.position.y = originY + dy;
                this.clampTerritoryPosition(territory.position);
                const view = this.territories.get(territory.id);
                if (view) {
                    this.positionTerritory(view);
                    this.refreshConnections();
                }
                return;
            }

            if (Math.abs(dxScreen) > MOVE_THRESHOLD || Math.abs(dyScreen) > MOVE_THRESHOLD) {
                isDragging = true;
                moved = true;
                element.classList.add('is-dragging');
            }
        };

        const onPointerUp = (event: PointerEvent) => {
            if (pointerId === null || event.pointerId !== pointerId) {
                return;
            }

            if (!isDragging && !moved) {
                this.toggleTerritory(territory.id);
            }

            cleanup();

            document.removeEventListener('pointermove', onPointerMove);
            document.removeEventListener('pointerup', onPointerUp);
            document.removeEventListener('pointercancel', onPointerUp);
        };

        element.addEventListener('pointerdown', (event) => {
            if (event.button !== 0) {
                return;
            }

            event.stopPropagation();
            event.preventDefault();

            pointerId = event.pointerId;
            startX = event.clientX;
            startY = event.clientY;
            originX = territory.position.x;
            originY = territory.position.y;
            moved = false;

            element.setPointerCapture(pointerId);

            document.addEventListener('pointermove', onPointerMove);
            document.addEventListener('pointerup', onPointerUp);
            document.addEventListener('pointercancel', onPointerUp);
        });
    }

    private toggleTerritory(id: string) {
        const view = this.territories.get(id);
        if (!view) {
            return;
        }

        view.isFlipped = !view.isFlipped;
        view.element.dataset.state = view.isFlipped ? 'front' : 'back';
    }

    private positionTerritory(view: TerritoryView) {
        const scaled = this.scalePoint(view.data.position);
        view.element.style.setProperty('--x', `${scaled.x}px`);
        view.element.style.setProperty('--y', `${scaled.y}px`);
    }

    private refreshConnections() {
        this.ensureMapFitsTerritories();

        while (this.connectionGroup.firstChild) {
            this.connectionGroup.removeChild(this.connectionGroup.firstChild);
        }

        const bidirectional = new Set<string>();

        this.territories.forEach((view) => {
            view.data.connections.forEach((connection) => {
                const target = this.territories.get(connection.targetId);
                if (!target) {
                    return;
                }

                const { start, end } = this.computeConnectionEndpoints(view, target);

                if (connection.type === 'two-way') {
                    const key = this.getBidirectionalKey(view.data.id, target.data.id);
                    if (bidirectional.has(key)) {
                        return;
                    }
                    bidirectional.add(key);

                    const line = this.createConnectionLine(start, end);
                    line.setAttribute('marker-start', 'url(#map-arrow-end)');
                    line.setAttribute('marker-end', 'url(#map-arrow-end)');
                    this.connectionGroup.appendChild(line);
                    return;
                }

                const line = this.createConnectionLine(start, end);
                line.setAttribute('marker-end', 'url(#map-arrow-end)');
                this.connectionGroup.appendChild(line);
            });
        });
    }

    private createConnectionLine(
        source: { x: number; y: number },
        target: { x: number; y: number },
    ): SVGLineElement {
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        const projectedSource = this.projectDomPointToSvg(source);
        const projectedTarget = this.projectDomPointToSvg(target);
        line.setAttribute('x1', String(projectedSource.x));
        line.setAttribute('y1', String(projectedSource.y));
        line.setAttribute('x2', String(projectedTarget.x));
        line.setAttribute('y2', String(projectedTarget.y));
        return line;
    }

    private projectDomPointToSvg(point: { x: number; y: number }) {
        const width = this.mapSize.width * this.scale;
        const height = this.mapSize.height * this.scale;

        return {
            x: point.x - width / 2,
            y: point.y - height / 2,
        };
    }

    private getTerritoryGeometry(view: TerritoryView) {
        const contentRect = this.content.getBoundingClientRect();
        const rect = view.element.getBoundingClientRect();

        const relative = {
            x: rect.left - contentRect.left,
            y: rect.top - contentRect.top,
            width: rect.width,
            height: rect.height,
        };

        const polygon = HEX_POLYGON_POINTS.map((point) => ({
            x: relative.x + (point.x / HEX_WIDTH) * relative.width,
            y: relative.y + (point.y / HEX_HEIGHT) * relative.height,
        }));

        const center = {
            x: relative.x + relative.width / 2,
            y: relative.y + relative.height / 2,
        };

        return { center, polygon };
    }

    private computeConnectionEndpoints(source: TerritoryView, target: TerritoryView) {
        const sourceGeometry = this.getTerritoryGeometry(source);
        const targetGeometry = this.getTerritoryGeometry(target);

        const direction = {
            x: targetGeometry.center.x - sourceGeometry.center.x,
            y: targetGeometry.center.y - sourceGeometry.center.y,
        };

        if (direction.x === 0 && direction.y === 0) {
            return { start: sourceGeometry.center, end: targetGeometry.center };
        }

        const start =
            this.findRayPolygonIntersection(sourceGeometry.center, direction, sourceGeometry.polygon) ||
            sourceGeometry.center;
        const end =
            this.findRayPolygonIntersection(targetGeometry.center, { x: -direction.x, y: -direction.y }, targetGeometry.polygon) ||
            targetGeometry.center;

        return { start, end };
    }

    private findRayPolygonIntersection(
        origin: { x: number; y: number },
        direction: { x: number; y: number },
        polygon: Array<{ x: number; y: number }>,
    ) {
        const normalizedDirection = this.normalizeVector(direction);
        if (!normalizedDirection) {
            return null;
        }

        let closestDistance = Infinity;
        let closestPoint: { x: number; y: number } | null = null;

        for (let i = 0; i < polygon.length; i += 1) {
            const current = polygon[i];
            const next = polygon[(i + 1) % polygon.length];
            const intersection = this.intersectRayWithSegment(origin, normalizedDirection, current, next);
            if (!intersection) {
                continue;
            }

            const distance = this.distanceBetweenPoints(origin, intersection);
            if (distance < closestDistance) {
                closestDistance = distance;
                closestPoint = intersection;
            }
        }

        return closestPoint;
    }

    private updateTerritoryScaleStyles() {
        const descriptionClamp = this.getDescriptionLineClamp();
        const titleClamp = this.getTitleLineClamp();

        this.territories.forEach((view) => {
            view.element.style.setProperty('--description-lines', String(descriptionClamp));
            view.element.style.setProperty('--title-lines', String(titleClamp));
        });
    }

    private updateZoomControls() {
        if (!this.zoomControls) {
            return;
        }

        const epsilon = 0.0001;
        this.zoomControls.zoomIn.disabled = this.scale >= this.maxScale - epsilon;
        this.zoomControls.zoomOut.disabled = this.scale <= this.minScale + epsilon;

        const isCentered =
            Math.abs(this.scale - 1) < epsilon && Math.abs(this.offset.x) < 0.5 && Math.abs(this.offset.y) < 0.5;
        this.zoomControls.reset.disabled = isCentered;
    }

    private getDescriptionLineClamp(): number {
        return Math.max(3, Math.round(3 + (this.scale - 1) * 3));
    }

    private getTitleLineClamp(): number {
        return Math.max(2, Math.round(2 + (this.scale - 1) * 2));
    }

    private scalePoint(point: { x: number; y: number }) {
        return {
            x: point.x * this.scale,
            y: point.y * this.scale,
        };
    }

    private intersectRayWithSegment(
        origin: { x: number; y: number },
        direction: { x: number; y: number },
        a: { x: number; y: number },
        b: { x: number; y: number },
    ) {
        const segment = { x: b.x - a.x, y: b.y - a.y };
        const v = { x: a.x - origin.x, y: a.y - origin.y };
        const cross = direction.x * segment.y - direction.y * segment.x;

        if (Math.abs(cross) < 1e-6) {
            return null;
        }

        const t = (v.x * segment.y - v.y * segment.x) / cross;
        const u = (v.x * direction.y - v.y * direction.x) / cross;

        if (t < 0 || u < 0 || u > 1) {
            return null;
        }

        return {
            x: origin.x + direction.x * t,
            y: origin.y + direction.y * t,
        };
    }

    private normalizeVector(vector: { x: number; y: number }) {
        const length = Math.hypot(vector.x, vector.y);
        if (length === 0) {
            return null;
        }

        return {
            x: vector.x / length,
            y: vector.y / length,
        };
    }

    private distanceBetweenPoints(a: { x: number; y: number }, b: { x: number; y: number }) {
        return Math.hypot(a.x - b.x, a.y - b.y);
    }

    private getBidirectionalKey(a: string, b: string) {
        return [a, b].sort().join('::');
    }
}
