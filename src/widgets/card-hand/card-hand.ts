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
    onCardSelected?: (card: CardSelectionInfo) => void
}

interface CardRecord {
    slot: HTMLDivElement
    card: HTMLElement
    content: string
}

export interface CardSelectionInfo {
    index: number
    content: string
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
    private readonly frame: HTMLDivElement
    private readonly stackHost: HTMLDivElement
    private readonly cardWidth: number
    private readonly cardHeight: number
    private readonly gap: number
    private readonly cards: string[] = []
    private readonly cardRecords: CardRecord[] = []
    private readonly renderer: CardRenderer
    private readonly onCardSelected: (card: CardSelectionInfo) => void
    private resizeObserver?: ResizeObserver
    private lockedRecord?: CardRecord
    private readonly ownsRoot: boolean
    private dragState?: {
        pointerId: number
        record: CardRecord
        startX: number
        originalLeft: number
        originalIndex: number
        currentLeft: number
        hasMoved: boolean
    }
    private layoutStep: number

    private readonly handleResize = () => {
        this.layoutCards()
    }

    private readonly handleRootPointerDown = (event: PointerEvent) => {
        if (!this.lockedRecord) {
            return
        }

        const target = event.target as HTMLElement | null
        const isCardTarget = target?.closest('.card-hand__slot')

        if (!isCardTarget) {
            this.clearLockedCard()
        }
    }

    private readonly handleDocumentPointerDown = (event: PointerEvent) => {
        if (!this.lockedRecord) {
            return
        }

        const target = event.target as HTMLElement | null
        if (target?.closest('.card-hand__slot')) {
            return
        }

        this.clearLockedCard()
    }

    constructor(root?: HTMLElement | null, options: CardHandOptions = {}) {
        this.ownsRoot = !root
        this.root = root ?? this.createOverlayRoot()
        this.cardWidth = options.cardWidth ?? DEFAULT_CARD_WIDTH
        this.cardHeight = options.cardHeight ?? DEFAULT_CARD_HEIGHT
        this.gap = options.gap ?? DEFAULT_CARD_GAP
        this.renderer = options.renderer ?? new DefaultCardRenderer()
        this.onCardSelected = (card) => {
            options.onCardSelected?.(card)
            console.log('[CardHand] Selected card:', card)
        }
        this.layoutStep = this.cardWidth + this.gap

        this.root.classList.add('card-hand')
        this.root.innerHTML = ''
        this.applyRootStyles()

        this.frame = document.createElement('div')
        this.frame.className = 'card-hand__frame'
        this.applyFrameStyles(this.frame)
        this.root.appendChild(this.frame)

        this.frame.addEventListener('pointerdown', this.handleRootPointerDown)
        document.addEventListener('pointerdown', this.handleDocumentPointerDown, true)

        this.stackHost = document.createElement('div')
        this.stackHost.className = 'card-hand__stack'
        this.applyStackStyles(this.stackHost)
        this.frame.appendChild(this.stackHost)

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
        this.frame.removeEventListener('pointerdown', this.handleRootPointerDown)
        document.removeEventListener('pointerdown', this.handleDocumentPointerDown, true)
        this.clearLockedCard()
        this.cardRecords.length = 0
        this.cards.length = 0
        this.stackHost.innerHTML = ''
        if (this.ownsRoot) {
            this.root.remove()
        } else {
            this.root.innerHTML = ''
        }
    }

    private applyRootStyles() {
        this.root.style.position = 'fixed'
        this.root.style.top = '0'
        this.root.style.right = '0'
        this.root.style.bottom = '0'
        this.root.style.left = '0'
        this.root.style.display = 'flex'
        this.root.style.alignItems = 'center'
        this.root.style.justifyContent = 'center'
        this.root.style.pointerEvents = 'none'
        this.root.style.padding = '0 16px'
        this.root.style.boxSizing = 'border-box'
        this.root.style.zIndex = '2000'
        this.root.style.overflow = 'visible'
    }

