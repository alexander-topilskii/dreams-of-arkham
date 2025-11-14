import type { CardHandCard } from "./card-hand";

export type InternalCard = CardHandCard & { instanceId: string };

export class CardHandState {
    private cards: InternalCard[] = [];
    private instanceIdCounter = 0;

    constructor(initialCards: CardHandCard[] = []) {
        if (initialCards.length > 0) {
            this.setCards(initialCards);
        }
    }

    getCards(): InternalCard[] {
        return this.cards;
    }

    getCardByInstanceId(id: string): InternalCard | undefined {
        return this.cards.find((card) => card.instanceId === id);
    }

    addCard(card: CardHandCard): { card: InternalCard; index: number } {
        const internalCard = this.prepareCard(card);
        this.cards.push(internalCard);
        return { card: internalCard, index: this.cards.length - 1 };
    }

    setCards(cards: CardHandCard[]): InternalCard[] {
        this.cards = cards.map((card) => this.prepareCard(card));
        return this.cards;
    }

    removeCard(id: string): { card?: InternalCard; index: number } {
        const index = this.cards.findIndex((card) => card.instanceId === id);
        if (index === -1) {
            return { index: -1 };
        }

        const [card] = this.cards.splice(index, 1);
        return { card, index };
    }

    private prepareCard(card: CardHandCard): InternalCard {
        const providedId = card.instanceId?.trim();
        const instanceId = providedId && providedId.length > 0 ? providedId : this.generateInstanceId(card.id);
        return { ...card, instanceId };
    }

    private generateInstanceId(baseId: string): string {
        const normalized = baseId?.trim() ? baseId.trim() : "card";
        const counter = this.instanceIdCounter++;
        if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
            return `${normalized}::${counter}::${crypto.randomUUID()}`;
        }
        const randomPart = Math.random().toString(36).slice(2, 10);
        const timestamp = Date.now().toString(36);
        return `${normalized}::${counter}::${timestamp}${randomPart}`;
    }
}
