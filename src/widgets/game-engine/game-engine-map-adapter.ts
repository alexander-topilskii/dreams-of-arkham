import { GameEngineStore, type GameEvent, type GameViewModel } from "./game-engine-store";
import {
    ExpeditionMap,
    type ExpeditionMapCharacterPlacement,
    type TerritoryConfig,
} from "../expedition-map/expedition-map";

export class GameEngineMapAdapter {
    private readonly unsubscribe: () => void;
    private initialized = false;
    private knownTerritories = new Set<string>();
    private knownCharacters = new Map<string, ExpeditionMapCharacterPlacement>();

    constructor(private readonly store: GameEngineStore, private readonly map: ExpeditionMap) {
        this.unsubscribe = this.store.subscribe(this.handleStoreEvent);
    }

    public destroy(): void {
        this.unsubscribe();
        this.knownTerritories.clear();
        this.knownCharacters.clear();
    }

    private readonly handleStoreEvent = (event: GameEvent, viewModel: GameViewModel): void => {
        switch (event.type) {
            case "state:sync": {
                this.syncTerritories(viewModel.map.territories);
                this.syncRevealed(viewModel.map.revealedTerritoryIds);
                this.syncCharacters(viewModel.map.characterPlacements);
                break;
            }
            case "map:territoryAdded": {
                this.syncTerritories(viewModel.map.territories);
                this.syncRevealed(viewModel.map.revealedTerritoryIds);
                break;
            }
            case "location:reveal": {
                this.syncRevealed(viewModel.map.revealedTerritoryIds);
                break;
            }
            case "player:place":
            case "map:characterPlaced": {
                this.syncRevealed(viewModel.map.revealedTerritoryIds);
                this.syncCharacters(viewModel.map.characterPlacements);
                break;
            }
            case "map:characterRemoved": {
                this.map.removeCharacter(event.characterId);
                this.syncCharacters(viewModel.map.characterPlacements);
                break;
            }
            default: {
                break;
            }
        }
    };

    private syncTerritories(territories: readonly TerritoryConfig[]): void {
        if (!this.initialized) {
            territories.forEach((territory) => {
                this.knownTerritories.add(territory.id);
            });
            this.initialized = true;
            return;
        }

        territories.forEach((territory) => {
            if (this.knownTerritories.has(territory.id)) {
                return;
            }

            this.knownTerritories.add(territory.id);
            this.map.addTerritory(territory);
        });
    }

    private syncRevealed(revealed: readonly string[]): void {
        revealed.forEach((territoryId) => {
            if (this.knownTerritories.has(territoryId)) {
                this.map.revealTerritory(territoryId);
            }
        });
    }

    private syncCharacters(placements: readonly ExpeditionMapCharacterPlacement[]): void {
        const next = new Map<string, ExpeditionMapCharacterPlacement>();

        placements.forEach((placement) => {
            next.set(placement.character.id, placement);
            this.map.placeCharacter(placement.character, placement.territoryId);
        });

        for (const [characterId] of this.knownCharacters) {
            if (!next.has(characterId)) {
                this.map.removeCharacter(characterId);
            }
        }

        this.knownCharacters = next;
    }
}
