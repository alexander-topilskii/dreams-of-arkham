export type SimpleCardContent = {
    id: string
    title: string
    description: string
    image: string
}

export type SimpleCardHandOptions = {
    cards?: SimpleCardContent[]
    cardsPerPage?: number
}

type DeckElements = {
    container: HTMLDivElement
    stack: HTMLDivElement
    count: HTMLSpanElement
}

type DragState = {
    pointerId: number
    offsetX: number
    offsetY: number
}

export class SimpleCardHand {
    private static stylesInjected = false

    private readonly root: HTMLElement
    private readonly panel: HTMLDivElement
    private readonly cardsHost: HTMLDivElement
    private readonly leftDeck: DeckElements
    private readonly rightDeck: DeckElements
    private readonly prevButton: HTMLButtonElement
    private readonly nextButton: HTMLButtonElement
    private readonly handle: HTMLDivElement
    private readonly handlePointerDown: (event: PointerEvent) => void

    private readonly cardsPerPage: number
    private cards: SimpleCardContent[] = []
    private selectedIndex: number | null = null
    private firstVisibleIndex = 0
    private dragState: DragState | null = null

    constructor(root?: HTMLElement | null, options: SimpleCardHandOptions = {}) {
        this.root = root ?? this.createOverlayRoot()
        this.root.classList.add('simple-card-hand')
        this.root.innerHTML = ''

        this.cardsPerPage = Math.max(1, options.cardsPerPage ?? 5)

        SimpleCardHand.injectStyles()
        this.applyRootStyles()

        this.panel = document.createElement('div')
        this.panel.className = 'simple-card-hand__panel'
        this.root.appendChild(this.panel)

        this.handle = document.createElement('div')
        this.handle.className = 'simple-card-hand__handle'
        const dots = document.createElement('div')
        dots.className = 'simple-card-hand__handle-dots'
        this.handle.appendChild(dots)
        this.panel.appendChild(this.handle)
        this.handlePointerDown = (event: PointerEvent) => this.beginDrag(event)

        const body = document.createElement('div')
        body.className = 'simple-card-hand__body'
        this.panel.appendChild(body)

        this.leftDeck = this.createDeck()
        body.appendChild(this.leftDeck.container)

        const viewport = document.createElement('div')
        viewport.className = 'simple-card-hand__viewport'
        body.appendChild(viewport)

        this.cardsHost = document.createElement('div')
        this.cardsHost.className = 'simple-card-hand__cards'
        viewport.appendChild(this.cardsHost)

        this.rightDeck = this.createDeck()
        body.appendChild(this.rightDeck.container)

        this.prevButton = this.createNavButton('left')
        viewport.appendChild(this.prevButton)

        this.nextButton = this.createNavButton('right')
        viewport.appendChild(this.nextButton)

        this.cards = [...(options.cards ?? [])]
        this.render()

        this.cardsHost.addEventListener('click', (event) => {
            const target = event.target as HTMLElement | null
            const cardEl = target?.closest('.simple-card-hand__card') as HTMLElement | null
            if (!cardEl) return
            const index = Number(cardEl.dataset.index)
            if (Number.isNaN(index)) return
            this.select(index)
        })

        this.prevButton.addEventListener('click', () => {
            this.shiftVisible(-this.cardsPerPage)
        })

        this.nextButton.addEventListener('click', () => {
            this.shiftVisible(this.cardsPerPage)
        })

        this.handle.addEventListener('pointerdown', this.handlePointerDown)
    }

    addCard(card: SimpleCardContent): void {
        this.cards.push(card)
        this.render()
    }

    setCards(cards: SimpleCardContent[]): void {
        this.cards = [...cards]
        this.selectedIndex = null
        this.firstVisibleIndex = 0
        this.render()
    }

    removeCard(index: number): void {
        if (index < 0 || index >= this.cards.length) return
        this.cards.splice(index, 1)

        if (this.selectedIndex !== null) {
            if (this.cards.length === 0) {
                this.selectedIndex = null
            } else if (index === this.selectedIndex) {
                this.selectedIndex = null
            } else if (index < this.selectedIndex) {
                this.selectedIndex -= 1
            }
        }

        this.firstVisibleIndex = Math.min(
            this.firstVisibleIndex,
            Math.max(0, Math.floor((this.cards.length - 1) / this.cardsPerPage) * this.cardsPerPage),
        )

        this.render()
    }

    destroy(): void {
        this.handle.removeEventListener('pointerdown', this.handlePointerDown)
        if (this.root.hasAttribute('data-card-hand-overlay')) {
            this.root.remove()
        } else {
            this.root.innerHTML = ''
        }
    }

