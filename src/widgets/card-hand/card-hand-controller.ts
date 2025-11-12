import { CardHand, type CardHandCard, type CardHandDropResult } from './card-hand'
import type { CardEffect } from './card-hand'
import {
    EndTurnCommand,
    type GameEngine,
    type GameEvent,
    type GameViewModel,
    MoveWithCardCommand,
    PostLogCommand,
    type MoveCardDescriptor,
} from '../game-engine/game-engine'

export type HandCardDefinition = {
    id: string
    title: string
    description: string
    image?: string
    cost: number
    effect: CardEffect
}

export type HandCardContent = HandCardDefinition & { instanceId: string }

type CardHandControllerOptions = {
    initialCards: HandCardDefinition[]
    createDebugCard?: () => HandCardContent
}

type CardHandControllerDependencies = {
    gameEngine: GameEngine
    cardHand: CardHand
}

export function generateCardInstanceId(baseId: string): string {
    const normalized = baseId?.trim() ? baseId.trim() : 'card'
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return `${normalized}-${crypto.randomUUID()}`
    }
    const randomPart = Math.random().toString(36).slice(2, 10)
    return `${normalized}-${Date.now()}-${randomPart}`
}

export class CardHandController {
    private readonly gameEngine: GameEngine
    private readonly cardHand: CardHand
    private readonly createDebugCard?: () => HandCardContent

    private readonly handCards: HandCardContent[]
    private readonly unsubscribeFromEngine?: () => void
    private lastDropResult?: CardHandDropResult

    constructor(dependencies: CardHandControllerDependencies, options: CardHandControllerOptions) {
        this.gameEngine = dependencies.gameEngine
        this.cardHand = dependencies.cardHand
        this.createDebugCard = options.createDebugCard
        this.handCards = options.initialCards.map((card) => this.createCardContent(card))
        this.unsubscribeFromEngine = this.gameEngine.subscribe(this.handleEngineEvent)
    }

    initialize(): void {
        this.cardHand.setCards(this.handCards.map((card) => this.toCardHandCard(card)))
    }

    addDebugCard(): void {
        if (!this.createDebugCard) {
            throw new Error('Debug card factory is not configured.')
        }
        const card = this.createDebugCard()
        this.handCards.push(card)
        this.cardHand.addCard(this.toCardHandCard(card))
    }

    onDrop(card: CardHandCard, territoryId: string): CardHandDropResult {
        const descriptor: MoveCardDescriptor = {
            id: card.id,
            title: card.title,
            cost: card.cost,
        }
        this.lastDropResult = undefined
        this.gameEngine.dispatch(new MoveWithCardCommand(descriptor, territoryId))
        const result: CardHandDropResult =
            this.lastDropResult ?? { status: 'error', message: 'Не удалось выполнить перемещение.' }
        this.lastDropResult = undefined
        return result
    }

    onDropFailure(_card: CardHandCard, _territoryId: string, _message?: string): void {
        // Outcome handling now arrives through engine events — nothing additional is required here.
    }

    onDropTargetMissing(card: CardHandCard): void {
        const prompt = `Выберите локацию для «${card.title}».`
        this.gameEngine.dispatch(new PostLogCommand('user', prompt))
        this.gameEngine.dispatch(new PostLogCommand('system', `move_hint:target_missing:${card.id}`))
    }

    handleCardConsumed(card: CardHandCard): void {
        if (!card.instanceId) {
            return
        }
        const index = this.handCards.findIndex((entry) => entry.instanceId === card.instanceId)
        if (index !== -1) {
            this.handCards.splice(index, 1)
        }
    }

    handleEndTurn(): void {
        this.gameEngine.dispatch(new EndTurnCommand())
    }

    private readonly handleEngineEvent = (event: GameEvent, _viewModel: GameViewModel): void => {
        if (event.type === 'move:success') {
            this.lastDropResult = { status: 'success' }
        } else if (event.type === 'move:failure') {
            this.lastDropResult = { status: 'error', message: event.message }
        }
    }

    destroy(): void {
        this.unsubscribeFromEngine?.()
    }

    private createCardContent(card: HandCardDefinition): HandCardContent {
        return {
            ...card,
            instanceId: generateCardInstanceId(card.id),
        }
    }

    private toCardHandCard(card: HandCardContent): CardHandCard {
        const { image, ...rest } = card
        return {
            ...rest,
            artUrl: image,
        }
    }
}
