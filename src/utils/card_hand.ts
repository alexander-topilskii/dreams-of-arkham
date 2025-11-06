const DEFAULT_CARD_WIDTH = 140
const DEFAULT_CARD_HEIGHT = 200
const DEFAULT_CARD_GAP = 16
const MIN_OVERLAP_RATIO = 0.35
const RAISE_TRANSLATE_Y = 124
const RAISE_SCALE = 1.58

export interface CardDimensions {
    width: number
    height: number
}

export interface CardRenderer {
    createCard(content: string, dimensions: CardDimensions): HTMLElement
    setRaisedState?(card: HTMLElement, raised: boolean): void
}

export interface CardHandOptions {
    cardWidth?: number
    cardHeight?: number
    gap?: number
    cards?: string[]
    renderer?: CardRenderer
}

interface CardRecord {
    slot: HTMLDivElement
    card: HTMLElement
}

export class DefaultCardRenderer implements CardRenderer {
    createCard(content: string, dimensions: CardDimensions): HTMLElement {
        const card = document.createElement('div')
        card.className = 'card-hand__card'

        card.style.position = 'absolute'
        card.style.left = '0'
        card.style.bottom = '0'
        card.style.width = `${dimensions.width}px`
        card.style.height = `${dimensions.height}px`
        card.style.padding = '12px'
        card.style.borderRadius = '12px'
        card.style.border = '1px solid rgba(255, 255, 255, 0.1)'
        card.style.background = 'rgba(40, 40, 54, 0.9)'
        card.style.color = '#f9fafb'
        card.style.boxShadow = '0 8px 20px rgba(0, 0, 0, 0.35)'
        card.style.display = 'flex'
        card.style.alignItems = 'center'
        card.style.justifyContent = 'center'
        card.style.textAlign = 'center'
        card.style.lineHeight = '1.2'
        card.style.fontSize = '0.9rem'
        card.style.cursor = 'pointer'
        card.style.userSelect = 'none'
        card.style.backdropFilter = 'blur(4px)'
        card.style.transition = 'transform 0.2s ease, box-shadow 0.2s ease'
        card.style.transformOrigin = 'center bottom'

        card.textContent = content

        this.setRaisedState(card, false)

        return card
    }

    setRaisedState(card: HTMLElement, raised: boolean) {
        if (raised) {
            card.style.transform = `translateY(-${RAISE_TRANSLATE_Y}px) scale(${RAISE_SCALE})`
            card.style.boxShadow = '0 16px 32px rgba(0, 0, 0, 0.45)'
        } else {
            card.style.transform = 'translateY(0) scale(1)'
            card.style.boxShadow = '0 8px 20px rgba(0, 0, 0, 0.35)'
        }
    }
}

export class CardHand {
    private readonly root: HTMLElement
    private readonly stackHost: HTMLDivElement
    private readonly cardWidth: number
    private readonly cardHeight: number
    private readonly gap: number
    private readonly cards: string[] = []
    private readonly cardRecords: CardRecord[] = []
    private readonly renderer: CardRenderer
    private resizeObserver?: ResizeObserver

    private readonly handleResize = () => {
        this.layoutCards()
    }

    constructor(root?: HTMLElement | null, options: CardHandOptions = {}) {
        this.root = root ?? document.body
        this.cardWidth = options.cardWidth ?? DEFAULT_CARD_WIDTH
        this.cardHeight = options.cardHeight ?? DEFAULT_CARD_HEIGHT
        this.gap = options.gap ?? DEFAULT_CARD_GAP
        this.renderer = options.renderer ?? new DefaultCardRenderer()

        this.root.classList.add('card-hand')
        this.root.innerHTML = ''
        this.applyRootStyles()

        this.stackHost = document.createElement('div')
        this.stackHost.className = 'card-hand__stack'
        this.applyStackStyles(this.stackHost)
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
        this.cardRecords.push(cardElement)
        this.stackHost.appendChild(cardElement.slot)

        this.layoutCards()
    }