    private select(index: number): void {
        if (index < 0 || index >= this.cards.length) {
            return
        }
        this.selectedIndex = index
        this.updateSelectionStyles()
    }

    private shiftVisible(delta: number): void {
        const nextIndex = Math.max(0, Math.min(this.cards.length - 1, this.firstVisibleIndex + delta))
        const clamped = Math.floor(nextIndex / this.cardsPerPage) * this.cardsPerPage
        this.firstVisibleIndex = clamped
        this.render()
    }

    private render(): void {
        this.cardsHost.innerHTML = ''
        const end = Math.min(this.cards.length, this.firstVisibleIndex + this.cardsPerPage)
        for (let i = this.firstVisibleIndex; i < end; i += 1) {
            const card = this.cards[i]
            const el = this.createCardElement(card, i)
            this.cardsHost.appendChild(el)
        }

        const leftCount = this.firstVisibleIndex
        const rightCount = Math.max(0, this.cards.length - end)
        this.updateDeck(this.leftDeck, leftCount)
        this.updateDeck(this.rightDeck, rightCount)
        this.updateNavState()
        this.updateSelectionStyles()
    }

    private updateSelectionStyles(): void {
        const cardElements = this.cardsHost.querySelectorAll<HTMLElement>('.simple-card-hand__card')
        cardElements.forEach((cardEl) => {
            const index = Number(cardEl.dataset.index)
            cardEl.classList.toggle('simple-card-hand__card--selected', index === this.selectedIndex)
        })
    }

    private updateNavState(): void {
        this.prevButton.disabled = this.firstVisibleIndex <= 0
        this.nextButton.disabled = this.firstVisibleIndex + this.cardsPerPage >= this.cards.length
    }

    private updateDeck(deck: DeckElements, count: number): void {
        deck.count.textContent = String(count)
        deck.container.classList.toggle('simple-card-hand__deck--hidden', count === 0)
        deck.stack.innerHTML = ''

        const visibleCards = Math.min(3, count)
        for (let i = 0; i < visibleCards; i += 1) {
            const layer = document.createElement('span')
            layer.className = 'simple-card-hand__deck-card'
            const offset = i * 6
            const rotation = (i - 1) * 4
            layer.style.transform = `translateX(${offset}px) rotate(${rotation}deg)`
            deck.stack.appendChild(layer)
        }
    }

    private createCardElement(card: SimpleCardContent, index: number): HTMLElement {
        const cardEl = document.createElement('div')
        cardEl.className = 'simple-card-hand__card'
        cardEl.dataset.index = String(index)
        cardEl.title = card.title

        const image = document.createElement('div')
        image.className = 'simple-card-hand__image'
        image.style.backgroundImage = `url('${card.image}')`

        const body = document.createElement('div')
        body.className = 'simple-card-hand__card-body'

        const title = document.createElement('div')
        title.className = 'simple-card-hand__title'
        title.textContent = card.title

        const description = document.createElement('div')
        description.className = 'simple-card-hand__description'
        description.textContent = card.description

        body.append(title, description)
        cardEl.append(image, body)
        return cardEl
    }

    private createNavButton(direction: 'left' | 'right'): HTMLButtonElement {
        const btn = document.createElement('button')
        btn.type = 'button'
        btn.classList.add('simple-card-hand__nav')
        btn.classList.add(direction === 'left' ? 'simple-card-hand__nav--left' : 'simple-card-hand__nav--right')
        btn.setAttribute('aria-label', direction === 'left' ? 'Предыдущие карты' : 'Следующие карты')
        btn.innerHTML = direction === 'left' ? '&#8592;' : '&#8594;'
        return btn
    }

    private createDeck(): DeckElements {
        const container = document.createElement('div')
        container.className = 'simple-card-hand__deck'

        const stack = document.createElement('div')
        stack.className = 'simple-card-hand__deck-stack'
        container.appendChild(stack)

        const count = document.createElement('span')
        count.className = 'simple-card-hand__deck-count'
        container.appendChild(count)

        return {container, stack, count}
    }

    private beginDrag(event: PointerEvent): void {
        event.preventDefault()
        this.handle.setPointerCapture(event.pointerId)
        const rect = this.root.getBoundingClientRect()
        this.dragState = {
            pointerId: event.pointerId,
            offsetX: event.clientX - rect.left,
            offsetY: event.clientY - rect.top,
        }
        const move = (moveEvent: PointerEvent) => this.updateDrag(moveEvent)
        const end = (endEvent: PointerEvent) => this.endDrag(endEvent, move, end)
        this.handle.addEventListener('pointermove', move)
        this.handle.addEventListener('pointerup', end)
        this.handle.addEventListener('pointercancel', end)
    }

