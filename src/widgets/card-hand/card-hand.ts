export type CardEffect = 'move' | 'attack' | 'hide' | 'search' | 'evade' | 'smoke' | 'heal'

export type CardHandCard = {
    id: string
    title: string
    description: string
    cost: number
    effect: CardEffect
    artUrl?: string
    instanceId?: string
}

type InternalCard = CardHandCard & { instanceId: string }

export type CardHandViewport = {
    start: number
    end: number
}

export type CardHandDropResult =
    | { status: 'success' }
    | { status: 'error'; message?: string }

export type CardHandDeckInfo = {
    drawPileCount: number
    discardPileCount: number
}

export type CardHandOptions = {
    cards?: CardHandCard[]
    height?: number
    cardWidth?: number
    cardHeight?: number
    gap?: number
    translucent?: boolean
    enableTouchInertia?: boolean
    onViewportChange?: (viewport: CardHandViewport) => void
    onMoveCardDrop?: (card: CardHandCard, territoryId: string) => CardHandDropResult | Promise<CardHandDropResult>
    onMoveCardDropFailure?: (card: CardHandCard, territoryId: string, message?: string) => void
    onMoveCardTargetMissing?: (card: CardHandCard) => void
    onCardConsumed?: (card: CardHandCard) => void
    onEndTurn?: () => void | Promise<void>
}

type PointerSwipeState = {
    pointerId: number
    lastY: number
    velocity: number
    lastTime: number
}

const CARD_ELEVATION = 10

type ActiveCardDrag = {
    pointerId: number
    card: InternalCard
    wrapper: HTMLDivElement
    startX: number
    startY: number
    arrow: HTMLDivElement
    head: HTMLDivElement
    thresholdPassed: boolean
    originPointerX: number
    originPointerY: number
}

type ZoneChipElements = {
    element: HTMLDivElement
    count: HTMLSpanElement
}

export class CardHand {
    private static stylesInjected = false

    private readonly ownsRoot: boolean
    private readonly root: HTMLElement
    private readonly translucent: boolean
    private readonly minViewportHeight: number
    private readonly cardWidth: number
    private readonly cardHeight: number
    private readonly gap: number
    private readonly enableTouchInertia: boolean
    private readonly onViewportChange?: (viewport: CardHandViewport) => void
    private readonly onMoveCardDrop?: CardHandOptions['onMoveCardDrop']
    private readonly onMoveCardDropFailure?: CardHandOptions['onMoveCardDropFailure']
    private readonly onMoveCardTargetMissing?: CardHandOptions['onMoveCardTargetMissing']
    private readonly onCardConsumed?: CardHandOptions['onCardConsumed']
    private readonly onEndTurn?: CardHandOptions['onEndTurn']

    private readonly panel: HTMLDivElement
    private readonly header: HTMLDivElement
    private readonly instructionsLabel: HTMLDivElement
    private readonly zonesContainer: HTMLDivElement
    private readonly deckChip: HTMLDivElement
    private readonly discardChip: HTMLDivElement
    private readonly deckCountLabel: HTMLSpanElement
    private readonly discardCountLabel: HTMLSpanElement
    private readonly endTurnButton: HTMLButtonElement
    private readonly progressLabel: HTMLDivElement
    private readonly viewport: HTMLDivElement
    private readonly strip: HTMLDivElement
    private readonly topShade: HTMLDivElement
    private readonly bottomShade: HTMLDivElement
    private readonly upButton: HTMLButtonElement
    private readonly downButton: HTMLButtonElement

    private cards: InternalCard[] = []
    private instanceIdCounter = 0
    private readonly cardElements = new Map<string, HTMLDivElement>()
    private pointerSwipe?: PointerSwipeState
    private scrollSnapTimer?: number
    private activeDrag?: ActiveCardDrag
    private endTurnPending = false
    private resizeObserver?: ResizeObserver
    private removeWindowResizeListener?: () => void