    setCards(cards: string[]) {
        this.cards.splice(0, this.cards.length, ...cards)
        this.stackHost.innerHTML = ''
        this.cardRecords.splice(0, this.cardRecords.length)

        this.cards.forEach((card) => {
            const cardElement = this.createCardElement(card)
            this.cardRecords.push(cardElement)
            this.stackHost.appendChild(cardElement.slot)
        })

        this.layoutCards()
    }

    destroy() {
        this.resizeObserver?.disconnect()
        window.removeEventListener('resize', this.handleResize)
        this.cardRecords.length = 0
        this.cards.length = 0
        this.stackHost.innerHTML = ''
    }

    private applyRootStyles() {
        this.root.style.position = 'relative'
        this.root.style.width = '100%'
        this.root.style.height = '100%'
        this.root.style.overflow = 'visible'
    }

    private applyStackStyles(stack: HTMLDivElement) {
        stack.style.position = 'relative'
        stack.style.width = '100%'
        stack.style.height = '100%'
    }

    private createCardElement(content: string): CardRecord {
        const slot = document.createElement('div')
        slot.className = 'card-hand__slot'
        slot.style.position = 'absolute'
        slot.style.left = '0'
        slot.style.bottom = '0'
        slot.style.width = `${this.cardWidth}px`
        slot.style.height = `${this.cardHeight}px`
        slot.style.display = 'flex'
        slot.style.alignItems = 'flex-end'
        slot.style.justifyContent = 'center'
        slot.style.overflow = 'visible'
        slot.style.pointerEvents = 'auto'

        const card = this.renderer.createCard(content, {
            width: this.cardWidth,
            height: this.cardHeight,
        })

        if (!card.style.position) {
            card.style.position = 'absolute'
            card.style.left = '0'
            card.style.bottom = '0'
            card.style.width = '100%'
            card.style.height = '100%'
        }

        if (this.renderer.setRaisedState) {
            this.renderer.setRaisedState(card, false)
        } else {
            this.applyDefaultRaisedState(card, false)
        }

        slot.appendChild(card)

        const record: CardRecord = {
            slot,
            card,
        }

        slot.addEventListener('pointerenter', () => this.raiseCard(record))
        slot.addEventListener('pointerleave', () => this.lowerCard(record))

        return record
    }

    private layoutCards() {
        const count = this.cardRecords.length

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

        this.stackHost.style.height = `${this.cardHeight + RAISE_TRANSLATE_Y}px`

        this.cardRecords.forEach((record, index) => {
            const left = Math.max(0, step * index)
            record.slot.style.left = `${left}px`

            const baseZ = 100 + index
            record.slot.dataset.baseZ = String(baseZ)

            if (record.slot.dataset.state === 'raised') {
                record.slot.style.zIndex = '9999'
            } else {
                record.slot.style.zIndex = String(baseZ)
            }
        })
    }

    private raiseCard(record: CardRecord) {
        if (record.slot.dataset.state === 'raised') {
            return
        }

        record.slot.dataset.state = 'raised'
        record.slot.style.zIndex = '9999'

        if (this.renderer.setRaisedState) {
            this.renderer.setRaisedState(record.card, true)
        } else {
            this.applyDefaultRaisedState(record.card, true)
        }
    }

    private lowerCard(record: CardRecord) {
        record.slot.dataset.state = 'resting'
        const baseZ = record.slot.dataset.baseZ
        record.slot.style.zIndex = baseZ ?? '1'

        if (this.renderer.setRaisedState) {
            this.renderer.setRaisedState(record.card, false)
        } else {
            this.applyDefaultRaisedState(record.card, false)
        }
    }

    private applyDefaultRaisedState(card: HTMLElement, raised: boolean) {
        if (!card.style.transition) {
            card.style.transition = 'transform 0.2s ease, box-shadow 0.2s ease'
        }

        if (!card.style.transformOrigin) {
            card.style.transformOrigin = 'center bottom'
        }

        if (raised) {
            card.style.transform = `translateY(-${RAISE_TRANSLATE_Y}px) scale(${RAISE_SCALE})`
            card.style.boxShadow = '0 16px 32px rgba(0, 0, 0, 0.45)'
        } else {
            card.style.transform = 'translateY(0) scale(1)'
            card.style.boxShadow = '0 8px 20px rgba(0, 0, 0, 0.35)'
        }
    }
}
