import { CardHand, type CardHandCard, type CardHandDropResult } from './card-hand'
import type { CardEffect } from './card-hand'
import type { GameEngine, MoveAttemptResult, MoveCardDescriptor } from '../game-engine/game-engine'

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

    constructor(dependencies: CardHandControllerDependencies, options: CardHandControllerOptions) {
        this.gameEngine = dependencies.gameEngine
        this.cardHand = dependencies.cardHand
        this.createDebugCard = options.createDebugCard
        this.handCards = options.initialCards.map((card) => this.createCardContent(card))
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
        const result: MoveAttemptResult = this.gameEngine.attemptMoveWithCard(descriptor, territoryId)
        if (result.success) {
            return { status: 'success' }
        }
        return { status: 'error', message: result.message }
    }

    onDropFailure(_card: CardHandCard, _territoryId: string, _message?: string): void {
        // Game engine already logs and re-renders failure outcomes inside attemptMoveWithCard.
    }

    onDropTargetMissing(card: CardHandCard): void {
        const prompt = `Выберите локацию для «${card.title}».`
        this.gameEngine.logUserMessage(prompt)
        this.gameEngine.logSystemMessage(`move_hint:target_missing:${card.id}`)
        this.gameEngine.refresh()
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
        this.gameEngine.endTurn()
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
