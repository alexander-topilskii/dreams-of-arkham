export type CardEffect = 'move' | 'attack' | 'hide' | 'search'

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

export type CardHandOptions = {
    cards?: CardHandCard[]
    height?: number
    cardWidth?: number
    gap?: number
    translucent?: boolean
    enableTouchInertia?: boolean
    onViewportChange?: (viewport: CardHandViewport) => void
    onMoveCardDrop?: (card: CardHandCard, territoryId: string) => CardHandDropResult | Promise<CardHandDropResult>
    onMoveCardDropFailure?: (card: CardHandCard, territoryId: string, message?: string) => void
    onMoveCardTargetMissing?: (card: CardHandCard) => void
    onCardConsumed?: (card: CardHandCard) => void
}

type PointerSwipeState = {
    pointerId: number
    lastX: number
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

export class CardHand {
    private static stylesInjected = false

    private readonly ownsRoot: boolean
    private readonly root: HTMLElement
    private readonly translucent: boolean
    private readonly height: number
    private readonly cardWidth: number
    private readonly gap: number
    private readonly enableTouchInertia: boolean
    private readonly onViewportChange?: (viewport: CardHandViewport) => void
    private readonly onMoveCardDrop?: CardHandOptions['onMoveCardDrop']
    private readonly onMoveCardDropFailure?: CardHandOptions['onMoveCardDropFailure']
    private readonly onMoveCardTargetMissing?: CardHandOptions['onMoveCardTargetMissing']
    private readonly onCardConsumed?: CardHandOptions['onCardConsumed']

    private readonly panel: HTMLDivElement
    private readonly header: HTMLDivElement
    private readonly instructionsLabel: HTMLDivElement
    private readonly progressLabel: HTMLDivElement
    private readonly viewport: HTMLDivElement
    private readonly strip: HTMLDivElement
    private readonly leftShade: HTMLDivElement
    private readonly rightShade: HTMLDivElement
    private readonly leftButton: HTMLButtonElement
    private readonly rightButton: HTMLButtonElement

    private cards: InternalCard[] = []
    private instanceIdCounter = 0
    private readonly cardElements = new Map<string, HTMLDivElement>()
    private pointerSwipe?: PointerSwipeState
    private scrollSnapTimer?: number
    private activeDrag?: ActiveCardDrag

    constructor(root?: HTMLElement | null, options: CardHandOptions = {}) {
        this.ownsRoot = !root
        this.root = root ?? this.createOverlayRoot()
        this.translucent = options.translucent ?? true
        this.height = options.height ?? 300
        this.cardWidth = options.cardWidth ?? 168
        this.gap = options.gap ?? 14
        this.enableTouchInertia = options.enableTouchInertia ?? true
        this.onViewportChange = options.onViewportChange
        this.onMoveCardDrop = options.onMoveCardDrop
        this.onMoveCardDropFailure = options.onMoveCardDropFailure
        this.onMoveCardTargetMissing = options.onMoveCardTargetMissing
        this.onCardConsumed = options.onCardConsumed

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
        this.instructionsLabel.textContent = 'Перетащите карту действия на карту экспедиции'

        this.progressLabel = document.createElement('div')
        this.progressLabel.className = 'card-hand-widget__progress'

        this.header.append(this.instructionsLabel, this.progressLabel)

        this.panel.appendChild(this.header)

        this.viewport = document.createElement('div')
        this.viewport.className = 'card-hand-widget__viewport'
        this.viewport.tabIndex = 0
        this.viewport.style.height = `${this.height}px`
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
        this.strip.style.padding = `0 ${this.gap}px`

        this.viewport.appendChild(this.strip)
        this.panel.appendChild(this.viewport)

        this.leftShade = document.createElement('div')
        this.leftShade.className = 'card-hand-widget__shade card-hand-widget__shade--left'

        this.rightShade = document.createElement('div')
        this.rightShade.className = 'card-hand-widget__shade card-hand-widget__shade--right'

        this.leftButton = document.createElement('button')
        this.leftButton.type = 'button'
        this.leftButton.className = 'card-hand-widget__nav card-hand-widget__nav--left'
        this.leftButton.setAttribute('aria-label', 'Сдвинуть влево')
        this.leftButton.textContent = '←'
        this.leftButton.addEventListener('click', () => this.nudge(-1))

        this.rightButton = document.createElement('button')
        this.rightButton.type = 'button'
        this.rightButton.className = 'card-hand-widget__nav card-hand-widget__nav--right'
        this.rightButton.setAttribute('aria-label', 'Сдвинуть вправо')
        this.rightButton.textContent = '→'
        this.rightButton.addEventListener('click', () => this.nudge(1))

        this.panel.append(this.leftShade, this.rightShade, this.leftButton, this.rightButton)

        const initialCards = options.cards ?? []
        if (initialCards.length > 0) {
            this.setCards(initialCards)
        } else {
            this.updateEmptyState()
        }
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
        wrapper.style.width = `${this.cardWidth}px`
        wrapper.style.flex = `0 0 ${this.cardWidth}px`
        wrapper.style.scrollSnapAlign = 'center'

        const button = document.createElement('button')
        button.type = 'button'
        button.className = 'card-hand-widget__card'
        button.setAttribute('data-card-button', 'true')
        button.dataset.cardEffect = card.effect
        button.dataset.cardType = card.id
        button.style.height = `${Math.floor(this.cardWidth * 1.4)}px`
        button.addEventListener('pointerdown', (event) => this.handleCardPointerDown(card, event))

        const art = document.createElement('div')
        art.className = 'card-hand-widget__art'
        if (card.artUrl) {
            const img = document.createElement('img')
            img.src = card.artUrl
            img.alt = card.title
            art.appendChild(img)
        }

        const meta = document.createElement('div')
        meta.className = 'card-hand-widget__meta'

        const title = document.createElement('div')
        title.className = 'card-hand-widget__title'
        title.textContent = card.title
        title.title = card.title

        const cost = document.createElement('span')
        cost.className = 'card-hand-widget__cost'
        cost.innerHTML = `💠 <strong>${card.cost}</strong>`
        cost.title = `Стоимость: ${card.cost}`

        meta.append(title, cost)

        const description = document.createElement('div')
        description.className = 'card-hand-widget__description'
        description.textContent = card.description
        description.title = card.description

        button.append(art, meta, description)

        wrapper.appendChild(button)
        this.strip.appendChild(wrapper)
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
        const delta = event.deltaY + event.deltaX
        this.viewport.scrollLeft += delta
        this.scheduleSnap()
        this.emitViewport()
    }

    private handleScroll = () => {
        this.updateIndicators()
        this.emitViewport()
    }

    private handleKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'ArrowRight') {
            event.preventDefault()
            this.nudge(1)
        } else if (event.key === 'ArrowLeft') {
            event.preventDefault()
            this.nudge(-1)
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

        if (card.effect !== 'move') {
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
            lastX: event.clientX,
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

        const dx = event.clientX - this.pointerSwipe.lastX
        const dt = Math.max(1, performance.now() - this.pointerSwipe.lastTime)
        const velocity = dx / dt
        this.pointerSwipe.lastX = event.clientX
        this.pointerSwipe.lastTime = performance.now()
        this.pointerSwipe.velocity = velocity

        this.viewport.scrollLeft -= dx
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

            this.viewport.scrollLeft -= velocity * dt * 0.06
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
        const totalWidth = this.cards.length * (this.cardWidth + this.gap) + this.gap
        const viewportWidth = this.viewport.clientWidth
        const shouldCenter = totalWidth < viewportWidth
        this.strip.classList.toggle('card-hand-widget__strip--centered', shouldCenter)
        this.updateIndicators()
        this.updateEmptyState()
    }

    private updateIndicators() {
        const maxScroll = Math.max(0, this.viewport.scrollWidth - this.viewport.clientWidth)
        const leftVisible = this.viewport.scrollLeft > 4
        const rightVisible = this.viewport.scrollLeft < maxScroll - 4

        this.leftShade.classList.toggle('card-hand-widget__shade--visible', leftVisible)
        this.rightShade.classList.toggle('card-hand-widget__shade--visible', rightVisible)
        this.leftButton.classList.toggle('card-hand-widget__nav--visible', leftVisible)
        this.rightButton.classList.toggle('card-hand-widget__nav--visible', rightVisible)

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
        const pitch = this.cardWidth + this.gap
        if (pitch <= 0) {
            return 1
        }
        return Math.max(1, Math.floor((this.viewport.clientWidth + this.gap) / pitch))
    }

    private getFirstVisibleIndex(): number {
        const pitch = this.cardWidth + this.gap
        return Math.max(0, Math.floor(this.viewport.scrollLeft / pitch))
    }

    private nudge(direction: number) {
        const pitch = this.cardWidth + this.gap
        this.viewport.scrollBy({ left: direction * pitch, behavior: 'smooth' })
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
        const pitch = this.cardWidth + this.gap
        const scroll = this.viewport.scrollLeft
        const center = scroll + this.viewport.clientWidth / 2
        const index = Math.round((center - this.cardWidth / 2) / pitch)
        const clamped = Math.max(0, Math.min(this.cards.length - 1, index))
        const target = clamped * pitch
        this.viewport.scrollTo({ left: target, behavior: 'smooth' })
    }

    private scrollToCard(id: string) {
        const index = this.cards.findIndex((card) => card.instanceId === id)
        if (index === -1) {
            return
        }
        const pitch = this.cardWidth + this.gap
        const target = index * pitch
        const offset = target - (this.viewport.clientWidth - this.cardWidth) / 2
        this.viewport.scrollTo({ left: Math.max(0, offset), behavior: 'smooth' })
        this.scheduleSnap()
    }

    private prepareCard(card: CardHandCard): InternalCard {
        const providedId = card.instanceId?.trim()
        const instanceId = providedId && providedId.length > 0 ? providedId : this.generateInstanceId(card.id)
        return { ...card, instanceId }
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
                padding: 24px;
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
                gap: 12px;
                padding: 16px 18px 20px;
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
                gap: 12px;
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

            .card-hand-widget__progress {
                margin-left: auto;
                font-size: 12px;
                opacity: 0.75;
                display: none;
            }

            .card-hand-widget__viewport {
                position: relative;
                overflow-x: hidden;
                overflow-y: visible;
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
                align-items: center;
                position: relative;
                height: 100%;
                min-height: 100%;
                transition: transform 0.3s ease;
            }

            .card-hand-widget__strip--centered {
                justify-content: center;
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
                background: linear-gradient(180deg, rgba(71, 85, 105, 0.45) 0%, rgba(30, 41, 59, 0.9) 100%);
                border: 1px solid rgba(148, 163, 184, 0.3);
                border-radius: 20px;
                padding: 12px 12px 14px;
                color: inherit;
                font-family: inherit;
                display: grid;
                grid-template-rows: minmax(140px, 1fr) auto 1fr;
                gap: 8px;
                cursor: pointer;
                box-shadow: 0 ${CARD_ELEVATION}px 24px rgba(15, 23, 42, 0.35);
                transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;
                overflow: hidden;
            }

            .card-hand-widget__card:hover {
                transform: translateY(-4px) scale(1.05);
                box-shadow: 0 24px 36px rgba(14, 21, 37, 0.55);
                border-color: rgba(250, 204, 21, 0.6);
            }

            .card-hand-widget__card:focus-visible {
                outline: none;
                box-shadow: 0 0 0 3px rgba(250, 204, 21, 0.65);
            }

            .card-hand-widget__card-wrapper--dragging .card-hand-widget__card {
                transform: translateY(-12px) scale(1.08);
                border-color: rgba(250, 204, 21, 0.9);
                box-shadow: 0 30px 46px rgba(250, 204, 21, 0.3);
            }

            .card-hand-widget__card-wrapper--dragging::after {
                content: '';
                position: absolute;
                inset: -6px;
                border-radius: 24px;
                border: 2px solid rgba(250, 204, 21, 0.6);
                pointer-events: none;
                box-shadow: 0 0 32px rgba(250, 204, 21, 0.35);
            }

            .card-hand-widget__card-wrapper--error {
                animation: card-hand-widget__shake 0.4s ease;
            }

            .card-hand-widget__card-wrapper--error .card-hand-widget__card {
                border-color: rgba(248, 113, 113, 0.85);
                box-shadow: 0 24px 34px rgba(248, 113, 113, 0.28);
            }

            .card-hand-widget__card-wrapper--error::after {
                content: '';
                position: absolute;
                inset: -6px;
                border-radius: 24px;
                border: 2px solid rgba(248, 113, 113, 0.6);
                pointer-events: none;
                box-shadow: 0 0 26px rgba(248, 113, 113, 0.3);
            }

            @keyframes card-hand-widget__shake {
                0% { transform: translateX(0); }
                20% { transform: translateX(-6px); }
                40% { transform: translateX(6px); }
                60% { transform: translateX(-4px); }
                80% { transform: translateX(4px); }
                100% { transform: translateX(0); }
            }

            .card-hand-widget__art {
                border-radius: 16px;
                overflow: hidden;
                background: linear-gradient(135deg, rgba(96, 165, 250, 0.45), rgba(37, 99, 235, 0.75));
            }

            .card-hand-widget__art img {
                width: 100%;
                height: 100%;
                object-fit: cover;
                display: block;
            }

            .card-hand-widget__title {
                font-size: 15px;
                font-weight: 600;
                letter-spacing: 0.01em;
                text-align: left;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }

            .card-hand-widget__meta {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 8px;
            }

            .card-hand-widget__cost {
                display: inline-flex;
                align-items: center;
                gap: 4px;
                font-size: 13px;
                font-weight: 600;
                padding: 2px 8px;
                border-radius: 999px;
                background: rgba(59, 130, 246, 0.18);
                border: 1px solid rgba(59, 130, 246, 0.3);
                box-shadow: inset 0 1px 0 rgba(148, 197, 255, 0.2);
            }

            .card-hand-widget__cost strong {
                font-weight: 700;
            }

            .card-hand-widget__description {
                font-size: 13px;
                line-height: 1.45;
                opacity: 0.88;
                text-align: left;
                display: -webkit-box;
                -webkit-line-clamp: 4;
                -webkit-box-orient: vertical;
                overflow: hidden;
            }

            .card-hand-widget__shade {
                position: absolute;
                top: 0;
                bottom: 0;
                width: 64px;
                pointer-events: none;
                opacity: 0;
                transition: opacity 0.2s ease;
            }

            .card-hand-widget__shade--left {
                left: 0;
                background: linear-gradient(90deg, rgba(9, 13, 24, 0.7), transparent);
            }

            .card-hand-widget__shade--right {
                right: 0;
                background: linear-gradient(270deg, rgba(9, 13, 24, 0.7), transparent);
            }

            .card-hand-widget__shade--visible {
                opacity: 1;
            }

            .card-hand-widget__nav {
                position: absolute;
                top: 50%;
                transform: translateY(-50%);
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

            .card-hand-widget__nav--left {
                left: 12px;
            }

            .card-hand-widget__nav--right {
                right: 12px;
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
                    padding: 12px;
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

