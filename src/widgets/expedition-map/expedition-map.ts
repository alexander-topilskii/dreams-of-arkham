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

export type Territory = {
    id: string;
    back: TerritorySide & { title: string };
    front: TerritorySide & { title: string; description: string; image: string };
    position: { x: number; y: number };
    connections: TerritoryConnection[];
};

export type ExpeditionMapConfig = {
    territories: Territory[];
};

type TerritoryView = {
    data: Territory;
    element: HTMLDivElement;
    isFlipped: boolean;
};

const HEX_WIDTH = 156;
const HEX_HEIGHT = 180;
const MIN_MAP_WIDTH = 1600;
const MIN_MAP_HEIGHT = 1200;
const MAP_PADDING = 160;
const MOVE_THRESHOLD = 6;

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
    width: ${HEX_WIDTH}px;
    height: ${HEX_HEIGHT}px;
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
    justify-content: flex-end;
    align-items: stretch;
    padding: 16px;
    border-radius: 20px;
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
    border-radius: 20px;
    position: absolute;
    inset: 0;
    pointer-events: none;
}

.map-territory__front-content {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-top: auto;
}

.map-territory__title {
    font-size: 16px;
    font-weight: 700;
    text-transform: none;
    margin: 0;
}

.map-territory__description {
    font-size: 12px;
    line-height: 1.4;
    opacity: 0.85;
    margin: 0;
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
    private mapSize = { width: MIN_MAP_WIDTH, height: MIN_MAP_HEIGHT };
    private coordinateOffset = { x: 0, y: 0 };
    private offset = { x: 0, y: 0 };

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
        this.root.appendChild(this.viewport);
        this.root.appendChild(this.createLegend());
        root.appendChild(this.root);

        this.initializePan();

        const territories = config.territories.map((territory) => cloneTerritory(territory));
        this.bootstrapCoordinateSpace(territories);

        territories.forEach((territory) => {
            this.addTerritory(territory);
        });

        this.refreshConnections();
    }

    public addTerritory(territory: Territory): void {
        if (this.territories.has(territory.id)) {
            console.warn(`Territory with id "${territory.id}" already exists.`);
            return;
        }

        territory.position.x += this.coordinateOffset.x;
        territory.position.y += this.coordinateOffset.y;

        const element = this.createTerritoryElement(territory);
        this.territoryLayer.appendChild(element);

        const view: TerritoryView = {
            data: territory,
            element,
            isFlipped: false,
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
        this.refreshConnections();
    }

    public getTerritoryIds(): string[] {
        return Array.from(this.territories.keys());
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

    private applyOffset() {
        this.content.style.transform = `translate3d(calc(-50% + ${this.offset.x}px), calc(-50% + ${this.offset.y}px), 0)`;
    }

    private applyMapSize() {
        if (!this.content || !this.connectionsLayer) {
            return;
        }

        this.content.style.width = `${this.mapSize.width}px`;
        this.content.style.height = `${this.mapSize.height}px`;
        this.connectionsLayer.setAttribute(
            'viewBox',
            `${-this.mapSize.width / 2} ${-this.mapSize.height / 2} ${this.mapSize.width} ${this.mapSize.height}`,
        );
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

    private createTerritoryElement(territory: Territory): HTMLDivElement {
        const wrapper = document.createElement('div');
        wrapper.className = 'map-territory';
        wrapper.dataset.state = 'back';
        wrapper.style.setProperty('--x', `${territory.position.x}px`);
        wrapper.style.setProperty('--y', `${territory.position.y}px`);

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

        const frontContent = document.createElement('div');
        frontContent.className = 'map-territory__front-content';

        const title = document.createElement('h3');
        title.className = 'map-territory__title';
        title.textContent = territory.front.title;

        const description = document.createElement('p');
        description.className = 'map-territory__description';
        description.textContent = territory.front.description;

        frontContent.append(title, description);
        frontFace.appendChild(frontContent);

        inner.append(backFace, frontFace);
        wrapper.appendChild(inner);

        this.attachTerritoryInteractions(wrapper, territory);

        return wrapper;
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

            const dx = event.clientX - startX;
            const dy = event.clientY - startY;

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

            if (Math.abs(dx) > MOVE_THRESHOLD || Math.abs(dy) > MOVE_THRESHOLD) {
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
        view.element.style.setProperty('--x', `${view.data.position.x}px`);
        view.element.style.setProperty('--y', `${view.data.position.y}px`);
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

                const { start, end } = this.computeConnectionEndpoints(view.data.position, target.data.position);

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
        const projectedSource = this.projectPointToSvg(source);
        const projectedTarget = this.projectPointToSvg(target);
        line.setAttribute('x1', String(projectedSource.x));
        line.setAttribute('y1', String(projectedSource.y));
        line.setAttribute('x2', String(projectedTarget.x));
        line.setAttribute('y2', String(projectedTarget.y));
        return line;
    }

    private projectPointToSvg(point: { x: number; y: number }) {
        return {
            x: point.x - this.mapSize.width / 2,
            y: point.y - this.mapSize.height / 2,
        };
    }

    private computeTerritoryCenter(position: { x: number; y: number }) {
        return {
            x: position.x + HEX_WIDTH / 2,
            y: position.y + HEX_HEIGHT / 2,
        };
    }

    private computeConnectionEndpoints(
        sourcePosition: { x: number; y: number },
        targetPosition: { x: number; y: number },
    ) {
        const sourceCenter = this.computeTerritoryCenter(sourcePosition);
        const targetCenter = this.computeTerritoryCenter(targetPosition);

        const direction = {
            x: targetCenter.x - sourceCenter.x,
            y: targetCenter.y - sourceCenter.y,
        };

        if (direction.x === 0 && direction.y === 0) {
            return { start: sourceCenter, end: targetCenter };
        }

        const start =
            this.findRayPolygonIntersection(sourceCenter, direction, this.computeTerritoryPolygon(sourcePosition)) ||
            sourceCenter;
        const end =
            this.findRayPolygonIntersection(targetCenter, { x: -direction.x, y: -direction.y }, this.computeTerritoryPolygon(targetPosition)) ||
            targetCenter;

        return { start, end };
    }

    private computeTerritoryPolygon(position: { x: number; y: number }) {
        return HEX_POLYGON_POINTS.map((point) => ({
            x: position.x + point.x,
            y: position.y + point.y,
        }));
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
