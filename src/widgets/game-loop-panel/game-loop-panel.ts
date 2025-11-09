export interface GamePhase {
    /** Заголовок фазы */
    title: string;
    /** Краткое описание фазы */
    description: string;
    /** Путь до иллюстрации (может быть пустым) */
    image?: string;
    /**
     * Пользовательское условие завершения фазы.
     * Если возвращает true — фаза считается выполненной независимо от таймера.
     */
    condition?: () => boolean;
    /** Дополнительное описание требования для отображения в статусе */
    statusLabel?: string;
    /** Текущий прогресс, отображаемый рядом со статусом */
    statusValue?: () => string;
}

interface TimelineState {
    phases: GamePhase[];
    currentIndex: number;
    isComplete: boolean;
    elements: TimelineElements;
}

interface TimelineElements {
    container: HTMLDivElement;
    accent: HTMLDivElement;
    title: HTMLHeadingElement;
    phaseTitle: HTMLHeadingElement;
    phaseDescription: HTMLParagraphElement;
    phaseImage: HTMLImageElement;
    counter: HTMLDivElement;
    status: HTMLDivElement;
    statusLabel: HTMLDivElement;
}

export interface GameLoopConfig {
    victoryPhases: GamePhase[];
    defeatPhases: GamePhase[];
}

const STYLE_ID = "game-loop-panel-style";

