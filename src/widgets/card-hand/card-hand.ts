export type CardHandCard = {
    id: string
    title: string
    power: number
    health: number
    effect?: string
    artUrl?: string
}

export type CardHandViewport = {
    start: number
    end: number
}

export type CardHandOptions = {
    cards?: CardHandCard[]
    height?: number
    cardWidth?: number
    gap?: number
    translucent?: boolean
    enableTouchInertia?: boolean
    onSelectionChange?: (ids: string[]) => void
    onViewportChange?: (viewport: CardHandViewport) => void
}

type SelectionMode = {
    anchorId: string | null
    lastRangeIds: Set<string>
}

type PointerSwipeState = {
    pointerId: number
    lastX: number
    velocity: number
    lastTime: number
}

type DragSelectionState = {
    pointerId: number
    originX: number
    originY: number
    rect: HTMLDivElement
}

const LONG_PRESS_DURATION = 500
const CARD_ELEVATION = 10

export class CardHand {
    private static stylesInjected = false

    private readonly ownsRoot: boolean
    private readonly root: HTMLElement
    private readonly translucent: boolean
    private readonly height: number
    private readonly cardWidth: number
    private readonly gap: number
    private readonly enableTouchInertia: boolean
    private readonly onSelectionChange?: (ids: string[]) => void
    private readonly onViewportChange?: (viewport: CardHandViewport) => void

    private readonly panel: HTMLDivElement
    private readonly header: HTMLDivElement
    private readonly counterButton: HTMLButtonElement
    private readonly clearButton: HTMLButtonElement
    private readonly progressLabel: HTMLDivElement
    private readonly viewport: HTMLDivElement
    private readonly strip: HTMLDivElement
    private readonly leftShade: HTMLDivElement
    private readonly rightShade: HTMLDivElement
    private readonly leftButton: HTMLButtonElement
    private readonly rightButton: HTMLButtonElement

    private cards: CardHandCard[] = []
    private readonly cardElements = new Map<string, HTMLDivElement>()
    private readonly selectedIds = new Set<string>()
    private selectionMode: SelectionMode = { anchorId: null, lastRangeIds: new Set() }
    private readonly longPressTimers = new Map<number, number>()
    private touchSelectionActive = false
    private pointerSwipe?: PointerSwipeState
    private dragSelection?: DragSelectionState
    private scrollSnapTimer?: number

    constructor(root?: HTMLElement | null, options: CardHandOptions = {}) {
        this.ownsRoot = !root
        this.root = root ?? this.createOverlayRoot()
        this.translucent = options.translucent ?? true
        this.height = options.height ?? 300
        this.cardWidth = options.cardWidth ?? 168
        this.gap = options.gap ?? 14
        this.enableTouchInertia = options.enableTouchInertia ?? true
        this.onSelectionChange = options.onSelectionChange
        this.onViewportChange = options.onViewportChange

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

        this.counterButton = document.createElement('button')
        this.counterButton.type = 'button'
        this.counterButton.className = 'card-hand-widget__counter'
        this.counterButton.addEventListener('click', () => {
            this.clearSelection()
        })

        this.clearButton = document.createElement('button')
        this.clearButton.type = 'button'
        this.clearButton.className = 'card-hand-widget__clear'
        this.clearButton.textContent = 'Очистить выбор'
        this.clearButton.addEventListener('click', () => {
            this.clearSelection()
        })

        this.progressLabel = document.createElement('div')
        this.progressLabel.className = 'card-hand-widget__progress'

        this.header.append(this.counterButton, this.progressLabel, this.clearButton)

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
        this.viewport.addEventListener('pointerleave', this.handleViewportPointerLeave)
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
        this.cards.push(card)
        this.appendCard(card, this.cards.length - 1, true)
        this.refreshCardIndices()
        this.updateLayout()
        this.updateSelectionUi()
        this.updateEmptyState()
        this.scrollToCard(card.id)
        this.emitViewport()
    }

    focus() {
        this.viewport.focus()
    }