    constructor(root?: HTMLElement | null, options: CardHandOptions = {}) {
        this.ownsRoot = !root
        this.root = root ?? this.createOverlayRoot()
        this.translucent = options.translucent ?? true
        this.minViewportHeight = options.height ?? 300
        this.cardWidth = options.cardWidth ?? 336
        this.cardHeight = options.cardHeight ?? Math.floor(this.cardWidth * 1.1)
        this.gap = options.gap ?? 10
        this.enableTouchInertia = options.enableTouchInertia ?? true
        this.onViewportChange = options.onViewportChange
        this.onMoveCardDrop = options.onMoveCardDrop
        this.onMoveCardDropFailure = options.onMoveCardDropFailure
        this.onMoveCardTargetMissing = options.onMoveCardTargetMissing
        this.onCardConsumed = options.onCardConsumed
        this.onEndTurn = options.onEndTurn

        this.root.classList.add('card-hand-widget')
        this.root.innerHTML = ''

        CardHand.injectStyles()

        this.panel = document.createElement('div')
        this.panel.className = 'card-hand-widget__panel'
        if (this.translucent) {
            this.panel.classList.add('card-hand-widget__panel--translucent')
        }

        this.root.appendChild(this.panel)

        this.header = document.createElement('div')
        this.header.className = 'card-hand-widget__header'

        this.instructionsLabel = document.createElement('div')
        this.instructionsLabel.className = 'card-hand-widget__instructions'
        this.instructionsLabel.style.display = 'none'

        const deckChipElements = this.createZoneChip('Колода', 'deck')
        this.deckChip = deckChipElements.element
        this.deckCountLabel = deckChipElements.count

        const discardChipElements = this.createZoneChip('Сброс', 'discard')
        this.discardChip = discardChipElements.element
        this.discardCountLabel = discardChipElements.count

        this.zonesContainer = document.createElement('div')
        this.zonesContainer.className = 'card-hand-widget__zones'
        this.zonesContainer.style.display = 'none'
        this.zonesContainer.append(this.deckChip, this.discardChip)

        this.endTurnButton = document.createElement('button')
        this.endTurnButton.type = 'button'
        this.endTurnButton.className = 'card-hand-widget__end-turn'
        this.endTurnButton.textContent = 'Закончить ход'
        this.endTurnButton.addEventListener('click', this.handleEndTurnClick)
        this.endTurnButton.disabled = !this.onEndTurn

        this.progressLabel = document.createElement('div')
        this.progressLabel.className = 'card-hand-widget__progress'

        this.header.append(this.instructionsLabel, this.zonesContainer, this.endTurnButton, this.progressLabel)

        this.panel.appendChild(this.header)

        this.viewport = document.createElement('div')
        this.viewport.className = 'card-hand-widget__viewport'
        this.viewport.tabIndex = 0
        this.viewport.style.minHeight = `${this.minViewportHeight}px`
        this.viewport.style.flex = '1 1 auto'
        this.viewport.style.maxHeight = '100%'
        this.viewport.addEventListener('wheel', this.handleWheel, { passive: false })
        this.viewport.addEventListener('scroll', this.handleScroll)
        this.viewport.addEventListener('keydown', this.handleKeyDown)
        this.viewport.addEventListener('pointerdown', this.handleViewportPointerDown)
        this.viewport.addEventListener('pointerup', this.handleViewportPointerUp)
        this.viewport.addEventListener('pointermove', this.handleViewportPointerMove)
        this.viewport.addEventListener('focus', () => this.panel.classList.add('card-hand-widget__panel--focused'))
        this.viewport.addEventListener('blur', () => this.panel.classList.remove('card-hand-widget__panel--focused'))

        this.strip = document.createElement('div')
        this.strip.className = 'card-hand-widget__strip'
        this.strip.style.gap = `${this.gap}px`
        this.strip.style.padding = `${this.gap}px 0`

        this.viewport.appendChild(this.strip)
        this.panel.appendChild(this.viewport)

        this.topShade = document.createElement('div')
        this.topShade.className = 'card-hand-widget__shade card-hand-widget__shade--top'

        this.bottomShade = document.createElement('div')
        this.bottomShade.className = 'card-hand-widget__shade card-hand-widget__shade--bottom'

        this.upButton = document.createElement('button')
        this.upButton.type = 'button'
        this.upButton.className = 'card-hand-widget__nav card-hand-widget__nav--up'
        this.upButton.setAttribute('aria-label', 'Прокрутить вверх')
        this.upButton.textContent = '↑'
        this.upButton.addEventListener('click', () => this.nudge(-1))

        this.downButton = document.createElement('button')
        this.downButton.type = 'button'
        this.downButton.className = 'card-hand-widget__nav card-hand-widget__nav--down'
        this.downButton.setAttribute('aria-label', 'Прокрутить вниз')
        this.downButton.textContent = '↓'
        this.downButton.addEventListener('click', () => this.nudge(1))

        this.panel.append(this.topShade, this.bottomShade, this.upButton, this.downButton)

        const initialCards = options.cards ?? []
        if (initialCards.length > 0) {
            this.setCards(initialCards)
        } else {
            this.updateEmptyState()
        }

        this.initializeResizeHandling()
        this.updateViewportHeight()
    }

    addCard(card: CardHandCard) {
        const internalCard = this.prepareCard(card)
        this.cards.push(internalCard)
        this.appendCard(internalCard, this.cards.length - 1, true)
        this.refreshCardIndices()
        this.updateLayout()
        this.updateEmptyState()
        this.scrollToCard(internalCard.instanceId)
        this.emitViewport()
    }

    focus() {
        this.viewport.focus()
    }

    setCards(cards: CardHandCard[]) {
        this.cards = cards.map((card) => this.prepareCard(card))
        this.cardElements.clear()
        this.strip.innerHTML = ''

        if (this.cards.length === 0) {
            this.updateEmptyState()
            this.emitViewport()
            return
        }

        this.cards.forEach((card, index) => this.appendCard(card, index, false))
        this.refreshCardIndices()
        this.updateLayout()
        this.updateEmptyState()
        this.emitViewport()
    }

    setDeckInfo(info?: CardHandDeckInfo | null) {
        if (!info) {
            this.zonesContainer.style.display = 'none'
            return
        }

        this.zonesContainer.style.display = 'flex'
        this.deckCountLabel.textContent = String(info.drawPileCount)
        this.discardCountLabel.textContent = String(info.discardPileCount)
        this.deckChip.title = `В колоде: ${info.drawPileCount}`
        this.discardChip.title = `В сбросе: ${info.discardPileCount}`
        this.updateChipEmptyState(this.deckChip, info.drawPileCount === 0)
        this.updateChipEmptyState(this.discardChip, info.discardPileCount === 0)
    }

    removeCard(id: string) {
        const index = this.cards.findIndex((card) => card.instanceId === id)
        if (index === -1) {
            return
        }

        this.cards.splice(index, 1)
        const element = this.cardElements.get(id)
        if (element) {
            element.classList.add('card-hand-widget__card-wrapper--leaving')
            const handleAnimationEnd = () => {
                element.removeEventListener('animationend', handleAnimationEnd)
                element.remove()
                this.cardElements.delete(id)
                this.refreshCardIndices()
                this.updateLayout()
                this.emitViewport()
                if (this.cards.length === 0) {
                    this.updateEmptyState()
                }
            }
            element.addEventListener('animationend', handleAnimationEnd)
        } else if (this.cards.length === 0) {
            this.updateEmptyState()
        }
    }

