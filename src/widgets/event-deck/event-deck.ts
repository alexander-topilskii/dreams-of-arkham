export type EventDeckCardType = 'enemy' | string;

export interface EventDeckCardConfig {
    id: string;
    title: string;
    summary: string;
    impact?: string;
    flavor?: string;
    type?: EventDeckCardType;
    enter?: 'random' | string;
    instanceId?: string;
    inPlay?: boolean;
    linkedCharacterId?: string;
    locationId?: string;
    locationTitle?: string;
}

export interface EventDeckConfig {
    draw: {
        min: number;
        max: number;
    };
    cards: EventDeckCardConfig[];
}

export type EventDeckStatusVariant = 'warn' | 'success';

export type EventDeckStatus = {
    message: string;
    variant?: EventDeckStatusVariant;
};

export type EventDeckSnapshot = {
    drawPile: readonly EventDeckCardConfig[];
    revealed: readonly EventDeckCardConfig[];
    discardPile: readonly EventDeckCardConfig[];
    status?: EventDeckStatus;
};

export type EventDeckIntentHandlers = {
    onTrigger?: () => void;
    onReveal?: (count: number) => void;
    onDiscard?: (cardInstanceId: string) => void;
};

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
            overflow: hidden;
            position: relative;
        }

        .event-deck__header {
            display: flex;
            flex-direction: column;
            gap: 12px;
            text-align: left;
        }

        .event-deck__title-row {
            display: flex;
            align-items: center;
            gap: 12px;
            flex-wrap: wrap;
        }

        .event-deck__title {
            margin: 0;
            font-size: 0.85rem;
            letter-spacing: 0.1em;
            text-transform: uppercase;
            color: rgba(226, 232, 240, 0.75);
        }

        .event-deck__chips {
            margin-left: auto;
            display: inline-flex;
            align-items: center;
            gap: 8px;
            flex-wrap: wrap;
        }

        .event-deck__chip {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 4px 10px;
            border-radius: 999px;
            border: 1px solid rgba(148, 163, 184, 0.35);
            background: rgba(30, 41, 59, 0.6);
            font-size: 0.75rem;
            color: rgba(226, 232, 240, 0.85);
            transition: opacity 160ms ease;
        }

        .event-deck__chip-label {
            font-weight: 500;
            letter-spacing: 0.02em;
        }

        .event-deck__chip-value {
            font-weight: 600;
            color: #f8fafc;
        }

        .event-deck__chip--deck {
            background: rgba(30, 64, 175, 0.45);
            border-color: rgba(129, 161, 193, 0.4);
        }

        .event-deck__chip--discard {
            background: rgba(94, 51, 73, 0.55);
            border-color: rgba(244, 114, 182, 0.35);
        }

        .event-deck__chip--empty {
            opacity: 0.65;
        }

        .event-deck__section-title {
            font-size: 0.8rem;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            color: rgba(148, 163, 184, 0.85);
        }

        .event-deck__content {
            flex: 1;
            min-height: 0;
            overflow-y: auto;
            display: flex;
            flex-direction: column;
            gap: 12px;
            padding-right: 6px;
            scrollbar-gutter: stable;
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
            text-align: left;
            position: relative;
        }

        .event-card[data-state='in-play'] {
            border-color: rgba(248, 113, 113, 0.65);
            border-left-color: rgba(248, 113, 113, 0.85);
            box-shadow: 0 10px 28px rgba(127, 29, 29, 0.45);
        }

        .event-card__header {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 10px;
        }

        .event-card__badges {
            display: flex;
            flex-wrap: wrap;
            gap: 6px;
        }

        .event-card__badge {
            border-radius: 999px;
            padding: 2px 8px;
            font-size: 0.65rem;
            letter-spacing: 0.08em;
            text-transform: uppercase;
            background: rgba(148, 163, 184, 0.22);
            color: rgba(226, 232, 240, 0.86);
            white-space: nowrap;
        }

        .event-card__badge[data-variant='enemy'] {
            background: rgba(220, 38, 38, 0.32);
            color: rgba(254, 226, 226, 0.95);
        }

        .event-card__badge[data-variant='state'] {
            background: rgba(248, 113, 113, 0.28);
            color: rgba(254, 226, 226, 0.95);
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

        .event-card__meta {
            margin: 0;
            font-size: 0.75rem;
            color: rgba(148, 163, 184, 0.78);
            letter-spacing: 0.02em;
        }

        .event-deck__status-live {
            position: absolute;
            width: 1px;
            height: 1px;
            padding: 0;
            margin: -1px;
            border: 0;
            clip: rect(0 0 0 0);
            clip-path: inset(50%);
            overflow: hidden;
            white-space: nowrap;
        }
    `;

    document.head.appendChild(style);
}

type ChipElements = {
    element: HTMLDivElement;
    value: HTMLSpanElement;
};

export class EventDeck {
    private readonly root: HTMLDivElement;

    private readonly chipsContainer: HTMLDivElement;

    private readonly deckChip: ChipElements;

    private readonly discardChip: ChipElements;

    private readonly revealedHeader: HTMLDivElement;

    private readonly revealedList: HTMLDivElement;

    private readonly revealedPlaceholder: HTMLDivElement;

    private readonly liveRegion: HTMLDivElement;

    private deck: EventDeckCardConfig[] = [];

    private revealed: EventDeckCardConfig[] = [];

    private discard: EventDeckCardConfig[] = [];

    private readonly defaultStatus = 'Колода событий готова.';

    private intentHandlers: EventDeckIntentHandlers = {};

    constructor(container: HTMLElement | null, _config: EventDeckConfig) {
        if (!container) {
            throw new Error('EventDeck: container not found');
        }

        ensureStylesMounted();

        this.root = document.createElement('div');
        this.root.className = 'event-deck';

        const header = document.createElement('header');
        header.className = 'event-deck__header';

        const titleRow = document.createElement('div');
        titleRow.className = 'event-deck__title-row';

        const title = document.createElement('h2');
        title.className = 'event-deck__title';
        title.textContent = 'Колода событий';

        this.chipsContainer = document.createElement('div');
        this.chipsContainer.className = 'event-deck__chips';

        this.deckChip = this.createChip('Колода', 'deck');
        this.discardChip = this.createChip('Сброс', 'discard');

        this.chipsContainer.append(this.deckChip.element, this.discardChip.element);
        titleRow.append(title, this.chipsContainer);

        this.revealedHeader = document.createElement('div');
        this.revealedHeader.className = 'event-deck__section-title';
        this.revealedHeader.textContent = 'Активные события (0)';

        header.append(titleRow, this.revealedHeader);

        this.revealedList = document.createElement('div');
        this.revealedList.className = 'event-deck__content';

        this.revealedPlaceholder = document.createElement('div');
        this.revealedPlaceholder.className = 'event-deck__placeholder';
        this.revealedPlaceholder.textContent = 'Нет активных событий.';

        this.liveRegion = document.createElement('div');
        this.liveRegion.className = 'event-deck__status-live';
        this.liveRegion.setAttribute('role', 'status');
        this.liveRegion.setAttribute('aria-live', 'polite');
        this.liveRegion.textContent = this.defaultStatus;

        this.root.append(header, this.revealedList, this.liveRegion);
        container.appendChild(this.root);

        this.updateZoneChips();
        this.renderRevealedCards();
        this.updateRevealedHeader();
    }

    public applySnapshot(snapshot: EventDeckSnapshot): void {
        this.deck = snapshot.drawPile.map((card) => ({ ...card }));
        this.revealed = snapshot.revealed.map((card) => ({ ...card }));
        this.discard = snapshot.discardPile.map((card) => ({ ...card }));

        this.updateZoneChips();
        this.renderRevealedCards();
        this.updateRevealedHeader();

        const status = snapshot.status;
        if (status) {
            this.setStatus(status.message, status.variant);
        } else {
            this.setStatus(this.defaultStatus);
        }
    }

    public setIntentHandlers(handlers: EventDeckIntentHandlers = {}) {
        this.intentHandlers = { ...handlers };
    }

    public setStatus(message: string, _variant?: EventDeckStatusVariant) {
        this.liveRegion.textContent = message;
    }

    private createChip(label: string, variant: 'deck' | 'discard'): ChipElements {
        const element = document.createElement('div');
        element.className = 'event-deck__chip';
        element.classList.add(`event-deck__chip--${variant}`);

        const labelElement = document.createElement('span');
        labelElement.className = 'event-deck__chip-label';
        labelElement.textContent = label;

        const valueElement = document.createElement('span');
        valueElement.className = 'event-deck__chip-value';
        valueElement.textContent = '0';

        element.append(labelElement, valueElement);

        return { element, value: valueElement };
    }

    private updateZoneChips() {
        this.updateChip(this.deckChip, this.deck.length);
        this.updateChip(this.discardChip, this.discard.length);
    }

    private updateChip(chip: ChipElements, count: number) {
        chip.value.textContent = String(count);
        if (count === 0) {
            chip.element.classList.add('event-deck__chip--empty');
        } else {
            chip.element.classList.remove('event-deck__chip--empty');
        }
    }

    private updateRevealedHeader() {
        this.revealedHeader.textContent = `Активные события (${this.revealed.length})`;
    }

    private renderRevealedCards() {
        this.revealedList.innerHTML = '';

        if (this.revealed.length === 0) {
            this.revealedList.appendChild(this.revealedPlaceholder);
            return;
        }

        this.revealed.forEach((card) => {
            const cardElement = this.createRevealedCardElement(card);
            this.revealedList.appendChild(cardElement);
        });
    }

    private createRevealedCardElement(card: EventDeckCardConfig) {
        const cardElement = document.createElement('article');
        cardElement.className = 'event-card';
        cardElement.dataset.cardId = card.id;
        if (card.instanceId) {
            cardElement.dataset.cardInstanceId = card.instanceId;
        }
        if (card.inPlay) {
            cardElement.dataset.state = 'in-play';
        }

        const header = document.createElement('header');
        header.className = 'event-card__header';

        const title = document.createElement('h3');
        title.className = 'event-card__title';
        title.textContent = card.title;
        header.appendChild(title);

        const badges = this.createCardBadges(card);
        if (badges) {
            header.appendChild(badges);
        }

        const summary = document.createElement('p');
        summary.className = 'event-card__summary';
        summary.textContent = card.summary;

        cardElement.append(header, summary);

        if (card.impact) {
            const impact = document.createElement('p');
            impact.className = 'event-card__impact';
            impact.textContent = card.impact;
            cardElement.appendChild(impact);
        }

        const metaEntries = this.createCardMeta(card);
        metaEntries.forEach((entry) => cardElement.appendChild(entry));

        if (card.flavor) {
            const flavor = document.createElement('p');
            flavor.className = 'event-card__flavor';
            flavor.textContent = card.flavor;
            cardElement.appendChild(flavor);
        }

        return cardElement;
    }

    private createCardBadges(card: EventDeckCardConfig): HTMLDivElement | null {
        const badges = document.createElement('div');
        badges.className = 'event-card__badges';

        if (card.type === 'enemy') {
            const badge = document.createElement('span');
            badge.className = 'event-card__badge';
            badge.dataset.variant = 'enemy';
            badge.textContent = 'Враг';
            badges.appendChild(badge);
        }

        if (card.inPlay) {
            const stateBadge = document.createElement('span');
            stateBadge.className = 'event-card__badge';
            stateBadge.dataset.variant = 'state';
            stateBadge.textContent = 'В игре';
            badges.appendChild(stateBadge);
        }

        return badges.childElementCount > 0 ? badges : null;
    }

    private createCardMeta(card: EventDeckCardConfig): HTMLParagraphElement[] {
        const meta: HTMLParagraphElement[] = [];

        if (card.locationTitle) {
            const location = document.createElement('p');
            location.className = 'event-card__meta';
            location.textContent = `Локация: ${card.locationTitle}`;
            meta.push(location);
        } else if (card.enter) {
            const enter = document.createElement('p');
            enter.className = 'event-card__meta';
            if (card.enter === 'random') {
                enter.textContent = 'Появление: случайная локация';
            } else {
                enter.textContent = `Появление: ${card.enter}`;
            }
            meta.push(enter);
        }

        return meta;
    }
}
