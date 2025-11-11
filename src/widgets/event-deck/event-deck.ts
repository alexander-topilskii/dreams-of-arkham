export interface EventDeckCardConfig {
    id: string;
    title: string;
    summary: string;
    impact: string;
    flavor?: string;
}

export interface EventDeckConfig {
    draw: {
        min: number;
        max: number;
    };
    cards: EventDeckCardConfig[];
}

const STYLE_ID = 'event-deck-styles';

function ensureStylesMounted() {
    if (document.getElementById(STYLE_ID)) {
        return;
    }

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
        .event-deck {
            display: flex;
            flex-direction: column;
            gap: 16px;
            padding: 16px;
            border-radius: 16px;
            background: rgba(15, 23, 42, 0.82);
            border: 1px solid rgba(148, 163, 184, 0.18);
            box-shadow: 0 16px 40px rgba(15, 23, 42, 0.35);
            color: #e2e8f0;
            width: 100%;
            height: 100%;
            min-height: 0;
        }

        .event-deck__header {
            display: flex;
            flex-direction: column;
            gap: 6px;
            text-align: left;
        }

        .event-deck__title {
            margin: 0;
            font-size: 0.85rem;
            letter-spacing: 0.1em;
            text-transform: uppercase;
            color: rgba(226, 232, 240, 0.75);
        }

        .event-deck__status {
            font-size: 0.8rem;
            color: rgba(226, 232, 240, 0.82);
            min-height: 1.25em;
        }

        .event-deck__body {
            display: flex;
            gap: 16px;
            min-height: 0;
            align-items: flex-start;
        }

        .event-deck__pile {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 10px;
            flex-shrink: 0;
        }

        .event-deck__pile-label {
            font-size: 0.75rem;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            color: rgba(148, 163, 184, 0.9);
        }

        .event-deck__stack {
            position: relative;
            width: 120px;
            height: 168px;
        }

        .event-deck__back {
            position: absolute;
            inset: 0;
            border-radius: 14px;
            background: linear-gradient(135deg, rgba(59, 130, 246, 0.85), rgba(14, 116, 144, 0.85));
            border: 1px solid rgba(148, 163, 184, 0.45);
            box-shadow: 0 8px 18px rgba(15, 23, 42, 0.45);
            transform-origin: center;
        }

        .event-deck__back:nth-child(1) { transform: translate(0, 0); }
        .event-deck__back:nth-child(2) { transform: translate(4px, -4px); }
        .event-deck__back:nth-child(3) { transform: translate(8px, -8px); }

        .event-deck__stack[data-empty='true'] .event-deck__back {
            opacity: 0;
        }

        .event-deck__stack-placeholder {
            position: absolute;
            inset: 0;
            display: grid;
            place-items: center;
            border-radius: 14px;
            border: 1px dashed rgba(148, 163, 184, 0.35);
            color: rgba(148, 163, 184, 0.65);
            font-size: 0.75rem;
            background: rgba(15, 23, 42, 0.4);
            transition: opacity 120ms ease;
            opacity: 0;
        }

        .event-deck__stack[data-empty='true'] .event-deck__stack-placeholder {
            opacity: 1;
        }

        .event-deck__counter {
            font-size: 0.85rem;
            color: rgba(226, 232, 240, 0.75);
        }

        .event-deck__revealed {
            display: flex;
            flex-direction: column;
            gap: 10px;
            flex: 1;
            min-height: 0;
        }

        .event-deck__section-title {
            display: flex;
            justify-content: space-between;
            align-items: baseline;
            font-size: 0.8rem;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            color: rgba(148, 163, 184, 0.85);
        }

        .event-deck__revealed-scroll {
            flex: 1;
            min-height: 0;
            overflow-y: auto;
            display: flex;
            flex-direction: column;
            gap: 12px;
            padding-right: 4px;
        }

        .event-deck__placeholder {
            font-size: 0.85rem;
            color: rgba(148, 163, 184, 0.7);
        }

        .event-card {
            display: flex;
            flex-direction: column;
            gap: 8px;
            padding: 12px 14px;
            border-radius: 14px;
            background: linear-gradient(135deg, rgba(30, 41, 59, 0.92), rgba(15, 23, 42, 0.92));
            border: 1px solid rgba(94, 234, 212, 0.2);
            border-left: 4px solid rgba(94, 234, 212, 0.55);
            box-shadow: 0 8px 24px rgba(15, 23, 42, 0.4);
            cursor: pointer;
            transition: transform 120ms ease, border-color 120ms ease, box-shadow 120ms ease;
            text-align: left;
        }

        .event-card:hover {
            transform: translateX(2px);
            border-color: rgba(94, 234, 212, 0.45);
            box-shadow: 0 10px 28px rgba(15, 23, 42, 0.5);
        }

        .event-card__title {
            margin: 0;
            font-size: 1rem;
            color: #f8fafc;
        }

        .event-card__summary,
        .event-card__impact,
        .event-card__flavor {
            margin: 0;
            font-size: 0.85rem;
            color: rgba(226, 232, 240, 0.8);
            line-height: 1.45;
        }

        .event-card__impact {
            font-weight: 600;
            color: rgba(129, 140, 248, 0.95);
        }

        .event-card__flavor {
            font-style: italic;
            color: rgba(148, 163, 184, 0.8);
        }

        .event-deck__discard {
            display: flex;
            flex-direction: column;
            gap: 8px;
            min-height: 96px;
        }

        .event-deck__discard-grid {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            align-content: flex-start;
        }

        .event-deck__discard-card {
            padding: 8px 10px;
            border-radius: 10px;
            border: 1px solid rgba(148, 163, 184, 0.25);
            background: rgba(30, 41, 59, 0.65);
            color: rgba(226, 232, 240, 0.85);
            font-size: 0.75rem;
        }

        .event-deck__empty-note {
            font-size: 0.8rem;
            color: rgba(148, 163, 184, 0.7);
        }

        .event-deck__status[data-variant='warn'] {
            color: rgba(248, 113, 113, 0.85);
        }

        .event-deck__status[data-variant='success'] {
            color: rgba(94, 234, 212, 0.85);
        }
    `;

    document.head.appendChild(style);
}

function shuffle<T>(items: T[]): T[] {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
}

function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}

export class EventDeck {
    private readonly root: HTMLDivElement;

    private readonly stack: HTMLDivElement;

    private readonly stackPlaceholder: HTMLDivElement;

    private readonly deckCounter: HTMLDivElement;

    private readonly revealedList: HTMLDivElement;

    private readonly revealedPlaceholder: HTMLDivElement;

    private readonly revealedHeader: HTMLDivElement;

    private readonly discardGrid: HTMLDivElement;

    private readonly discardPlaceholder: HTMLDivElement;

    private readonly discardHeader: HTMLDivElement;

    private readonly status: HTMLDivElement;

    private readonly config: EventDeckConfig;

    private deck: EventDeckCardConfig[];

    private revealed: EventDeckCardConfig[] = [];

    private discard: EventDeckCardConfig[] = [];

    constructor(container: HTMLElement | null, config: EventDeckConfig) {
        if (!container) {
            throw new Error('EventDeck: container not found');
        }

        ensureStylesMounted();

        this.config = normalizeConfig(config);
        this.deck = shuffle(this.config.cards);

        this.root = document.createElement('div');
        this.root.className = 'event-deck';

        const header = document.createElement('div');
        header.className = 'event-deck__header';

        const title = document.createElement('h2');
        title.className = 'event-deck__title';
        title.textContent = 'Колода событий';

        this.status = document.createElement('div');
        this.status.className = 'event-deck__status';
        this.status.textContent = 'Готово к вызову событий.';

        header.append(title, this.status);

        const body = document.createElement('div');
        body.className = 'event-deck__body';

        const pile = document.createElement('div');
        pile.className = 'event-deck__pile';

        const pileLabel = document.createElement('div');
        pileLabel.className = 'event-deck__pile-label';
        pileLabel.textContent = 'Стопка';

        this.stack = document.createElement('div');
        this.stack.className = 'event-deck__stack';

        for (let i = 0; i < 3; i += 1) {
            const back = document.createElement('div');
            back.className = 'event-deck__back';
            this.stack.appendChild(back);
        }

        this.stackPlaceholder = document.createElement('div');
        this.stackPlaceholder.className = 'event-deck__stack-placeholder';
        this.stackPlaceholder.textContent = 'Пусто';
        this.stack.appendChild(this.stackPlaceholder);

        this.deckCounter = document.createElement('div');
        this.deckCounter.className = 'event-deck__counter';

        pile.append(pileLabel, this.stack, this.deckCounter);

        const revealed = document.createElement('div');
        revealed.className = 'event-deck__revealed';

        this.revealedHeader = document.createElement('div');
        this.revealedHeader.className = 'event-deck__section-title';
        this.revealedHeader.textContent = 'Активные события (0)';

        this.revealedList = document.createElement('div');
        this.revealedList.className = 'event-deck__revealed-scroll';

        this.revealedPlaceholder = document.createElement('div');
        this.revealedPlaceholder.className = 'event-deck__placeholder';
        this.revealedPlaceholder.textContent = 'Сейчас нет активных событий. Нажмите кнопку отладки, чтобы вызвать новое событие.';
        this.revealedList.appendChild(this.revealedPlaceholder);

        revealed.append(this.revealedHeader, this.revealedList);

        body.append(pile, revealed);

        const discardSection = document.createElement('div');
        discardSection.className = 'event-deck__discard';

        this.discardHeader = document.createElement('div');
        this.discardHeader.className = 'event-deck__section-title';
        this.discardHeader.textContent = 'Сброс (0)';

        this.discardGrid = document.createElement('div');
        this.discardGrid.className = 'event-deck__discard-grid';

        this.discardPlaceholder = document.createElement('div');
        this.discardPlaceholder.className = 'event-deck__empty-note';
        this.discardPlaceholder.textContent = 'Сброс пуст.';
        this.discardGrid.appendChild(this.discardPlaceholder);

        discardSection.append(this.discardHeader, this.discardGrid);

        this.root.append(header, body, discardSection);
        container.appendChild(this.root);

        this.updateDeckVisual();
    }

    triggerEvent() {
        const { min, max } = this.config.draw;
        const drawMin = Math.max(0, Math.floor(min));
        const drawMax = Math.max(drawMin, Math.floor(max));
        const range = drawMax - drawMin + 1;
        const drawCount = drawMin + Math.floor(Math.random() * range);

        if (drawCount === 0) {
            this.setStatus('Судьба молчит, новых событий нет.', 'warn');
            return;
        }

        const actual = this.drawCards(drawCount);

        if (actual.length === 0) {
            if (this.discard.length > 0) {
                this.setStatus('Колода пуста. Перемешайте сброс, чтобы продолжить.', 'warn');
            } else {
                this.setStatus('Колода иссякла — новых событий не осталось.', 'warn');
            }
            return;
        }

        this.setStatus(`Открыто новых событий: ${actual.length}.`, 'success');
    }

    reshuffleDiscard() {
        if (this.discard.length === 0) {
            this.setStatus('Сброс пуст — нечего перемешивать.', 'warn');
            return;
        }

        const recycled = shuffle(this.discard);
        this.deck = [...this.deck, ...recycled];
        this.discard = [];

        this.updateDeckVisual();
        this.updateDiscard();
        this.setStatus('Карты из сброса возвращены в стопку.', 'success');
    }

    private drawCards(count: number): EventDeckCardConfig[] {
        const actualCount = clamp(count, 0, this.deck.length);
        const cards = this.deck.splice(0, actualCount);

        if (cards.length === 0) {
            this.updateDeckVisual();
            return cards;
        }

        cards.forEach((card) => {
            this.revealed.push(card);
            this.addRevealedCard(card);
        });

        this.updateDeckVisual();
        this.updateRevealedHeader();
        return cards;
    }

    private addRevealedCard(card: EventDeckCardConfig) {
        if (this.revealedPlaceholder.parentElement) {
            this.revealedPlaceholder.remove();
        }

        const cardElement = document.createElement('article');
        cardElement.className = 'event-card';
        cardElement.dataset.cardId = card.id;

        const title = document.createElement('h3');
        title.className = 'event-card__title';
        title.textContent = card.title;

        const summary = document.createElement('p');
        summary.className = 'event-card__summary';
        summary.textContent = card.summary;

        const impact = document.createElement('p');
        impact.className = 'event-card__impact';
        impact.textContent = card.impact;

        cardElement.append(title, summary, impact);

        if (card.flavor) {
            const flavor = document.createElement('p');
            flavor.className = 'event-card__flavor';
            flavor.textContent = card.flavor;
            cardElement.appendChild(flavor);
        }

        cardElement.addEventListener('click', () => {
            this.sendToDiscard(card.id);
        });

        this.revealedList.appendChild(cardElement);
    }

    private sendToDiscard(cardId: string) {
        const index = this.revealed.findIndex((item) => item.id === cardId);
        if (index === -1) {
            return;
        }

        const [card] = this.revealed.splice(index, 1);

        const element = this.revealedList.querySelector<HTMLElement>(`[data-card-id="${cardId}"]`);
        if (element) {
            element.remove();
        }

        this.updateRevealedPlaceholder();
        this.updateRevealedHeader();

        this.discard.push(card);
        this.updateDiscard();
        this.setStatus(`Событие «${card.title}» отправлено в сброс.`, undefined);
    }

    private updateDeckVisual() {
        if (this.deck.length === 0) {
            this.stack.dataset.empty = 'true';
        } else {
            this.stack.dataset.empty = 'false';
        }

        this.deckCounter.textContent = `${this.deck.length} карт`;
    }

    private updateRevealedPlaceholder() {
        if (this.revealed.length === 0 && !this.revealedList.contains(this.revealedPlaceholder)) {
            this.revealedList.appendChild(this.revealedPlaceholder);
        }
    }

    private updateRevealedHeader() {
        this.revealedHeader.textContent = `Активные события (${this.revealed.length})`;
        if (this.revealed.length === 0) {
            this.updateRevealedPlaceholder();
        }
    }

    private updateDiscard() {
        this.discardHeader.textContent = `Сброс (${this.discard.length})`;

        if (this.discard.length === 0) {
            if (!this.discardGrid.contains(this.discardPlaceholder)) {
                this.discardGrid.appendChild(this.discardPlaceholder);
            }
            return;
        }

        this.discardGrid.innerHTML = '';
        this.discard.forEach((card) => {
            const chip = document.createElement('div');
            chip.className = 'event-deck__discard-card';
            chip.textContent = card.title;
            this.discardGrid.appendChild(chip);
        });
    }

    private setStatus(message: string, variant?: 'warn' | 'success') {
        this.status.textContent = message;
        if (variant) {
            this.status.dataset.variant = variant;
        } else {
            delete this.status.dataset.variant;
        }
    }
}

function normalizeConfig(config: EventDeckConfig): EventDeckConfig {
    const safeMin = Number.isFinite(config.draw.min) ? config.draw.min : 0;
    const safeMax = Number.isFinite(config.draw.max) ? config.draw.max : safeMin;
    return {
        draw: {
            min: safeMin,
            max: safeMax,
        },
        cards: config.cards.map((card) => ({
            ...card,
        })),
    };
}