    destroy() {
        this.viewport.removeEventListener('wheel', this.handleWheel)
        this.viewport.removeEventListener('scroll', this.handleScroll)
        this.viewport.removeEventListener('keydown', this.handleKeyDown)
        this.viewport.removeEventListener('pointerdown', this.handleViewportPointerDown)
        this.viewport.removeEventListener('pointerup', this.handleViewportPointerUp)
        this.viewport.removeEventListener('pointermove', this.handleViewportPointerMove)
        this.endTurnButton.removeEventListener('click', this.handleEndTurnClick)

        if (this.resizeObserver) {
            this.resizeObserver.disconnect()
        }
        if (this.removeWindowResizeListener) {
            this.removeWindowResizeListener()
            this.removeWindowResizeListener = undefined
        }

        if (this.scrollSnapTimer) {
            window.clearTimeout(this.scrollSnapTimer)
        }

        document.removeEventListener('pointermove', this.handleDocumentPointerMove)
        document.removeEventListener('pointerup', this.handleDocumentPointerUp)
        document.removeEventListener('pointercancel', this.handleDocumentPointerUp)

        this.clearActiveDrag()

        if (this.ownsRoot) {
            this.root.remove()
        } else {
            this.root.innerHTML = ''
        }
    }

    private appendCard(card: InternalCard, index: number, animate: boolean) {
        const wrapper = document.createElement('div')
        wrapper.className = 'card-hand-widget__card-wrapper'
        if (animate) {
            wrapper.classList.add('card-hand-widget__card-wrapper--enter')
        }
        wrapper.dataset.id = card.instanceId
        wrapper.dataset.index = String(index)
        wrapper.style.width = '100%'
        wrapper.style.flex = '0 0 auto'
        wrapper.style.scrollSnapAlign = 'start'

        const button = document.createElement('button')
        button.type = 'button'
        button.className = 'card-hand-widget__card'
        button.setAttribute('data-card-button', 'true')
        button.dataset.cardEffect = card.effect
        button.dataset.cardType = card.id
        button.style.width = '100%'
        button.style.maxWidth = `${this.cardWidth}px`
        button.style.margin = '0 auto'
        button.style.minHeight = `${this.cardHeight}px`
        button.addEventListener('pointerdown', (event) => this.handleCardPointerDown(card, event))

        const cardInner = document.createElement('div')
        cardInner.className = 'card-hand-widget__card-inner'

        const header = document.createElement('div')
        header.className = 'card-hand-widget__card-header'

        const title = document.createElement('div')
        title.className = 'card-hand-widget__title'
        title.textContent = card.title
        title.title = card.title

        const cost = document.createElement('div')
        cost.className = 'card-hand-widget__cost-chip'
        cost.textContent = String(card.cost)
        cost.title = `Стоимость: ${card.cost}`

        header.append(title, cost)

        const body = document.createElement('div')
        body.className = 'card-hand-widget__card-body'

        if (card.description?.trim()) {
            const flavor = document.createElement('div')
            flavor.className = 'card-hand-widget__flavor'
            flavor.textContent = card.description
            flavor.title = card.description
            body.append(flavor)
        }

        const effect = document.createElement('div')
        effect.className = 'card-hand-widget__effect'

        const effectLabel = document.createElement('span')
        effectLabel.textContent = 'Эффект'

        const effectText = document.createElement('p')
        effectText.className = 'card-hand-widget__effect-text'
        effectText.textContent = this.getEffectDescription(card.effect)

        effect.append(effectLabel, effectText)
        body.append(effect)

        cardInner.append(header, body)

        button.append(cardInner)

        wrapper.appendChild(button)
        this.strip.appendChild(wrapper)

        const baseHeight = this.cardHeight
        const contentHeight = Math.ceil(cardInner.scrollHeight)
        button.style.height = `${Math.max(baseHeight, contentHeight)}px`

        this.cardElements.set(card.instanceId, wrapper)
    }

    private refreshCardIndices() {
        this.cards.forEach((card, index) => {
            const element = this.cardElements.get(card.instanceId)
            if (element) {
                element.dataset.index = String(index)
            }
        })
    }

    private handleWheel = (event: WheelEvent) => {
        if (event.ctrlKey) {
            return
        }
        event.preventDefault()
        const dominantDelta = Math.abs(event.deltaY) >= Math.abs(event.deltaX) ? event.deltaY : event.deltaX
        this.viewport.scrollTop += dominantDelta
        this.scheduleSnap()
        this.emitViewport()
    }

    private handleScroll = () => {
        this.updateIndicators()
        this.emitViewport()
    }