    private applyFrameStyles(frame: HTMLDivElement) {
        frame.style.position = 'relative'
        frame.style.width = '100%'
        frame.style.maxWidth = '960px'
        frame.style.pointerEvents = 'auto'
        frame.style.background = 'transparent'
        frame.style.backdropFilter = 'none'
        frame.style.borderRadius = '0'
        frame.style.border = 'none'
        frame.style.boxShadow = 'none'
        frame.style.boxSizing = 'border-box'
        frame.style.padding = '0'
        frame.style.display = 'flex'
        frame.style.justifyContent = 'center'
        frame.style.alignItems = 'flex-end'
        frame.style.overflow = 'visible'
    }

    private applyStackStyles(stack: HTMLDivElement) {
        stack.style.position = 'relative'
        stack.style.width = '100%'
        stack.style.height = '100%'
        stack.style.boxSizing = 'border-box'
        stack.style.pointerEvents = 'auto'
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
        slot.style.touchAction = 'none'
        slot.dataset.state = 'resting'

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
            content,
        }

        slot.addEventListener('pointerenter', () => this.raiseCard(record))
        slot.addEventListener('pointerleave', () => this.lowerCard(record))
        slot.addEventListener('pointerdown', (event) => this.handleCardPointerDown(event, record))
        slot.addEventListener('pointermove', (event) => this.handleCardPointerMove(event, record))
        slot.addEventListener('pointerup', (event) => this.handleCardPointerUp(event, record))
        slot.addEventListener('pointercancel', (event) => this.handleCardPointerCancel(event, record))
        slot.addEventListener('click', (event) => this.handleCardClick(event, record))