function ensureStylesMounted() {
    if (document.getElementById(STYLE_ID)) {
        return;
    }

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
        .game-loop-panel {
            display: flex;
            flex-direction: column;
            gap: 12px;
            width: 100%;
        }

        .game-loop-timeline {
            display: flex;
            gap: 12px;
            padding: 12px;
            border-radius: 12px;
            background: rgba(16, 16, 24, 0.85);
            border: 1px solid rgba(255, 255, 255, 0.08);
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
            backdrop-filter: blur(8px);
            position: relative;
            overflow: hidden;
        }

        .game-loop-timeline__accent {
            position: absolute;
            inset: 0;
            opacity: 0.18;
            pointer-events: none;
            background: linear-gradient(135deg, rgba(41, 121, 255, 0.6), rgba(144, 202, 249, 0.05));
        }

        .game-loop-timeline[data-kind="defeat"] .game-loop-timeline__accent {
            background: linear-gradient(135deg, rgba(239, 68, 68, 0.55), rgba(248, 113, 113, 0.05));
        }

        .game-loop-timeline__body {
            position: relative;
            display: grid;
            grid-template-columns: auto 1fr;
            gap: 12px;
            width: 100%;
            align-items: start;
        }

        .game-loop-timeline__media {
            width: 80px;
            height: 80px;
            border-radius: 10px;
            object-fit: cover;
            border: 1px solid rgba(255, 255, 255, 0.1);
            background: rgba(0, 0, 0, 0.25);
        }

        .game-loop-timeline__media[hidden] {
            display: none;
        }

        .game-loop-timeline__content {
            display: flex;
            flex-direction: column;
            gap: 8px;
            min-width: 0;
        }

        .game-loop-timeline__title {
            font-size: 0.75rem;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            color: rgba(255, 255, 255, 0.6);
        }

        .game-loop-timeline__phase-title {
            font-size: 1.1rem;
            margin: 0;
        }

        .game-loop-timeline__description {
            margin: 0;
            color: rgba(255, 255, 255, 0.7);
            font-size: 0.95rem;
            line-height: 1.45;
        }

        .game-loop-timeline__status {
            display: grid;
            grid-template-columns: 1fr auto;
            align-items: center;
            gap: 8px;
            font-size: 0.85rem;
            color: rgba(255, 255, 255, 0.65);
        }

        .game-loop-timeline__status-label {
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        .game-loop-timeline__counter {
            font-variant-numeric: tabular-nums;
            font-weight: 600;
            color: #fff;
        }

        .game-loop-timeline[data-complete="true"] {
            opacity: 0.7;
        }

        .game-loop-timeline[data-complete="true"] .game-loop-timeline__counter {
            color: rgba(255, 255, 255, 0.7);
        }
    `;

    document.head.appendChild(style);
}

export class GameLoopPanel {
    private container: HTMLDivElement;
    private victoryTimeline: TimelineState;
    private defeatTimeline: TimelineState;

    constructor(private readonly host: HTMLElement | null, private readonly config: GameLoopConfig) {
        if (!host) {
            throw new Error("GameLoopPanel: host element is not available");
        }

        ensureStylesMounted();

        this.container = document.createElement("div");
        this.container.className = "game-loop-panel";

        this.victoryTimeline = this.createTimeline("Путь к победе", config.victoryPhases, "victory");
        this.defeatTimeline = this.createTimeline("Через шаг от поражения", config.defeatPhases, "defeat");

        this.container.append(this.victoryTimeline.elements.container, this.defeatTimeline.elements.container);

        this.host.innerHTML = "";
        this.host.appendChild(this.container);

        this.renderTimeline(this.victoryTimeline);
        this.renderTimeline(this.defeatTimeline);
    }

    destroy() {
        this.host?.removeChild(this.container);
    }

    private createTimeline(title: string, phases: GamePhase[], kind: "victory" | "defeat"): TimelineState {
        const container = document.createElement("div");
        container.className = "game-loop-timeline";
        container.dataset.kind = kind;

        const accent = document.createElement("div");
        accent.className = "game-loop-timeline__accent";

        const body = document.createElement("div");
        body.className = "game-loop-timeline__body";

        const image = document.createElement("img");
        image.className = "game-loop-timeline__media";

        const content = document.createElement("div");
        content.className = "game-loop-timeline__content";

        const header = document.createElement("div");
        header.className = "game-loop-timeline__title";
        header.textContent = title;

        const phaseTitle = document.createElement("h3");
        phaseTitle.className = "game-loop-timeline__phase-title";

        const phaseDescription = document.createElement("p");
        phaseDescription.className = "game-loop-timeline__description";

        const status = document.createElement("div");
        status.className = "game-loop-timeline__status";

        const statusLabel = document.createElement("div");
        statusLabel.className = "game-loop-timeline__status-label";

        const counter = document.createElement("div");
        counter.className = "game-loop-timeline__counter";

        status.append(statusLabel, counter);
        content.append(header, phaseTitle, phaseDescription, status);
        body.append(image, content);
        container.append(accent, body);

        return {
            phases,
            currentIndex: 0,
            isComplete: phases.length === 0,
            elements: {
                container,
                accent,
                title: header,
                phaseTitle,
                phaseDescription,
                phaseImage: image,
                counter,
                status,
                statusLabel,
            },
        };
    }

    private renderTimeline(timeline: TimelineState) {
        if (timeline.isComplete) {
            this.markComplete(timeline);
            return;
        }

        const phase = timeline.phases[timeline.currentIndex];
        const {phaseTitle, phaseDescription, phaseImage, counter, statusLabel} = timeline.elements;

        phaseTitle.textContent = phase.title;
        phaseDescription.textContent = phase.description;

        if (phase.image) {
            phaseImage.src = phase.image;
            phaseImage.alt = phase.title;
            phaseImage.hidden = false;
        } else {
            phaseImage.hidden = true;
        }

        const statusText = phase.statusLabel
            ? `Фаза ${timeline.currentIndex + 1} из ${timeline.phases.length} · ${phase.statusLabel}`
            : `Фаза ${timeline.currentIndex + 1} из ${timeline.phases.length}`;

        statusLabel.textContent = statusText;
        counter.textContent = phase.statusValue?.() ?? "В процессе";
    }

    evaluate() {
        this.evaluateTimeline(this.victoryTimeline);
        this.evaluateTimeline(this.defeatTimeline);
    }

    private evaluateTimeline(timeline: TimelineState) {
        if (timeline.isComplete) {
            return;
        }

        const phase = timeline.phases[timeline.currentIndex];

        if (!phase) {
            this.markComplete(timeline);
            return;
        }

        this.refreshStatus(timeline, phase);

        if (phase.condition?.()) {
            this.advanceTimeline(timeline);
            this.evaluateTimeline(timeline);
        }
    }

    private refreshStatus(timeline: TimelineState, phase: GamePhase) {
        const {statusLabel, counter} = timeline.elements;
        const baseText = `Фаза ${timeline.currentIndex + 1} из ${timeline.phases.length}`;
        statusLabel.textContent = phase.statusLabel ? `${baseText} · ${phase.statusLabel}` : baseText;
        counter.textContent = phase.statusValue?.() ?? "В процессе";
    }

    private advanceTimeline(timeline: TimelineState) {
        timeline.currentIndex += 1;

        if (timeline.currentIndex >= timeline.phases.length) {
            timeline.isComplete = true;
            this.markComplete(timeline);
            return;
        }

        this.renderTimeline(timeline);
    }

    private markComplete(timeline: TimelineState) {
        timeline.elements.container.dataset.complete = "true";
        timeline.elements.counter.textContent = "Завершено";

        const completionText = timeline.phases.length > 0
            ? timeline === this.victoryTimeline
                ? "Цепочка победы достигнута"
                : "Поражение неизбежно"
            : "Нет активных фаз";

        timeline.elements.statusLabel.textContent = completionText;
    }
}