    private handleKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'ArrowDown') {
            event.preventDefault()
            this.nudge(1)
        } else if (event.key === 'ArrowUp') {
            event.preventDefault()
            this.nudge(-1)
        }
    }
    private handleEndTurnClick = async () => {
        if (!this.onEndTurn || this.endTurnPending) {
            return
        }

        this.endTurnPending = true
        this.endTurnButton.disabled = true
        this.endTurnButton.classList.add('card-hand-widget__end-turn--pending')

        try {
            await this.onEndTurn()
        } catch (error) {
            console.error('CardHand: failed to end turn', error)
        } finally {
            this.endTurnPending = false
            this.endTurnButton.disabled = false
            this.endTurnButton.classList.remove('card-hand-widget__end-turn--pending')
        }
    }
    private handleCardPointerDown(card: InternalCard, event: PointerEvent) {
        if (event.pointerType === 'mouse' && event.button !== 0) {
            return
        }

        const button = event.currentTarget as HTMLElement | null
        const wrapper = button?.closest('.card-hand-widget__card-wrapper') as HTMLDivElement | null
        if (!wrapper) {
            return
        }

        event.preventDefault()
        event.stopPropagation()

        if (this.activeDrag) {
            this.cancelActiveDrag()
        }

        const rect = wrapper.getBoundingClientRect()
        const { arrow, head } = this.createDragArrowElements()

        this.activeDrag = {
            pointerId: event.pointerId,
            card,
            wrapper,
            startX: rect.left + rect.width / 2,
            startY: rect.top + rect.height / 2,
            arrow,
            head,
            thresholdPassed: false,
            originPointerX: event.clientX,
            originPointerY: event.clientY,
        }

        document.addEventListener('pointermove', this.handleDocumentPointerMove)
        document.addEventListener('pointerup', this.handleDocumentPointerUp)
        document.addEventListener('pointercancel', this.handleDocumentPointerUp)
    }

    private handleViewportPointerDown = (event: PointerEvent) => {
        if (event.pointerType !== 'touch') {
            return
        }

        this.pointerSwipe = {
            pointerId: event.pointerId,
            lastY: event.clientY,
            velocity: 0,
            lastTime: performance.now(),
        }
        this.viewport.setPointerCapture(event.pointerId)
    }

    private handleViewportPointerMove = (event: PointerEvent) => {
        if (event.pointerType !== 'touch') {
            return
        }

        if (!this.pointerSwipe || this.pointerSwipe.pointerId !== event.pointerId) {
            return
        }

        const dy = event.clientY - this.pointerSwipe.lastY
        const dt = Math.max(1, performance.now() - this.pointerSwipe.lastTime)
        const velocity = dy / dt
        this.pointerSwipe.lastY = event.clientY
        this.pointerSwipe.lastTime = performance.now()
        this.pointerSwipe.velocity = velocity

        this.viewport.scrollTop -= dy
        this.emitViewport()
    }

    private handleViewportPointerUp = (event: PointerEvent) => {
        if (event.pointerType !== 'touch') {
            return
        }

        if (this.pointerSwipe && this.pointerSwipe.pointerId === event.pointerId) {
            if (this.enableTouchInertia) {
                this.startInertiaAnimation(this.pointerSwipe.velocity)
            }
            this.pointerSwipe = undefined
        }
        this.scheduleSnap()
    }

    private handleDocumentPointerMove = (event: PointerEvent) => {
        const drag = this.activeDrag
        if (!drag || drag.pointerId !== event.pointerId) {
            return
        }

        const distance = Math.hypot(event.clientX - drag.originPointerX, event.clientY - drag.originPointerY)
        if (!drag.thresholdPassed && distance > 12) {
            drag.thresholdPassed = true
            drag.wrapper.classList.add('card-hand-widget__card-wrapper--dragging')
            document.body.appendChild(drag.arrow)
            drag.arrow.classList.add('card-hand-widget__drag-arrow--visible')
        }

        if (drag.thresholdPassed) {
            this.updateDragArrowPosition(drag, event.clientX, event.clientY)
        }
    }

    private handleDocumentPointerUp = async (event: PointerEvent) => {
        const drag = this.activeDrag
        if (!drag || drag.pointerId !== event.pointerId) {
            return
        }

        this.stopTrackingPointer()

        const wrapper = drag.wrapper
        const card = drag.card
        const wasDragging = drag.thresholdPassed

        this.clearActiveDrag()

        if (!wasDragging) {
            return
        }

        const territoryElement = this.getTerritoryElementAt(event.clientX, event.clientY)
        if (!territoryElement) {
            this.applyCardError(wrapper)
            this.onMoveCardTargetMissing?.(card)
            return
        }

        const territoryId = territoryElement.dataset.territoryId?.trim()
        if (!territoryId) {
            this.applyCardError(wrapper)
            this.onMoveCardDropFailure?.(card, '', 'Не удалось определить локацию')
            return
        }

        await this.resolveMoveDrop(card, territoryId, wrapper)
    }

    private cancelActiveDrag() {
        this.stopTrackingPointer()
        this.clearActiveDrag()
    }

    private stopTrackingPointer() {
        document.removeEventListener('pointermove', this.handleDocumentPointerMove)
        document.removeEventListener('pointerup', this.handleDocumentPointerUp)
        document.removeEventListener('pointercancel', this.handleDocumentPointerUp)
    }

    private clearActiveDrag() {
        if (!this.activeDrag) {
            return
        }
        this.activeDrag.wrapper.classList.remove('card-hand-widget__card-wrapper--dragging')
        this.activeDrag.arrow.remove()
        this.activeDrag = undefined
    }

    private createDragArrowElements(): { arrow: HTMLDivElement; head: HTMLDivElement } {
        const arrow = document.createElement('div')
        arrow.className = 'card-hand-widget__drag-arrow'

        const head = document.createElement('div')
        head.className = 'card-hand-widget__drag-arrow-head'
        arrow.appendChild(head)

        return { arrow, head }
    }

    private updateDragArrowPosition(drag: ActiveCardDrag, clientX: number, clientY: number) {
        const dx = clientX - drag.startX
        const dy = clientY - drag.startY
        const distance = Math.max(0, Math.hypot(dx, dy))
        const angle = Math.atan2(dy, dx)

        drag.arrow.style.width = `${distance}px`
        drag.arrow.style.transform = `translate(${drag.startX}px, ${drag.startY}px) rotate(${angle}rad)`
        drag.head.style.transform = `translate(-50%, -50%) rotate(${angle}rad)`
    }

    private getTerritoryElementAt(clientX: number, clientY: number): HTMLDivElement | null {
        const element = document.elementFromPoint(clientX, clientY) as HTMLElement | null
        return element?.closest('.map-territory') as HTMLDivElement | null
    }

    private async resolveMoveDrop(card: InternalCard, territoryId: string, wrapper: HTMLDivElement) {
        if (!this.onMoveCardDrop) {
            console.warn('CardHand: onMoveCardDrop handler is not provided.')
            this.applyCardError(wrapper)
            return
        }

        try {
            const result = await this.onMoveCardDrop(card, territoryId)
            if (result && result.status === 'success') {
                this.onCardConsumed?.(card)
                this.removeCard(card.instanceId)
                return
            }

            const message = result?.message
            this.onMoveCardDropFailure?.(card, territoryId, message)
            this.applyCardError(wrapper)
        } catch (error) {
            const message = error instanceof Error ? error.message : undefined
            console.error('CardHand: failed to resolve move drop', error)
            this.onMoveCardDropFailure?.(card, territoryId, message)
            this.applyCardError(wrapper)
        }
    }

    private applyCardError(wrapper: HTMLDivElement) {
        wrapper.classList.add('card-hand-widget__card-wrapper--error')
        window.setTimeout(() => {
            wrapper.classList.remove('card-hand-widget__card-wrapper--error')
        }, 360)
    }

    private startInertiaAnimation(initialVelocity: number) {
        if (Math.abs(initialVelocity) < 0.001) {
            this.scheduleSnap()
            return
        }

        let velocity = initialVelocity * 24 // adjust for px per frame
        let lastTime = performance.now()
        const friction = 0.92

        const step = (time: number) => {
            const dt = time - lastTime
            lastTime = time

            this.viewport.scrollTop -= velocity * dt * 0.06
            velocity *= friction

            if (Math.abs(velocity) > 0.05) {
                requestAnimationFrame(step)
            } else {
                this.scheduleSnap()
            }
            this.emitViewport()
        }

        requestAnimationFrame(step)
    }

    private updateLayout() {
        this.strip.classList.remove('card-hand-widget__strip--centered')
        this.updateIndicators()
        this.updateEmptyState()
    }

    private updateIndicators() {
        const maxScroll = Math.max(0, this.viewport.scrollHeight - this.viewport.clientHeight)
        const topVisible = this.viewport.scrollTop > 4
        const bottomVisible = this.viewport.scrollTop < maxScroll - 4

        this.topShade.classList.toggle('card-hand-widget__shade--visible', topVisible)
        this.bottomShade.classList.toggle('card-hand-widget__shade--visible', bottomVisible)
        this.upButton.classList.toggle('card-hand-widget__nav--visible', topVisible)
        this.downButton.classList.toggle('card-hand-widget__nav--visible', bottomVisible)

        const visibleCount = this.getVisibleCount()
        if (this.cards.length > 20 && visibleCount > 0) {
            const pages = Math.max(1, Math.ceil(this.cards.length / visibleCount))
            const currentPage = Math.min(pages, Math.max(1, Math.floor(this.getFirstVisibleIndex() / visibleCount) + 1))
            this.progressLabel.textContent = `${currentPage} / ${pages}`
            this.progressLabel.style.display = 'block'
        } else {
            this.progressLabel.style.display = 'none'
        }
    }

    private updateEmptyState() {
        if (this.cards.length > 0) {
            this.viewport.classList.remove('card-hand-widget__viewport--empty')
            this.viewport.setAttribute('aria-label', 'Рука игрока')
            const placeholder = this.viewport.querySelector('.card-hand-widget__empty')
            if (placeholder) {
                placeholder.remove()
            }
            if (!this.viewport.contains(this.strip)) {
                this.viewport.appendChild(this.strip)
            }
            return
        }

        this.viewport.classList.add('card-hand-widget__viewport--empty')
        this.viewport.setAttribute('aria-label', 'Рука пуста')
        if (!this.viewport.querySelector('.card-hand-widget__empty')) {
            const placeholder = document.createElement('div')
            placeholder.className = 'card-hand-widget__empty'
            placeholder.textContent = 'Рука пуста'
            this.viewport.innerHTML = ''
            this.viewport.appendChild(placeholder)
        }
    }

    private emitViewport() {
        if (!this.onViewportChange) {
            return
        }
        const start = this.getFirstVisibleIndex()
        const visibleCount = this.getVisibleCount()
        const end = Math.min(this.cards.length - 1, start + visibleCount - 1)
        if (this.cards.length === 0) {
            this.onViewportChange({ start: 0, end: -1 })
            return
        }
        this.onViewportChange({ start, end })
    }

    private getVisibleCount(): number {
        const pitch = this.cardHeight + this.gap
        if (pitch <= 0) {
            return 1
        }
        return Math.max(1, Math.floor((this.viewport.clientHeight + this.gap) / pitch))
    }

    private getFirstVisibleIndex(): number {
        const pitch = this.cardHeight + this.gap
        return Math.max(0, Math.floor(this.viewport.scrollTop / pitch))
    }

    private nudge(direction: number) {
        const pitch = this.cardHeight + this.gap
        this.viewport.scrollBy({ top: direction * pitch, behavior: 'smooth' })
        this.scheduleSnap()
    }

    private scheduleSnap() {
        if (this.scrollSnapTimer) {
            window.clearTimeout(this.scrollSnapTimer)
        }
        this.scrollSnapTimer = window.setTimeout(() => {
            this.snapToNearest()
        }, 160)
    }

    private snapToNearest() {
        if (this.cards.length === 0) {
            return
        }
        const pitch = this.cardHeight + this.gap
        const scroll = this.viewport.scrollTop
        const center = scroll + this.viewport.clientHeight / 2
        const index = Math.round((center - this.cardHeight / 2) / pitch)
        const clamped = Math.max(0, Math.min(this.cards.length - 1, index))
        const target = clamped * pitch
        this.viewport.scrollTo({ top: target, behavior: 'smooth' })
    }

    private scrollToCard(id: string) {
        const index = this.cards.findIndex((card) => card.instanceId === id)
        if (index === -1) {
            return
        }
        const pitch = this.cardHeight + this.gap
        const target = index * pitch
        const offset = target - (this.viewport.clientHeight - this.cardHeight) / 2
        this.viewport.scrollTo({ top: Math.max(0, offset), behavior: 'smooth' })
        this.scheduleSnap()
    }

    private prepareCard(card: CardHandCard): InternalCard {
        const providedId = card.instanceId?.trim()
        const instanceId = providedId && providedId.length > 0 ? providedId : this.generateInstanceId(card.id)
        return { ...card, instanceId }
    }

    private updateChipEmptyState(chip: HTMLDivElement, isEmpty: boolean) {
        chip.classList.toggle('card-hand-widget__chip--empty', isEmpty)
    }

    private getEffectDescription(effect: CardEffect): string {
        switch (effect) {
            case 'move':
                return 'Переместитесь в соседнюю область.'
            case 'attack':
                return 'Атакуйте угрозу поблизости.'
            case 'hide':
                return 'Сокройтесь от взгляда врагов.'
            case 'search':
                return 'Исследуйте местность и найдите улики.'
            case 'evade':
                return 'Сбросьте внимание одного врага и выйдите из боя.'
            case 'smoke':
                return 'Ослепите всех врагов дымом и выйдите из боя, получив 1 урон.'
            case 'heal':
                return 'Восстановите 2 единицы здоровья, перевязав раны.'
        }
    }

    private createZoneChip(label: string, modifier?: string): ZoneChipElements {
        const chip = document.createElement('div')
        chip.className = 'card-hand-widget__chip'
        if (modifier) {
            chip.classList.add(`card-hand-widget__chip--${modifier}`)
        }

        const labelSpan = document.createElement('span')
        labelSpan.className = 'card-hand-widget__chip-label'
        labelSpan.textContent = label

        const countSpan = document.createElement('span')
        countSpan.className = 'card-hand-widget__chip-value'
        countSpan.textContent = '0'

        chip.append(labelSpan, countSpan)

        return { element: chip, count: countSpan }
    }

    private generateInstanceId(baseId: string): string {
        const normalized = baseId?.trim() ? baseId.trim() : 'card'
        const counter = this.instanceIdCounter++
        if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
            return `${normalized}::${counter}::${crypto.randomUUID()}`
        }
        const randomPart = Math.random().toString(36).slice(2, 10)
        const timestamp = Date.now().toString(36)
        return `${normalized}::${counter}::${timestamp}${randomPart}`
    }

    private createOverlayRoot(): HTMLElement {
        const root = document.createElement('div')
        root.className = 'card-hand-widget__overlay-root'
        document.body.appendChild(root)
        return root
    }

    private initializeResizeHandling() {
        if (typeof ResizeObserver !== 'undefined') {
            this.resizeObserver = new ResizeObserver(() => {
                this.updateViewportHeight()
            })
            this.resizeObserver.observe(this.panel)
        } else {
            const listener = () => this.updateViewportHeight()
            window.addEventListener('resize', listener)
            this.removeWindowResizeListener = () => window.removeEventListener('resize', listener)
        }
    }

    private updateViewportHeight = () => {
        const panelHeight = this.panel.clientHeight
        if (!panelHeight) {
            return
        }
        const style = window.getComputedStyle(this.panel)
        const paddingTop = parseFloat(style.paddingTop) || 0
        const paddingBottom = parseFloat(style.paddingBottom) || 0
        const gap = parseFloat(style.rowGap || style.gap || '0') || 0
        const available = panelHeight - paddingTop - paddingBottom - this.header.offsetHeight - gap
        const target = Math.max(this.minViewportHeight, available)
        if (Number.isFinite(target)) {
            this.viewport.style.height = `${target}px`
        }
    }

    private static injectStyles() {
        if (this.stylesInjected) {
            return
        }
        const style = document.createElement('style')
        style.textContent = `
            .card-hand-widget__overlay-root {
                position: fixed;
                inset: 0;
                display: flex;
                align-items: flex-end;
                justify-content: center;
                padding: 16px;
                pointer-events: none;
                z-index: 2000;
            }

            .card-hand-widget__overlay-root > * {
                pointer-events: auto;
            }

            .card-hand-widget__panel {
                position: relative;
                display: flex;
                flex-direction: column;
                gap: 8px;
                padding: 12px 14px 16px;
                background: rgba(11, 15, 25, 0.9);
                border: 1px solid rgba(148, 163, 184, 0.3);
                border-radius: 18px;
                color: #f8fafc;
                box-shadow: 0 28px 48px rgba(15, 23, 42, 0.55);
            }

            .card-hand-widget__panel--translucent {
                backdrop-filter: blur(16px);
            }

            .card-hand-widget__panel--focused {
                box-shadow: 0 32px 64px rgba(15, 23, 42, 0.6);
            }

            .card-hand-widget__header {
                display: flex;
                align-items: center;
                gap: 8px;
            }

            .card-hand-widget__instructions {
                font-size: 13px;
                color: rgba(226, 232, 240, 0.72);
                flex: 1;
                min-width: 0;
                text-overflow: ellipsis;
                overflow: hidden;
                white-space: nowrap;
            }

            .card-hand-widget__zones {
                display: none;
                align-items: center;
                gap: 6px;
                flex-shrink: 0;
            }

            .card-hand-widget__chip {
                display: inline-flex;
                align-items: center;
                gap: 4px;
                padding: 3px 8px;
                border-radius: 999px;
                border: 1px solid rgba(148, 163, 184, 0.35);
                background: rgba(30, 41, 59, 0.6);
                font-size: 12px;
                color: rgba(226, 232, 240, 0.85);
                transition: opacity 160ms ease;
            }

            .card-hand-widget__chip-label {
                font-weight: 500;
                letter-spacing: 0.02em;
            }

            .card-hand-widget__chip-value {
                font-weight: 600;
                color: #f8fafc;
            }

            .card-hand-widget__chip--deck {
                background: rgba(30, 64, 175, 0.45);
                border-color: rgba(129, 161, 193, 0.4);
            }

            .card-hand-widget__chip--discard {
                background: rgba(94, 51, 73, 0.55);
                border-color: rgba(244, 114, 182, 0.35);
            }

            .card-hand-widget__chip--empty {
                opacity: 0.65;
            }

            .card-hand-widget__end-turn {
                flex-shrink: 0;
                border-radius: 999px;
                border: 1px solid rgba(250, 204, 21, 0.4);
                background: rgba(250, 204, 21, 0.12);
                color: rgba(254, 249, 195, 0.95);
                font-size: 12px;
                font-weight: 600;
                letter-spacing: 0.05em;
                text-transform: uppercase;
                padding: 6px 14px;
                transition: transform 120ms ease, box-shadow 120ms ease, background 120ms ease, border-color 120ms ease;
                cursor: pointer;
            }

            .card-hand-widget__end-turn:hover {
                background: rgba(250, 204, 21, 0.2);
                border-color: rgba(250, 204, 21, 0.55);
                box-shadow: 0 8px 18px rgba(250, 204, 21, 0.18);
                transform: translateY(-1px);
            }

            .card-hand-widget__end-turn:focus-visible {
                outline: none;
                box-shadow: 0 0 0 2px rgba(250, 204, 21, 0.45);
            }

            .card-hand-widget__end-turn:disabled {
                opacity: 0.55;
                cursor: not-allowed;
                box-shadow: none;
                transform: none;
            }

            .card-hand-widget__end-turn--pending {
                opacity: 0.75;
            }

            .card-hand-widget__progress {
                margin-left: auto;
                font-size: 12px;
                opacity: 0.75;
                display: none;
            }

            .card-hand-widget__viewport {
                position: relative;
                overflow-x: hidden;
                overflow-y: auto;
                border-radius: 16px;
                background: rgba(15, 23, 42, 0.55);
                border: 1px solid rgba(148, 163, 184, 0.25);
                outline: none;
            }

            .card-hand-widget__viewport:focus-visible {
                box-shadow: 0 0 0 2px rgba(250, 204, 21, 0.45);
            }

            .card-hand-widget__viewport--empty {
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 16px;
                color: rgba(226, 232, 240, 0.8);
            }

            .card-hand-widget__viewport::-webkit-scrollbar {
                display: none;
            }

            .card-hand-widget__empty {
                animation: card-hand-widget__pulse 1.6s ease-in-out infinite;
            }

            @keyframes card-hand-widget__pulse {
                0%, 100% { opacity: 0.55; }
                50% { opacity: 1; }
            }

            .card-hand-widget__strip {
                display: flex;
                flex-direction: column;
                align-items: stretch;
                position: relative;
                width: 100%;
                min-height: 100%;
                transition: transform 0.3s ease;
            }

            .card-hand-widget__strip--centered {
                align-items: center;
            }

            .card-hand-widget__card-wrapper {
                position: relative;
                display: flex;
                justify-content: center;
                align-items: center;
                transition: transform 0.2s ease, filter 0.2s ease;
            }

            .card-hand-widget__card-wrapper--enter {
                animation: card-hand-widget__enter 0.4s ease;
            }

            .card-hand-widget__card-wrapper--leaving {
                animation: card-hand-widget__leave 0.4s ease forwards;
            }

            @keyframes card-hand-widget__enter {
                0% { transform: translateY(40px) scale(0.85); opacity: 0; }
                60% { transform: translateY(-4px) scale(1.05); opacity: 1; }
                100% { transform: translateY(0) scale(1); }
            }

            @keyframes card-hand-widget__leave {
                0% { transform: translateY(0) scale(1); opacity: 1; }
                100% { transform: translateY(-120px) scale(0.85); opacity: 0; }
            }

            .card-hand-widget__card {
                width: 100%;
                background: transparent;
                border: none;
                padding: 0;
                cursor: grab;
                font: inherit;
                color: inherit;
            }

            .card-hand-widget__card:focus-visible {
                outline: none;
            }

            .card-hand-widget__card:active {
                cursor: grabbing;
            }

            .card-hand-widget__card-inner {
                position: relative;
                display: flex;
                flex-direction: column;
                gap: 16px;
                height: 100%;
                border-radius: 14px;
                border: 1px solid rgba(148, 163, 184, 0.35);
                background: rgba(15, 23, 42, 0.92);
                box-shadow: 0 ${CARD_ELEVATION}px 24px rgba(15, 23, 42, 0.35);
                padding: 18px 20px;
                transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
            }

            .card-hand-widget__card:hover .card-hand-widget__card-inner,
            .card-hand-widget__card:focus-visible .card-hand-widget__card-inner {
                transform: translateY(-6px);
                border-color: rgba(165, 243, 252, 0.55);
                box-shadow: 0 18px 32px rgba(15, 23, 42, 0.4);
            }

            .card-hand-widget__card-wrapper--dragging .card-hand-widget__card-inner {
                transform: translateY(-10px);
                border-color: rgba(250, 204, 21, 0.7);
                box-shadow: 0 20px 34px rgba(250, 204, 21, 0.2);
            }

            .card-hand-widget__card-wrapper--dragging::after {
                content: '';
                position: absolute;
                inset: -6px;
                border-radius: 18px;
                border: 1px dashed rgba(250, 204, 21, 0.5);
                pointer-events: none;
            }

            .card-hand-widget__card-wrapper--error {
                animation: card-hand-widget__shake 0.4s ease;
            }

            .card-hand-widget__card-wrapper--error .card-hand-widget__card-inner {
                border-color: rgba(248, 113, 113, 0.85);
                box-shadow: 0 0 0 1px rgba(248, 113, 113, 0.35);
            }

            .card-hand-widget__card-body {
                display: flex;
                flex-direction: column;
                gap: 12px;
                color: rgba(226, 232, 240, 0.92);
            }

            .card-hand-widget__card-header {
                display: flex;
                align-items: flex-start;
                justify-content: space-between;
                gap: 12px;
            }

            .card-hand-widget__title {
                font-size: 18px;
                font-weight: 600;
                line-height: 1.25;
                letter-spacing: 0.01em;
                text-align: left;
                text-transform: none;
            }

            .card-hand-widget__flavor {
                font-size: 14px;
                line-height: 1.55;
                color: rgba(226, 232, 240, 0.82);
                text-align: left;
                white-space: pre-line;
            }

            .card-hand-widget__effect {
                display: flex;
                flex-direction: column;
                gap: 6px;
                font-size: 14px;
                line-height: 1.55;
                padding: 12px 14px;
                border-radius: 10px;
                border: 1px solid rgba(148, 163, 184, 0.25);
                background: rgba(30, 41, 59, 0.65);
                color: rgba(226, 232, 240, 0.95);
                text-align: left;
            }

            .card-hand-widget__effect span {
                font-size: 11px;
                font-weight: 700;
                letter-spacing: 0.12em;
                text-transform: uppercase;
                color: rgba(191, 219, 254, 0.75);
            }

            .card-hand-widget__effect-text {
                margin: 0;
                font-size: 14px;
                white-space: pre-line;
            }

            .card-hand-widget__cost-chip {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                padding: 6px 12px;
                border-radius: 8px;
                border: 1px solid rgba(148, 163, 184, 0.35);
                background: rgba(71, 85, 105, 0.35);
                font-weight: 600;
                font-size: 14px;
                color: rgba(226, 232, 240, 0.95);
                letter-spacing: 0.05em;
                flex-shrink: 0;
            }

            @keyframes card-hand-widget__shake {
                0% { transform: translateX(0); }
                20% { transform: translateX(-6px); }
                40% { transform: translateX(6px); }
                60% { transform: translateX(-4px); }
                80% { transform: translateX(4px); }
                100% { transform: translateX(0); }
            }

            .card-hand-widget__shade {
                position: absolute;
                left: 0;
                right: 0;
                height: 72px;
                pointer-events: none;
                opacity: 0;
                transition: opacity 0.2s ease;
            }

            .card-hand-widget__shade--top {
                top: 0;
                background: linear-gradient(180deg, rgba(9, 13, 24, 0.7), transparent);
            }

            .card-hand-widget__shade--bottom {
                bottom: 0;
                background: linear-gradient(0deg, rgba(9, 13, 24, 0.7), transparent);
            }

            .card-hand-widget__shade--visible {
                opacity: 1;
            }

            .card-hand-widget__nav {
                position: absolute;
                left: 50%;
                transform: translate(-50%, 0);
                background: rgba(15, 23, 42, 0.85);
                border: 1px solid rgba(148, 163, 184, 0.4);
                border-radius: 999px;
                width: 36px;
                height: 36px;
                display: flex;
                align-items: center;
                justify-content: center;
                color: #f8fafc;
                font-size: 18px;
                cursor: pointer;
                opacity: 0;
                transition: opacity 0.2s ease;
            }

            .card-hand-widget__nav--up {
                top: 18px;
            }

            .card-hand-widget__nav--down {
                bottom: 18px;
            }

            .card-hand-widget__nav--visible {
                opacity: 1;
            }

            .card-hand-widget__drag-arrow {
                position: fixed;
                left: 0;
                top: 0;
                height: 4px;
                width: 0;
                background: linear-gradient(90deg, rgba(250, 204, 21, 0.95), rgba(250, 204, 21, 0));
                border-radius: 999px;
                pointer-events: none;
                opacity: 0;
                transform-origin: 0 50%;
                transition: opacity 0.12s ease;
                z-index: 3500;
                box-shadow: 0 0 18px rgba(250, 204, 21, 0.4);
            }

            .card-hand-widget__drag-arrow--visible {
                opacity: 1;
            }

            .card-hand-widget__drag-arrow-head {
                position: absolute;
                right: 0;
                top: 50%;
                width: 14px;
                height: 14px;
                border-radius: 50%;
                background: rgba(250, 204, 21, 0.95);
                box-shadow: 0 0 16px rgba(250, 204, 21, 0.45);
                transform: translate(-50%, -50%);
            }

            @media (max-width: 768px) {
                .card-hand-widget__panel {
                    padding: 10px;
                }
                .card-hand-widget__card {
                    padding: 10px 10px 12px;
                }
                .card-hand-widget__nav {
                    width: 32px;
                    height: 32px;
                }
            }
        `
        document.head.appendChild(style)
        this.stylesInjected = true
    }
}

