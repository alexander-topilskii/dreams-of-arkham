import {
    GameEngineStore,
    type EventDeckViewModel,
    type GameEvent,
    type GameViewModel,
} from "./game-engine-store";
import { EventDeck, type EventDeckSnapshot } from "../event-deck/event-deck";

export class GameEngineEventDeckAdapter {
    private readonly unsubscribe: () => void;

    constructor(private readonly store: GameEngineStore, private readonly deck: EventDeck) {
        this.unsubscribe = this.store.subscribe(this.handleStoreEvent);
    }

    public destroy(): void {
        this.unsubscribe();
    }

    private readonly handleStoreEvent = (event: GameEvent, viewModel: GameViewModel): void => {
        switch (event.type) {
            case "state:sync":
            case "eventDeck:triggered":
            case "eventDeck:revealed":
            case "eventDeck:reshuffled": {
                this.syncDeck(viewModel.deck);
                break;
            }
            default: {
                break;
            }
        }
    };

    private syncDeck(deckState: EventDeckViewModel | undefined): void {
        if (!deckState) {
            this.deck.applySnapshot({ drawPile: [], revealed: [], discardPile: [] });
            this.deck.setStatus('Колода событий недоступна.', 'warn');
            return;
        }

        const snapshot: EventDeckSnapshot = {
            drawPile: deckState.drawPile,
            revealed: deckState.revealed,
            discardPile: deckState.discardPile,
            status: deckState.status,
        };

        this.deck.applySnapshot(snapshot);
    }
}