    private updateDrag(event: PointerEvent): void {
        if (!this.dragState || event.pointerId !== this.dragState.pointerId) {
            return
        }
        const left = event.clientX - this.dragState.offsetX
        const top = event.clientY - this.dragState.offsetY
        this.root.style.left = `${left}px`
        this.root.style.top = `${top}px`
        this.root.style.bottom = 'auto'
        this.root.style.right = 'auto'
        this.root.style.transform = 'translateX(0)'
    }

    private endDrag(event: PointerEvent, move: (event: PointerEvent) => void, end: (event: PointerEvent) => void): void {
        if (!this.dragState || event.pointerId !== this.dragState.pointerId) {
            return
        }
        this.handle.releasePointerCapture(event.pointerId)
        this.handle.removeEventListener('pointermove', move)
        this.handle.removeEventListener('pointerup', end)
        this.handle.removeEventListener('pointercancel', end)
        this.dragState = null
    }

    private applyRootStyles(): void {
        const style = this.root.style
        style.position = 'fixed'
        style.left = '50%'
        style.bottom = '24px'
        style.transform = 'translateX(-50%)'
        style.zIndex = '2000'
        style.display = 'flex'
        style.justifyContent = 'center'
        style.width = '100%'
        style.maxWidth = '100vw'
        style.padding = '0 16px'
        style.boxSizing = 'border-box'
    }

    private createOverlayRoot(): HTMLElement {
        const overlay = document.createElement('div')
        overlay.setAttribute('data-card-hand-overlay', '1')
        document.body.appendChild(overlay)
        return overlay
    }