    setCards(cards: CardHandCard[]) {
        this.cards = cards.map((card) => ({ ...card }))
        this.cardElements.clear()
        this.strip.innerHTML = ''
        this.selectedIds.clear()
        this.selectionMode = { anchorId: null, lastRangeIds: new Set() }

        if (this.cards.length === 0) {
            this.updateSelectionUi()
            this.updateEmptyState()
            this.emitSelection()
            this.emitViewport()
            return
        }

        this.cards.forEach((card, index) => this.appendCard(card, index, false))
        this.refreshCardIndices()
        this.updateLayout()
        this.updateSelectionUi()
        this.updateEmptyState()
        this.emitSelection()
        this.emitViewport()
    }

    removeCard(id: string) {
        const index = this.cards.findIndex((card) => card.id === id)
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

        if (this.selectedIds.has(id)) {
            this.selectedIds.delete(id)
            this.emitSelection()
        }

        this.updateSelectionUi()
    }

    destroy() {
        this.viewport.removeEventListener('wheel', this.handleWheel)
        this.viewport.removeEventListener('scroll', this.handleScroll)
        this.viewport.removeEventListener('keydown', this.handleKeyDown)
        this.viewport.removeEventListener('pointerdown', this.handleViewportPointerDown)
        this.viewport.removeEventListener('pointerup', this.handleViewportPointerUp)
        this.viewport.removeEventListener('pointermove', this.handleViewportPointerMove)
        this.viewport.removeEventListener('pointerleave', this.handleViewportPointerLeave)

        if (this.scrollSnapTimer) {
            window.clearTimeout(this.scrollSnapTimer)
        }

        if (this.ownsRoot) {
            this.root.remove()
        } else {
            this.root.innerHTML = ''
        }
    }

    private appendCard(card: CardHandCard, index: number, animate: boolean) {
        const wrapper = document.createElement('div')
        wrapper.className = 'card-hand-widget__card-wrapper'
        if (animate) {
            wrapper.classList.add('card-hand-widget__card-wrapper--enter')
        }
        wrapper.dataset.id = card.id
        wrapper.dataset.index = String(index)
        wrapper.style.width = `${this.cardWidth}px`
        wrapper.style.flex = `0 0 ${this.cardWidth}px`
        wrapper.style.scrollSnapAlign = 'center'

        const button = document.createElement('button')
        button.type = 'button'
        button.className = 'card-hand-widget__card'
        button.setAttribute('data-card-button', 'true')
        button.style.height = `${Math.floor(this.cardWidth * 1.4)}px`
        button.addEventListener('click', (event) => this.handleCardClick(card, event as MouseEvent))
        button.addEventListener('pointerdown', (event) => this.handleCardPointerDown(card, event))
        button.addEventListener('pointerup', (event) => this.handleCardPointerUp(card, event))
        button.addEventListener('pointercancel', (event) => this.handleCardPointerCancel(event))

        const art = document.createElement('div')
        art.className = 'card-hand-widget__art'
        if (card.artUrl) {
            const img = document.createElement('img')
            img.src = card.artUrl
            img.alt = card.title
            art.appendChild(img)
        }

        const header = document.createElement('div')
        header.className = 'card-hand-widget__title'
        header.textContent = card.title
        header.title = card.title

        const stats = document.createElement('div')
        stats.className = 'card-hand-widget__stats'

        const power = document.createElement('span')
        power.innerHTML = `⚔️ <strong>${card.power}</strong>`

        const health = document.createElement('span')
        health.innerHTML = `❤️ <strong>${card.health}</strong>`

        stats.append(power, health)

        const effect = document.createElement('div')
        effect.className = 'card-hand-widget__effect'
        if (card.effect) {
            effect.textContent = card.effect
            effect.title = card.effect
        }

        button.append(art, header, stats, effect)

        wrapper.appendChild(button)
        this.strip.appendChild(wrapper)
        this.cardElements.set(card.id, wrapper)
    }

