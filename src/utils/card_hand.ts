const DEFAULT_CARD_WIDTH = 140
const DEFAULT_CARD_HEIGHT = 200
const DEFAULT_CARD_GAP = 16
const MIN_OVERLAP_RATIO = 0.35

export interface CardHandOptions {
    cardWidth?: number
    cardHeight?: number
    gap?: number
    cards?: string[]
}

export class CardHand {
    private readonly root: HTMLElement
    private readonly stackHost: HTMLDivElement
    private readonly cardWidth: number
    private readonly cardHeight: number
    private readonly gap: number
    private readonly cards: string[] = []
    private readonly cardElements: HTMLDivElement[] = []
    private resizeObserver?: ResizeObserver

    private readonly handleResize = () => {
        this.layoutCards()
    }

    constructor(root?: HTMLElement | null, options: CardHandOptions = {}) {
        this.root = root ?? document.body
        this.cardWidth = options.cardWidth ?? DEFAULT_CARD_WIDTH
        this.cardHeight = options.cardHeight ?? DEFAULT_CARD_HEIGHT
        this.gap = options.gap ?? DEFAULT_CARD_GAP

        this.root.classList.add('card-hand')
        this.root.innerHTML = ''

        this.stackHost = document.createElement('div')
        this.stackHost.className = 'card-hand__stack'
        this.root.appendChild(this.stackHost)

        const initialCards = options.cards ?? []
        initialCards.forEach((card) => this.addCard(card))

        if (typeof ResizeObserver !== 'undefined') {
            this.resizeObserver = new ResizeObserver(this.handleResize)
            this.resizeObserver.observe(this.stackHost)
        } else {
            window.addEventListener('resize', this.handleResize)
        }
    }

    addCard(cardContent: string) {
        this.cards.push(cardContent)

        const cardElement = this.createCardElement(cardContent)
        this.cardElements.push(cardElement)
        this.stackHost.appendChild(cardElement)

        this.layoutCards()
    }

    setCards(cards: string[]) {
        this.cards.splice(0, this.cards.length, ...cards)
        this.stackHost.innerHTML = ''
        this.cardElements.splice(0, this.cardElements.length)

        this.cards.forEach((card) => {
            const cardElement = this.createCardElement(card)
            this.cardElements.push(cardElement)
            this.stackHost.appendChild(cardElement)
        })

        this.layoutCards()
    }

    destroy() {
        this.resizeObserver?.disconnect()
        window.removeEventListener('resize', this.handleResize)
        this.cardElements.length = 0
        this.cards.length = 0
        this.stackHost.innerHTML = ''
    }

    private createCardElement(content: string) {
        const card = document.createElement('div')
        card.className = 'card-hand__card'
        card.style.width = `${this.cardWidth}px`
        card.style.height = `${this.cardHeight}px`
        card.textContent = content
        return card
    }

    private layoutCards() {
        const count = this.cardElements.length

        if (count === 0) {
            return
        }

        const availableWidth = this.stackHost.clientWidth
        const minStep = this.cardWidth * MIN_OVERLAP_RATIO
        const defaultStep = this.cardWidth + this.gap

        let step = defaultStep

        const requiredWidth = defaultStep * count - this.gap
        if (count > 1 && requiredWidth > availableWidth) {
            const overlapStep = (availableWidth - this.cardWidth) / (count - 1)
            step = Math.max(minStep, overlapStep)
        }

        this.stackHost.style.height = `${this.cardHeight + 40}px`

        this.cardElements.forEach((card, index) => {
            const left = Math.max(0, step * index)
            card.style.left = `${left}px`
            card.style.zIndex = String(100 + index)
        })
    }
}