    private static injectStyles(): void {
        if (SimpleCardHand.stylesInjected) return
        const styleTag = document.createElement('style')
        styleTag.textContent = `
            .simple-card-hand {
                position: fixed;
                left: 50%;
                bottom: 24px;
                transform: translateX(-50%);
                z-index: 2000;
                display: flex;
                justify-content: center;
                width: 100%;
                max-width: 100vw;
                padding: 0 16px;
                box-sizing: border-box;
            }
            .simple-card-hand__panel {
                width: min(100%, 960px);
                background: rgba(15, 23, 42, 0.92);
                backdrop-filter: blur(14px);
                border-radius: 20px;
                box-shadow: 0 20px 60px rgba(15, 23, 42, 0.6);
                border: 1px solid rgba(148, 163, 184, 0.2);
                display: flex;
                flex-direction: column;
                gap: 12px;
                padding: 12px 16px 20px;
                transition: box-shadow 0.3s ease, transform 0.3s ease;
            }
            .simple-card-hand__panel:hover {
                box-shadow: 0 24px 70px rgba(30, 64, 175, 0.35);
                transform: translateY(-2px);
            }
            .simple-card-hand__handle {
                align-self: center;
                width: 72px;
                height: 18px;
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: grab;
                touch-action: none;
            }
            .simple-card-hand__handle:active {
                cursor: grabbing;
            }
            .simple-card-hand__handle-dots {
                width: 100%;
                height: 6px;
                border-radius: 999px;
                background: repeating-linear-gradient(90deg, rgba(148, 163, 184, 0.85) 0 8px, transparent 8px 12px);
                opacity: 0.9;
            }
            .simple-card-hand__body {
                display: flex;
                align-items: stretch;
                gap: 16px;
            }
            .simple-card-hand__nav {
                --nav-translate-x: 0;
                width: 40px;
                height: 40px;
                border-radius: 50%;
                border: 1px solid rgba(148, 163, 184, 0.25);
                background: rgba(30, 41, 59, 0.88);
                color: #e2e8f0;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                font-size: 20px;
                transition: background 0.2s ease, transform 0.2s ease, opacity 0.2s ease, box-shadow 0.2s ease;
                position: absolute;
                top: 50%;
                transform: translate(var(--nav-translate-x), -50%);
                box-shadow: 0 16px 34px rgba(15, 23, 42, 0.45);
                z-index: 3;
            }
            .simple-card-hand__nav--left {
                left: var(--card-hand-nav-offset);
                --nav-translate-x: -50%;
            }
            .simple-card-hand__nav--right {
                right: var(--card-hand-nav-offset);
                --nav-translate-x: 50%;
            }
            .simple-card-hand__nav:disabled {
                opacity: 0.35;
                cursor: default;
            }
            .simple-card-hand__nav:not(:disabled):hover {
                background: rgba(59, 130, 246, 0.35);
                transform: translate(var(--nav-translate-x), calc(-50% - 2px));
                box-shadow: 0 20px 40px rgba(59, 130, 246, 0.35);
            }
            .simple-card-hand__nav:not(:disabled):active {
                transform: translate(var(--nav-translate-x), calc(-50% + 1px));
            }
            .simple-card-hand__nav:focus-visible {
                outline: none;
                box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.45);
            }
            .simple-card-hand__viewport {
                --card-hand-nav-offset: 56px;
                position: relative;
                flex: 1;
                overflow: hidden;
                padding: 0 var(--card-hand-nav-offset);
            }
            .simple-card-hand__cards {
                display: grid;
                grid-auto-flow: column;
                grid-auto-columns: minmax(0, 1fr);
                gap: 16px;
                align-items: stretch;
                min-height: 220px;
                width: 100%;
            }
            .simple-card-hand__card {
                background: linear-gradient(160deg, rgba(30, 64, 175, 0.45), rgba(15, 118, 110, 0.45));
                border-radius: 16px;
                border: 1px solid rgba(148, 163, 184, 0.25);
                display: flex;
                flex-direction: column;
                overflow: hidden;
                box-shadow: 0 8px 24px rgba(15, 23, 42, 0.35);
                transition: transform 0.25s ease, box-shadow 0.25s ease, border-color 0.25s ease;
                min-width: 0;
                position: relative;
                cursor: pointer;
                color: #e2e8f0;
            }
            .simple-card-hand__card:hover {
                transform: translateY(-6px);
                box-shadow: 0 16px 36px rgba(59, 130, 246, 0.35);
            }
            .simple-card-hand__card--selected {
                border-color: rgba(59, 130, 246, 0.85);
                box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.35), 0 16px 36px rgba(59, 130, 246, 0.45);
                transform: translateY(-4px);
            }
            .simple-card-hand__image {
                width: 100%;
                padding-top: 62%;
                background-size: cover;
                background-position: center;
                flex: none;
            }
            .simple-card-hand__card-body {
                flex: 1;
                display: flex;
                flex-direction: column;
                gap: 8px;
                padding: 12px 14px 16px;
                text-align: left;
            }
            .simple-card-hand__title {
                font-size: 16px;
                font-weight: 600;
            }
            .simple-card-hand__description {
                font-size: 13px;
                line-height: 1.4;
                opacity: 0.85;
                display: -webkit-box;
                -webkit-line-clamp: 3;
                -webkit-box-orient: vertical;
                overflow: hidden;
            }
            .simple-card-hand__deck {
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 6px;
                min-width: 48px;
                transition: opacity 0.2s ease;
            }
            .simple-card-hand__deck--hidden {
                opacity: 0.2;
            }
            .simple-card-hand__deck-stack {
                position: relative;
                width: 48px;
                height: 70px;
            }
            .simple-card-hand__deck-card {
                position: absolute;
                top: 0;
                left: 0;
                width: 48px;
                height: 70px;
                border-radius: 12px;
                background: rgba(30, 41, 59, 0.9);
                border: 1px solid rgba(148, 163, 184, 0.25);
                box-shadow: 0 8px 18px rgba(15, 23, 42, 0.45);
            }
            .simple-card-hand__deck-count {
                font-size: 12px;
                color: rgba(226, 232, 240, 0.85);
                font-family: 'Inter', system-ui, sans-serif;
            }
            @media (max-width: 900px) {
                .simple-card-hand__viewport {
                    --card-hand-nav-offset: 52px;
                }
            }
            @media (max-width: 720px) {
                .simple-card-hand__viewport {
                    --card-hand-nav-offset: 48px;
                }
                .simple-card-hand__cards {
                    gap: 12px;
                    min-height: 200px;
                }
            }
            @media (max-width: 640px) {
                .simple-card-hand__panel {
                    padding: 12px;
                }
                .simple-card-hand__viewport {
                    --card-hand-nav-offset: 42px;
                }
                .simple-card-hand__nav {
                    width: 36px;
                    height: 36px;
                    font-size: 18px;
                }
            }
            @media (max-width: 520px) {
                .simple-card-hand__viewport {
                    --card-hand-nav-offset: 36px;
                }
            }
        `
        document.head.appendChild(styleTag)
        SimpleCardHand.stylesInjected = true
    }
}
