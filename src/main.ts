import './style.css'

import { setupAppLayout } from './app-layout'
import { setupDebugPanel } from './setup-debug-panel'
import {
    setupGameEngine,
    type CardsConfig,
    type CharacterData,
    type RulesConfig,
} from './setup-game-engine'
import cardsSource from './data/cards.json'
import rulesSource from './data/rules.json'
import mapSource from './data/map.json'
import eventDeckSource from './data/event-deck.json'
import characterSource from './data/character.json'
import type { EventDeckConfig } from './widgets/event-deck/event-deck'
import type { ExpeditionMapConfig } from './widgets/expedition-map/expedition-map'

type GameDataConfig = {
    cards: CardsConfig
    rules: RulesConfig
    expeditionMap: ExpeditionMapConfig
    eventDeck: EventDeckConfig
    character: CharacterData
}

function loadGameData(): GameDataConfig {
    const cards = cardsSource as CardsConfig
    const rules = rulesSource as RulesConfig
    const expeditionMap = mapSource as ExpeditionMapConfig
    const eventDeck = eventDeckSource as EventDeckConfig
    const character = characterSource as CharacterData

    return {
        cards,
        rules,
        expeditionMap,
        eventDeck,
        character,
    }
}

function initializeApplication(): void {
    const root = document.querySelector<HTMLDivElement>('#app')
    if (!root) {
        throw new Error('Не удалось найти корневой контейнер приложения')
    }

    const layout = setupAppLayout(root)
    const gameData = loadGameData()

    const gameEngine = setupGameEngine({
        containers: {
            hand: layout.handPanel,
            map: layout.mapPanel,
            eventDeck: layout.rightTopPanel,
            engine: layout.rightBottomPanel,
            character: layout.characterPanel,
            gameLoop: layout.leftBottomPanel,
        },
        configs: {
            cards: gameData.cards,
            rules: gameData.rules,
            expeditionMap: gameData.expeditionMap,
            eventDeck: gameData.eventDeck,
            character: gameData.character,
        },
    })

    setupDebugPanel({
        store: gameEngine.store,
        debugFacade: gameEngine.debugFacade,
        cardHand: gameEngine.cardHand,
        cardHandController: gameEngine.cardHandController,
        onViewModelChange: gameEngine.onViewModelChange,
    })
}

initializeApplication()