        return record
    }

    private handleCardPointerDown(event: PointerEvent, record: CardRecord) {
        if (event.pointerType === 'mouse' && event.button !== 0) {
            return
        }

        event.stopPropagation()

        if (this.dragState) {
            return
        }

        const originalLeft = Number.parseFloat(record.slot.style.left) || 0

        this.dragState = {
            pointerId: event.pointerId,
            record,
            startX: event.clientX,
            originalLeft,
            originalIndex: this.cardRecords.indexOf(record),
            currentLeft: originalLeft,
            hasMoved: false,
        }

        record.slot.setPointerCapture(event.pointerId)
        record.slot.dataset.state = 'dragging'
        record.slot.style.transition = 'none'
        record.slot.style.zIndex = '10000'
        record.slot.style.cursor = 'grabbing'

        this.setCardRaisedState(record, true)
    }

    private handleCardPointerMove(event: PointerEvent, record: CardRecord) {
        if (!this.dragState || this.dragState.pointerId !== event.pointerId) {
            return
        }

        event.preventDefault()

        const deltaX = event.clientX - this.dragState.startX
        const nextLeft = this.dragState.originalLeft + deltaX

        if (!this.dragState.hasMoved && Math.abs(deltaX) > 2) {
            this.dragState.hasMoved = true
        }

        this.dragState.currentLeft = nextLeft
        record.slot.style.left = `${nextLeft}px`
    }

    private handleCardPointerUp(event: PointerEvent, record: CardRecord) {
        this.finishDrag(record, event.pointerId, false)
    }

    private handleCardPointerCancel(event: PointerEvent, record: CardRecord) {
        this.finishDrag(record, event.pointerId, true)
    }

    private handleCardClick(event: MouseEvent, record: CardRecord) {
        event.stopPropagation()

        if (this.dragState?.record === record && this.dragState.hasMoved) {
            return
        }

        if (this.lockedRecord === record) {
            const index = this.cardRecords.indexOf(record)
            if (index !== -1) {
                this.onCardSelected({
                    index,
                    content: record.content,
                })
            }

            this.clearLockedCard()
            return
        }

        this.lockCard(record)
    }

    private finishDrag(record: CardRecord, pointerId: number, cancelled: boolean) {
        if (!this.dragState || this.dragState.pointerId !== pointerId) {
            return
        }

        const dragState = this.dragState
        this.dragState = undefined

        record.slot.releasePointerCapture(pointerId)
        record.slot.style.cursor = ''
        record.slot.style.transition = ''
        record.slot.dataset.state = record.slot.dataset.locked === 'true' ? 'raised' : 'resting'

        const shouldRemainRaised = record.slot.dataset.locked === 'true'
        this.setCardRaisedState(record, shouldRemainRaised)

        if (!dragState.hasMoved || cancelled) {
            this.layoutCards()
            return
        }

        const targetLeft = dragState.currentLeft
        const newIndex = this.computeIndexFromLeft(targetLeft)
        this.reorderRecord(record, newIndex)
        this.layoutCards()
    }

    private computeIndexFromLeft(left: number): number {
        if (this.cardRecords.length <= 1) {
            return 0
        }

        const step = this.layoutStep || (this.cardWidth + this.gap)
        const index = Math.round(left / step)
        const maxIndex = this.cardRecords.length - 1

        if (Number.isNaN(index)) {
            return 0
        }

        return Math.min(Math.max(index, 0), maxIndex)
    }

    private reorderRecord(record: CardRecord, newIndex: number) {
        const oldIndex = this.cardRecords.indexOf(record)

        if (oldIndex === -1 || oldIndex === newIndex) {
            return
        }

        this.cardRecords.splice(oldIndex, 1)
        this.cardRecords.splice(newIndex, 0, record)

        const [content] = this.cards.splice(oldIndex, 1)
        this.cards.splice(newIndex, 0, content)

        if (this.lockedRecord === record) {
            this.lockedRecord = record
        }
    }

    private lockCard(record: CardRecord) {
        if (this.lockedRecord && this.lockedRecord !== record) {
            this.clearLockedCard()
        }

        this.lockedRecord = record
        record.slot.dataset.locked = 'true'
        record.slot.dataset.state = 'raised'
        record.slot.style.zIndex = '10000'

        this.setCardRaisedState(record, true)
    }

    private clearLockedCard() {
        const record = this.lockedRecord
        if (!record) {
            return
        }

        if (this.dragState?.record === record) {
            return
        }

        delete record.slot.dataset.locked
        record.slot.dataset.state = 'resting'
        this.lockedRecord = undefined
        this.setCardRaisedState(record, false)
        this.layoutCards()
    }

    private setCardRaisedState(record: CardRecord, raised: boolean) {
        if (this.renderer.setRaisedState) {
            this.renderer.setRaisedState(record.card, raised)
        } else {
            this.applyDefaultRaisedState(record.card, raised)
        }
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

        this.layoutStep = step

        this.stackHost.style.height = `${this.cardHeight + RAISE_TRANSLATE_Y}px`

        const totalWidth = step * (count - 1) + this.cardWidth
        const offset = Math.max(0, (availableWidth - totalWidth) / 2)

        this.cardRecords.forEach((record, index) => {
            if (record.slot.dataset.state === 'dragging') {
                record.slot.style.zIndex = '10000'
                return
            }

            const left = Math.max(0, offset + step * index)
            record.slot.style.left = `${left}px`

            const baseZ = 100 + index
            record.slot.dataset.baseZ = String(baseZ)

            if (record.slot.dataset.locked === 'true') {
                record.slot.style.zIndex = '10000'
                this.setCardRaisedState(record, true)
            } else if (record.slot.dataset.state === 'raised') {
                record.slot.style.zIndex = '9999'
            } else {
                record.slot.style.zIndex = String(baseZ)
                if (record.slot.dataset.state !== 'raised') {
                    this.setCardRaisedState(record, false)
                }
            }
        })
    }

    private raiseCard(record: CardRecord) {
        if (record.slot.dataset.state === 'dragging' || this.dragState?.record === record) {
            return
        }

        if (record.slot.dataset.locked === 'true') {
            record.slot.dataset.state = 'raised'
            record.slot.style.zIndex = '10000'
            this.setCardRaisedState(record, true)
            return
        }

        if (record.slot.dataset.state === 'raised') {
            return
        }

        record.slot.dataset.state = 'raised'
        record.slot.style.zIndex = '9999'
        this.setCardRaisedState(record, true)
    }

    private lowerCard(record: CardRecord, force = false) {
        if (!force && (record.slot.dataset.locked === 'true' || record.slot.dataset.state === 'dragging')) {
            return
        }

        record.slot.dataset.state = 'resting'
        const baseZ = record.slot.dataset.baseZ
        record.slot.style.zIndex = baseZ ?? '1'
        this.setCardRaisedState(record, false)
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

    private createOverlayRoot(): HTMLElement {
        const overlay = document.createElement('div')
        overlay.setAttribute('data-card-hand-overlay', '1')
        document.body.appendChild(overlay)
        return overlay
    }
}