    private refreshCardIndices() {
        this.cards.forEach((card, index) => {
            const element = this.cardElements.get(card.id)
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
        } else if (event.key === 'Enter') {
            event.preventDefault()
            const centered = this.getCenteredCardId()
            if (centered) {
                this.selectCard(centered, { replace: true })
            }
        }
    }

    private handleCardClick(card: CardHandCard, event: MouseEvent) {
        const isMac = navigator.platform.toLowerCase().includes('mac')
        const ctrl = isMac ? event.metaKey : event.ctrlKey
        const shift = event.shiftKey
        this.selectCard(card.id, {
            replace: !ctrl && !shift,
            toggle: ctrl,
            range: shift,
        })
        this.anchorSelection(card.id)
    }

    private handleCardPointerDown(card: CardHandCard, event: PointerEvent) {
        this.anchorSelection(card.id)

        if (event.pointerType === 'touch') {
            this.viewport.setPointerCapture(event.pointerId)
            const timer = window.setTimeout(() => {
                this.touchSelectionActive = true
                this.selectCard(card.id, { replace: true })
            }, LONG_PRESS_DURATION)
            this.longPressTimers.set(event.pointerId, timer)
        }
    }

    private handleCardPointerUp(card: CardHandCard, event: PointerEvent) {
        if (event.pointerType === 'touch') {
            this.cancelLongPress(event.pointerId)
            if (this.touchSelectionActive) {
                this.touchSelectionActive = false
            }
        }
    }

    private handleCardPointerCancel(event: PointerEvent) {
        if (event.pointerType === 'touch') {
            this.cancelLongPress(event.pointerId)
            this.touchSelectionActive = false
        }
    }

    private handleViewportPointerDown = (event: PointerEvent) => {
        if (event.pointerType === 'touch') {
            this.pointerSwipe = {
                pointerId: event.pointerId,
                lastX: event.clientX,
                velocity: 0,
                lastTime: performance.now(),
            }
            this.viewport.setPointerCapture(event.pointerId)
            return
        }

        const target = event.target as HTMLElement | null
        if (target?.closest('[data-card-button]')) {
            return
        }

        if (event.button !== 0) {
            return
        }

        const rect = this.viewport.getBoundingClientRect()
        const overlay = document.createElement('div')
        overlay.className = 'card-hand-widget__selection-rect'
        overlay.style.left = `${event.clientX - rect.left}px`
        overlay.style.top = `${event.clientY - rect.top}px`
        this.viewport.appendChild(overlay)

        this.dragSelection = {
            pointerId: event.pointerId,
            originX: event.clientX,
            originY: event.clientY,
            rect: overlay,
        }

        this.viewport.setPointerCapture(event.pointerId)
    }

    private handleViewportPointerMove = (event: PointerEvent) => {
        if (event.pointerType === 'touch') {
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

            if (this.touchSelectionActive) {
                const hovered = this.getCardIdUnderPointer(event.clientX, event.clientY)
                if (hovered) {
                    this.selectCard(hovered, { toggle: true })
                }
            }

            this.emitViewport()
            return
        }

        if (!this.dragSelection || this.dragSelection.pointerId !== event.pointerId) {
            return
        }

        const rect = this.viewport.getBoundingClientRect()
        const x1 = this.dragSelection.originX - rect.left
        const y1 = this.dragSelection.originY - rect.top
        const x2 = event.clientX - rect.left
        const y2 = event.clientY - rect.top

        const left = Math.min(x1, x2)
        const top = Math.min(y1, y2)
        const width = Math.abs(x1 - x2)
        const height = Math.abs(y1 - y2)

        this.dragSelection.rect.style.left = `${left}px`
        this.dragSelection.rect.style.top = `${top}px`
        this.dragSelection.rect.style.width = `${width}px`
        this.dragSelection.rect.style.height = `${height}px`

        const selected = this.hitTestCards(left + this.viewport.scrollLeft, top, width, height)
        this.selectedIds.clear()
        selected.forEach((id) => this.selectedIds.add(id))
        this.emitSelection()
        this.updateSelectionUi()
    }

    private handleViewportPointerUp = (event: PointerEvent) => {
        if (event.pointerType === 'touch') {
            if (this.pointerSwipe && this.pointerSwipe.pointerId === event.pointerId) {
                if (this.enableTouchInertia) {
                    this.startInertiaAnimation(this.pointerSwipe.velocity)
                }
                this.pointerSwipe = undefined
            }
            this.cancelLongPress(event.pointerId)
            this.touchSelectionActive = false
            this.scheduleSnap()
            return
        }

        if (this.dragSelection && this.dragSelection.pointerId === event.pointerId) {
            this.dragSelection.rect.remove()
            this.dragSelection = undefined
            this.scheduleSnap()
        }
    }

    private handleViewportPointerLeave = (event: PointerEvent) => {
        if (event.pointerType === 'touch') {
            return
        }
        if (!this.dragSelection || this.dragSelection.pointerId !== event.pointerId) {
            return
        }
        this.dragSelection.rect.remove()
        this.dragSelection = undefined
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

    private selectCard(id: string, options: { replace?: boolean; toggle?: boolean; range?: boolean }) {
        const alreadySelected = this.selectedIds.has(id)

        if (options.range && this.selectionMode.anchorId) {
            const range = this.computeRangeIds(this.selectionMode.anchorId, id)
            this.selectedIds.clear()
            range.forEach((cardId) => this.selectedIds.add(cardId))
        } else if (options.toggle) {
            if (alreadySelected) {
                this.selectedIds.delete(id)
            } else {
                this.selectedIds.add(id)
            }
        } else if (options.replace) {
            this.selectedIds.clear()
            this.selectedIds.add(id)
        } else {
            this.selectedIds.clear()
            this.selectedIds.add(id)
        }

        this.updateSelectionUi()
        this.emitSelection()
        this.scrollToCard(id)
    }

    private anchorSelection(id: string) {
        this.selectionMode.anchorId = id
    }

    private clearSelection() {
        if (this.selectedIds.size === 0) {
            return
        }
        this.selectedIds.clear()
        this.updateSelectionUi()
        this.emitSelection()
    }

    private computeRangeIds(anchorId: string, targetId: string): string[] {
        const startIndex = this.cards.findIndex((card) => card.id === anchorId)
        const targetIndex = this.cards.findIndex((card) => card.id === targetId)
        if (startIndex === -1 || targetIndex === -1) {
            return []
        }

        const [from, to] = startIndex < targetIndex ? [startIndex, targetIndex] : [targetIndex, startIndex]
        return this.cards.slice(from, to + 1).map((card) => card.id)
    }

    private updateLayout() {
        const totalWidth = this.cards.length * (this.cardWidth + this.gap) + this.gap
        const viewportWidth = this.viewport.clientWidth
        const shouldCenter = totalWidth < viewportWidth
        this.strip.classList.toggle('card-hand-widget__strip--centered', shouldCenter)
        this.updateIndicators()
        this.updateEmptyState()
        this.updateSelectionUi()
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

    private updateSelectionUi() {
        const selectedCount = this.selectedIds.size
        const total = this.cards.length

        this.counterButton.textContent = `Выбрано: ${selectedCount} из ${total}`
        this.clearButton.style.display = selectedCount > 0 ? 'inline-flex' : 'none'

        this.cardElements.forEach((element, id) => {
            const selected = this.selectedIds.has(id)
            element.classList.toggle('card-hand-widget__card-wrapper--selected', selected)
        })
    }

    private updateEmptyState() {
        if (this.cards.length > 0) {
            this.viewport.classList.remove('card-hand-widget__viewport--empty')
            this.viewport.setAttribute('aria-label', 'Рука игрока')
            if (this.viewport.firstElementChild === null) {
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

    private emitSelection() {
        this.onSelectionChange?.(Array.from(this.selectedIds))
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

    private getCenteredCardId(): string | null {
        if (this.cards.length === 0) {
            return null
        }
        const pitch = this.cardWidth + this.gap
        const scroll = this.viewport.scrollLeft
        const center = scroll + this.viewport.clientWidth / 2
        const index = Math.round((center - this.cardWidth / 2) / pitch)
        const clamped = Math.max(0, Math.min(this.cards.length - 1, index))
        return this.cards[clamped]?.id ?? null
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
        const index = this.cards.findIndex((card) => card.id === id)
        if (index === -1) {
            return
        }
        const pitch = this.cardWidth + this.gap
        const target = index * pitch
        const offset = target - (this.viewport.clientWidth - this.cardWidth) / 2
        this.viewport.scrollTo({ left: Math.max(0, offset), behavior: 'smooth' })
        this.scheduleSnap()
    }

    private getCardIdUnderPointer(x: number, y: number): string | null {
        const element = document.elementFromPoint(x, y) as HTMLElement | null
        const wrapper = element?.closest('.card-hand-widget__card-wrapper') as HTMLDivElement | null
        return wrapper?.dataset.id ?? null
    }

    private hitTestCards(left: number, top: number, width: number, height: number): string[] {
        const result: string[] = []
        const cards = Array.from(this.cardElements.values())
        for (const card of cards) {
            const cardLeft = card.offsetLeft
            const cardRight = cardLeft + card.offsetWidth
            const cardTop = card.offsetTop
            const cardBottom = cardTop + card.offsetHeight
            const overlaps = !(
                left > cardRight ||
                left + width < cardLeft ||
                top > cardBottom ||
                top + height < cardTop
            )
            if (overlaps && card.dataset.id) {
                result.push(card.dataset.id)
            }
        }
        return result
    }

    private cancelLongPress(pointerId: number) {
        const timer = this.longPressTimers.get(pointerId)
        if (timer) {
            window.clearTimeout(timer)
            this.longPressTimers.delete(pointerId)
        }
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

            .card-hand-widget__counter {
                background: none;
                border: none;
                color: inherit;
                padding: 0;
                font-size: 14px;
                cursor: pointer;
                text-align: left;
            }

            .card-hand-widget__counter:hover {
                text-decoration: underline;
            }

            .card-hand-widget__clear {
                margin-left: auto;
                background: rgba(59, 130, 246, 0.2);
                border: 1px solid rgba(59, 130, 246, 0.35);
                border-radius: 999px;
                padding: 6px 14px;
                color: inherit;
                cursor: pointer;
                font-size: 12px;
                display: none;
            }

            .card-hand-widget__clear:hover {
                background: rgba(59, 130, 246, 0.3);
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
                grid-template-rows: 1fr auto auto auto;
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

            .card-hand-widget__card-wrapper--selected .card-hand-widget__card {
                transform: translateY(-8px) scale(1.1);
                border-color: rgba(250, 204, 21, 0.9);
                box-shadow: 0 30px 40px rgba(250, 204, 21, 0.35);
            }

            .card-hand-widget__card-wrapper--selected::after {
                content: '';
                position: absolute;
                inset: -6px;
                border-radius: 24px;
                border: 2px solid rgba(250, 204, 21, 0.65);
                pointer-events: none;
                box-shadow: 0 0 24px rgba(250, 204, 21, 0.35);
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

            .card-hand-widget__stats {
                display: flex;
                justify-content: space-between;
                font-size: 13px;
                opacity: 0.9;
            }

            .card-hand-widget__effect {
                font-size: 12px;
                line-height: 1.4;
                opacity: 0.85;
                display: -webkit-box;
                -webkit-line-clamp: 3;
                -webkit-box-orient: vertical;
                overflow: hidden;
                text-align: left;
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

            .card-hand-widget__selection-rect {
                position: absolute;
                border: 1px dashed rgba(250, 204, 21, 0.85);
                background: rgba(250, 204, 21, 0.18);
                pointer-events: none;
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

