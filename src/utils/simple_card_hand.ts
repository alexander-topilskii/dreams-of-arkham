export class SimpleCardOptions {
    cardWidth?: number
    cardHeight?: number
    gap?: number
    cards?: string[]
}

type RequiredOpts = {
    cardWidth: number
    cardHeight: number
    gap: number
}

export class SimpleCardHand {
    private readonly root: HTMLElement
    private readonly opts: { cardWidth: number; cardHeight: number; gap: number }
    private cards: string[] = []
    private selectedIndex: number | null = null

    constructor(root?: HTMLElement | null, options: SimpleCardOptions = {}) {
        this.root = root ?? this.createOverlayRoot()
        this.root.classList.add('card-hand')

        this.opts = {
            cardWidth: options.cardWidth ?? 140,
            cardHeight: options.cardHeight ?? 190,
            gap: options.gap ?? 12,
        }

        this.applyRootStyles()
        this.cards = [...(options.cards ?? [])]
        this.render()

        this.root.addEventListener('click', (e) => {
            const target = e.target as HTMLElement
            const cardEl = target.closest('.card-item') as HTMLElement | null
            if (cardEl && this.root.contains(cardEl)) {
                const idx = Number(cardEl.dataset.index)
                this.select(idx)
            } else {
                this.unselect()
            }
        })
    }

    private createOverlayRoot(): HTMLElement {
        const overlay = document.createElement('div')
        overlay.setAttribute('data-card-hand-overlay', '1')
        document.body.appendChild(overlay)
        return overlay
    }

    private applyRootStyles() {
        const { gap } = this.opts
        const s = this.root.style
        s.position = 'fixed'
        s.inset = '0'
        s.zIndex = '9999'
        s.display = 'flex'
        s.flexWrap = 'wrap'
        s.alignContent = 'flex-start'
        s.gap = `${gap}px`
        s.padding = '16px'
        s.pointerEvents = 'none' // клики проходят сквозь контейнер
    }

    private render() {
        this.root.innerHTML = ''
        this.cards.forEach((value, index) => {
            const el = this.createCardEl(value, index)
            this.root.appendChild(el)
        })
        this.updateSelectionStyles()
    }

    private createCardEl(value: string, index: number): HTMLElement {
        const { cardWidth, cardHeight } = this.opts
        const el = document.createElement('div')
        el.className = 'card-item'
        el.dataset.index = String(index)

        const s = el.style
        s.width = `${cardWidth}px`
        s.height = `${cardHeight}px`
        s.boxSizing = 'border-box'
        s.border = '1px solid rgba(0,0,0,0.2)'
        s.borderRadius = '10px'
        s.background = 'rgba(255,255,255,0.9)' // слегка прозрачный фон
        s.color = '#0f172a'
        s.display = 'flex'
        s.alignItems = 'center'
        s.justifyContent = 'center'
        s.padding = '10px'
        s.fontFamily = 'system-ui, sans-serif'
        s.fontSize = '14px'
        s.textAlign = 'center'
        s.cursor = 'pointer'
        s.boxShadow = '0 2px 8px rgba(0,0,0,0.15)'
        s.transition = 'transform 120ms ease, box-shadow 120ms ease, border-color 120ms ease'
        s.pointerEvents = 'auto' // карточки остаются кликабельными

        const text = document.createElement('div')
        text.textContent = value
        const ts = text.style
        ts.overflow = 'hidden'
        ts.textOverflow = 'ellipsis'
        ts.whiteSpace = 'nowrap'
        ts.width = '100%'
        el.title = value

        el.appendChild(text)

        el.addEventListener('mouseenter', () => {
            el.style.transform = 'translateY(-2px)'
            el.style.boxShadow = '0 6px 18px rgba(0,0,0,0.25)'
        })
        el.addEventListener('mouseleave', () => {
            el.style.transform = ''
            el.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)'
        })

        return el
    }

    private select(index: number) {
        if (index < 0 || index >= this.cards.length) return
        this.selectedIndex = index
        this.updateSelectionStyles()
    }

    private unselect(): void {
        if (this.selectedIndex === null) return
        this.selectedIndex = null
        this.updateSelectionStyles()
    }

    private updateSelectionStyles() {
        const children = Array.from(this.root.querySelectorAll<HTMLElement>('.card-item'))
        children.forEach((el, i) => {
            const selected = i === this.selectedIndex
            el.style.borderColor = selected ? '#2563eb' : 'rgba(0,0,0,0.2)'
            el.style.boxShadow = selected
                ? '0 0 0 3px rgba(37,99,235,0.25), 0 6px 18px rgba(0,0,0,0.25)'
                : '0 2px 8px rgba(0,0,0,0.15)'
        })
    }

    addCard(value: string): void {
        this.cards.push(value)
        this.render()
    }

    removeCard(index: number): void {
        if (index < 0 || index >= this.cards.length) return
        this.cards.splice(index, 1)
        this.render()
    }

    destroy(): void {
        if (this.root.hasAttribute('data-card-hand-overlay')) {
            this.root.remove()
        }
    }
}
