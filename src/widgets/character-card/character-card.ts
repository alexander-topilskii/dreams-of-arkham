export type CharacterVitals = {
    current: number
    max: number
}

export type CharacterEffect = {
    id: string
    name: string
    description?: string
    enemyId?: string
}

export type CharacterCardState = {
    name: string
    title?: string
    portraitUrl?: string
    description?: string
    health: CharacterVitals
    sanity: CharacterVitals
    actionPoints: number
    effects: CharacterEffect[]
}

export type CharacterCardOptions = {
    emptyEffectsLabel?: string
}

export class CharacterCard {
    private static stylesInjected = false

    private readonly root: HTMLElement
    private readonly ownsRoot: boolean

    private readonly container: HTMLDivElement
    private readonly portrait: HTMLImageElement
    private readonly nameElement: HTMLHeadingElement
    private readonly titleElement: HTMLDivElement
    private readonly descriptionElement: HTMLParagraphElement
    private readonly healthStatRoot: HTMLDivElement
    private readonly healthBar: HTMLDivElement
    private readonly healthValue: HTMLSpanElement
    private readonly sanityBar: HTMLDivElement
    private readonly sanityValue: HTMLSpanElement
    private readonly actionPointsValue: HTMLSpanElement
    private readonly effectsList: HTMLUListElement
    private readonly emptyEffects: HTMLDivElement
    private readonly healthEffectsLayer: HTMLDivElement

    private state: CharacterCardState
    private readonly emptyEffectsLabel: string
    private healthAnimationTimeout?: number

    constructor(root: HTMLElement | null | undefined, state: CharacterCardState, options: CharacterCardOptions = {}) {
        this.ownsRoot = !root
        this.root = root ?? this.createRoot()
        this.state = {
            ...state,
            health: { ...state.health },
            sanity: { ...state.sanity },
            effects: [...state.effects],
        }
        this.emptyEffectsLabel = options.emptyEffectsLabel ?? 'Нет активных эффектов'

        CharacterCard.injectStyles()

        this.root.classList.add('character-card-widget')
        this.root.innerHTML = ''

        this.container = document.createElement('div')
        this.container.className = 'character-card'

        const header = document.createElement('div')
        header.className = 'character-card__header'

        this.portrait = document.createElement('img')
        this.portrait.className = 'character-card__portrait'
        this.portrait.alt = ''
        this.portrait.decoding = 'async'

        const summary = document.createElement('div')
        summary.className = 'character-card__summary'

        this.nameElement = document.createElement('h2')
        this.nameElement.className = 'character-card__name'

        this.titleElement = document.createElement('div')
        this.titleElement.className = 'character-card__title'

        this.descriptionElement = document.createElement('p')
        this.descriptionElement.className = 'character-card__description'

        summary.append(this.nameElement, this.titleElement, this.descriptionElement)
        header.append(this.portrait, summary)

        const stats = document.createElement('div')
        stats.className = 'character-card__stats'

        const healthStat = this.createStatBlock('Здоровье', 'character-card__stat--health')
        this.healthStatRoot = healthStat.root
        this.healthBar = healthStat.bar
        this.healthValue = healthStat.value

        const sanityStat = this.createStatBlock('Рассудок', 'character-card__stat--sanity')
        this.sanityBar = sanityStat.bar
        this.sanityValue = sanityStat.value

        this.healthEffectsLayer = document.createElement('div')
        this.healthEffectsLayer.className = 'character-card__stat-effects'
        this.healthStatRoot.appendChild(this.healthEffectsLayer)

        const actionStat = document.createElement('div')
        actionStat.className = 'character-card__stat character-card__stat--actions'

        const actionLabel = document.createElement('span')
        actionLabel.className = 'character-card__stat-label'
        actionLabel.textContent = 'Действия'

        this.actionPointsValue = document.createElement('span')
        this.actionPointsValue.className = 'character-card__stat-value'

        actionStat.append(actionLabel, this.actionPointsValue)

        stats.append(healthStat.root, sanityStat.root, actionStat)

        const effectsSection = document.createElement('div')
        effectsSection.className = 'character-card__effects'

        const effectsHeader = document.createElement('div')
        effectsHeader.className = 'character-card__effects-header'
        effectsHeader.textContent = 'Активные эффекты'

        this.effectsList = document.createElement('ul')
        this.effectsList.className = 'character-card__effects-list'

        this.emptyEffects = document.createElement('div')
        this.emptyEffects.className = 'character-card__effects-empty'

        effectsSection.append(effectsHeader, this.effectsList, this.emptyEffects)

        const layout = document.createElement('div')
        layout.className = 'character-card__layout'

        const mainSection = document.createElement('div')
        mainSection.className = 'character-card__main'
        mainSection.append(header, stats)

        const sidebar = document.createElement('div')
        sidebar.className = 'character-card__sidebar'
        sidebar.append(effectsSection)

        layout.append(mainSection, sidebar)

        this.container.append(layout)
        this.root.appendChild(this.container)

        this.applyState(this.state)
    }

    public destroy(): void {
        if (this.healthAnimationTimeout !== undefined) {
            window.clearTimeout(this.healthAnimationTimeout)
            this.healthAnimationTimeout = undefined
        }

        this.root.innerHTML = ''
        if (this.ownsRoot) {
            this.root.remove()
        }
    }

    public setState(state: Partial<CharacterCardState>): void {
        const previousState = this.state
        const nextState: CharacterCardState = {
            ...this.state,
            ...state,
            health: state.health ? { ...this.state.health, ...state.health } : this.state.health,
            sanity: state.sanity ? { ...this.state.sanity, ...state.sanity } : this.state.sanity,
            effects: state.effects ? [...state.effects] : this.state.effects,
        }

        this.state = nextState
        this.applyState(nextState, previousState)
    }

    private applyState(state: CharacterCardState, previousState?: CharacterCardState): void {
        if (state.portraitUrl) {
            this.portrait.src = this.resolveAssetUrl(state.portraitUrl)
            this.portrait.classList.remove('character-card__portrait--placeholder')
        } else {
            this.portrait.removeAttribute('src')
            this.portrait.classList.add('character-card__portrait--placeholder')
        }

        this.nameElement.textContent = state.name
        this.titleElement.textContent = state.title ?? ''
        this.titleElement.style.display = state.title ? '' : 'none'

        this.descriptionElement.textContent = state.description ?? ''
        this.descriptionElement.style.display = state.description ? '' : 'none'

        this.updateVitals(this.healthBar, this.healthValue, state.health)
        this.handleHealthChange(previousState?.health, state.health)
        this.updateVitals(this.sanityBar, this.sanityValue, state.sanity)

        this.actionPointsValue.textContent = `${state.actionPoints}`

        this.renderEffects(state.effects)
    }

    private renderEffects(effects: CharacterEffect[]): void {
        this.effectsList.innerHTML = ''

        if (!effects.length) {
            this.effectsList.style.display = 'none'
            this.emptyEffects.textContent = this.emptyEffectsLabel
            this.emptyEffects.style.display = ''
            return
        }

        this.effectsList.style.display = ''
        this.emptyEffects.style.display = 'none'

        for (const effect of effects) {
            const item = document.createElement('li')
            item.className = 'character-card__effect'
            item.dataset.effectId = effect.id

            if (effect.enemyId) {
                item.dataset.enemyId = effect.enemyId
            } else {
                delete item.dataset.enemyId
            }

            const name = document.createElement('div')
            name.className = 'character-card__effect-name'
            name.textContent = effect.name

            const description = document.createElement('div')
            description.className = 'character-card__effect-description'
            description.textContent = effect.description ?? ''
            description.style.display = effect.description ? '' : 'none'

            item.append(name, description)
            this.effectsList.appendChild(item)
        }
    }

    private updateVitals(bar: HTMLDivElement, valueLabel: HTMLSpanElement, vitals: CharacterVitals): void {
        const { current, max } = this.clampVitals(vitals)
        const ratio = max > 0 ? current / max : 0
        bar.style.setProperty('--fill', `${ratio}`)
        valueLabel.textContent = `${current} / ${max}`
    }

    private createRoot(): HTMLElement {
        const wrapper = document.createElement('div')
        wrapper.className = 'character-card-widget'
        return wrapper
    }

    private createStatBlock(label: string, modifierClass?: string): {
        root: HTMLDivElement
        bar: HTMLDivElement
        value: HTMLSpanElement
    } {
        const root = document.createElement('div')
        root.className = 'character-card__stat'
        if (modifierClass) {
            root.classList.add(modifierClass)
        }

        const labelElement = document.createElement('span')
        labelElement.className = 'character-card__stat-label'
        labelElement.textContent = label

        const value = document.createElement('span')
        value.className = 'character-card__stat-value'

        const progress = document.createElement('div')
        progress.className = 'character-card__stat-progress'

        const bar = document.createElement('div')
        bar.className = 'character-card__stat-progress-bar'

        progress.appendChild(bar)
        root.append(labelElement, value, progress)

        return { root, bar, value }
    }

    private static injectStyles(): void {
        if (this.stylesInjected) {
            return
        }

        const style = document.createElement('style')
        style.textContent = `
            .character-card-widget {
                width: 100%;
                height: 100%;
                display: flex;
            }

            .character-card {
                display: flex;
                flex-direction: column;
                gap: 16px;
                width: 100%;
                padding: 16px;
                border-radius: 16px;
                background: linear-gradient(135deg, rgba(32, 36, 48, 0.9), rgba(24, 26, 34, 0.85));
                box-shadow: 0 12px 32px rgba(0, 0, 0, 0.35);
                border: 1px solid rgba(180, 200, 255, 0.08);
                color: #f4f5ff;
                font-family: "Segoe UI", system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
                max-width: 760px;
            }

            .character-card__layout {
                display: grid;
                grid-template-columns: minmax(0, 1fr) minmax(220px, 0.75fr);
                gap: 20px;
                align-items: stretch;
            }

            .character-card__main {
                display: flex;
                flex-direction: column;
                gap: 16px;
            }

            .character-card__sidebar {
                display: flex;
                flex-direction: column;
                gap: 16px;
                min-width: 220px;
            }

            .character-card__header {
                display: flex;
                gap: 16px;
                align-items: stretch;
            }

            .character-card__portrait {
                width: 128px;
                height: 160px;
                object-fit: cover;
                border-radius: 12px;
                border: 1px solid rgba(255, 255, 255, 0.2);
                box-shadow: 0 6px 18px rgba(0, 0, 0, 0.4);
                background: rgba(255, 255, 255, 0.06);
            }

            .character-card__portrait--placeholder {
                background: repeating-linear-gradient(135deg, rgba(255, 255, 255, 0.06) 0, rgba(255, 255, 255, 0.06) 12px, rgba(255, 255, 255, 0.12) 12px, rgba(255, 255, 255, 0.12) 24px);
            }

            .character-card__summary {
                display: flex;
                flex-direction: column;
                gap: 6px;
                text-align: left;
                flex: 1;
            }

            .character-card__name {
                margin: 0;
                font-size: 20px;
                letter-spacing: 0.02em;
                font-weight: 700;
            }

            .character-card__title {
                font-size: 13px;
                opacity: 0.72;
                letter-spacing: 0.08em;
                text-transform: uppercase;
            }

            .character-card__description {
                margin: 0;
                font-size: 13px;
                line-height: 1.5;
                opacity: 0.86;
            }

            .character-card__stats {
                display: grid;
                grid-template-columns: repeat(3, minmax(0, 1fr));
                gap: 12px;
            }

            .character-card__stat {
                background: rgba(12, 14, 20, 0.65);
                border-radius: 12px;
                padding: 10px 12px;
                display: flex;
                flex-direction: column;
                gap: 6px;
                border: 1px solid rgba(255, 255, 255, 0.06);
                position: relative;
            }

            .character-card__stat--health {
                overflow: visible;
                transition: background-color 180ms ease, box-shadow 180ms ease;
            }

            .character-card__stat--health.character-card__stat--health-damage {
                background: rgba(70, 16, 24, 0.78);
                box-shadow: 0 0 0 1px rgba(255, 90, 90, 0.38), 0 10px 20px rgba(255, 30, 30, 0.22);
                animation: character-card-health-damage-shake 720ms cubic-bezier(0.36, 0.07, 0.19, 0.97);
            }

            .character-card__stat--health.character-card__stat--health-heal {
                background: rgba(24, 60, 36, 0.72);
                box-shadow: 0 0 0 1px rgba(120, 255, 190, 0.28), 0 12px 24px rgba(90, 255, 180, 0.16);
                animation: character-card-health-heal-shake 880ms ease-out;
            }

            .character-card__stat-label {
                font-size: 11px;
                letter-spacing: 0.12em;
                text-transform: uppercase;
                opacity: 0.75;
            }

            .character-card__stat-label,
            .character-card__stat-value,
            .character-card__stat-progress {
                position: relative;
                z-index: 1;
            }

            .character-card__stat-value {
                font-size: 18px;
                font-weight: 600;
                letter-spacing: 0.02em;
            }

            .character-card__stat-progress {
                width: 100%;
                height: 8px;
                border-radius: 4px;
                background: rgba(255, 255, 255, 0.08);
                overflow: hidden;
                position: relative;
            }

            .character-card__stat-progress-bar {
                position: absolute;
                inset: 0;
                transform: scaleX(var(--fill, 0));
                transform-origin: left center;
                transition: transform 200ms ease;
            }

            .character-card__stat-effects {
                position: absolute;
                inset: -12px 0 -4px 0;
                pointer-events: none;
                overflow: visible;
                z-index: 2;
            }

            .character-card__health-float-label {
                position: absolute;
                left: 50%;
                top: 50%;
                transform: translate(-50%, -50%) scale(0.7);
                font-size: 18px;
                font-weight: 700;
                opacity: 0;
                text-shadow: 0 0 6px rgba(0, 0, 0, 0.5);
                letter-spacing: 0.04em;
                will-change: transform, opacity;
            }

            .character-card__health-float-label--damage {
                color: #ff7f7f;
                --float-y: -26px;
                --duration: 800ms;
            }

            .character-card__health-float-label--heal {
                color: #7dff9a;
                --float-y: -46px;
                --duration: 1100ms;
            }

            .character-card__health-float-label.is-active {
                animation: character-card-health-float var(--duration) ease-out forwards;
            }

            .character-card__health-particle {
                position: absolute;
                top: 50%;
                left: 50%;
                width: 6px;
                height: 6px;
                border-radius: 999px;
                opacity: 0;
                transform: translate(-50%, -50%) scale(0.4);
                --tx: 0px;
                --ty: 0px;
                --duration: 520ms;
                filter: blur(0px);
                will-change: transform, opacity;
            }

            .character-card__health-particle--damage {
                background: radial-gradient(circle at center, rgba(255, 126, 126, 0.95), rgba(255, 30, 30, 0.8));
            }

            .character-card__health-particle.is-active {
                animation: character-card-health-particle var(--duration) ease-out forwards;
            }

            @keyframes character-card-health-float {
                0% {
                    opacity: 0;
                    transform: translate(-50%, -50%) scale(0.6);
                }
                15% {
                    opacity: 1;
                }
                100% {
                    opacity: 0;
                    transform: translate(-50%, calc(-50% + var(--float-y))) scale(1);
                }
            }

            @keyframes character-card-health-particle {
                0% {
                    opacity: 0;
                    transform: translate(-50%, -50%) scale(0.3);
                }
                20% {
                    opacity: 1;
                }
                100% {
                    opacity: 0;
                    transform: translate(calc(-50% + var(--tx)), calc(-50% + var(--ty))) scale(0.15);
                }
            }

            @keyframes character-card-health-damage-shake {
                0% {
                    transform: translate3d(0, 0, 0);
                }
                15% {
                    transform: translate3d(-4px, 0, 0);
                }
                30% {
                    transform: translate3d(4px, 1px, 0);
                }
                45% {
                    transform: translate3d(-3px, -1px, 0);
                }
                60% {
                    transform: translate3d(2px, 2px, 0);
                }
                75% {
                    transform: translate3d(-1px, 0, 0);
                }
                100% {
                    transform: translate3d(0, 0, 0);
                }
            }

            @keyframes character-card-health-heal-shake {
                0% {
                    transform: translate3d(0, 0, 0);
                }
                25% {
                    transform: translate3d(0, -2px, 0);
                }
                50% {
                    transform: translate3d(1px, 0, 0);
                }
                75% {
                    transform: translate3d(-1px, -1px, 0);
                }
                100% {
                    transform: translate3d(0, 0, 0);
                }
            }

            .character-card__stat--health .character-card__stat-progress-bar {
                background: linear-gradient(90deg, #ff6b6b, #ffa06b);
            }

            .character-card__stat--sanity .character-card__stat-progress-bar {
                background: linear-gradient(90deg, #6c8bff, #9d6bff);
            }

            .character-card__stat--actions {
                align-items: flex-start;
                justify-content: center;
            }

            .character-card__stat--actions .character-card__stat-value {
                font-size: 32px;
                line-height: 1;
            }

            .character-card__stat--actions .character-card__stat-label {
                margin-bottom: 6px;
            }

            .character-card__effects {
                display: flex;
                flex-direction: column;
                gap: 10px;
                text-align: left;
                flex: 1;
            }

            .character-card__effects-header {
                font-size: 12px;
                letter-spacing: 0.18em;
                text-transform: uppercase;
                opacity: 0.68;
            }

            .character-card__effects-list {
                list-style: none;
                padding: 0;
                margin: 0;
                display: flex;
                flex-direction: column;
                gap: 8px;
            }

            .character-card__effect {
                padding: 10px 12px;
                border-radius: 10px;
                background: rgba(8, 10, 16, 0.65);
                border: 1px solid rgba(255, 255, 255, 0.06);
            }

            .character-card__effect-name {
                font-size: 14px;
                font-weight: 600;
                margin-bottom: 4px;
            }

            .character-card__effect-description {
                font-size: 12px;
                line-height: 1.4;
                opacity: 0.82;
            }

            .character-card__effects-empty {
                font-size: 13px;
                opacity: 0.6;
                font-style: italic;
            }

            @media (max-width: 900px) {
                .character-card__layout {
                    grid-template-columns: 1fr;
                }

                .character-card__sidebar {
                    min-width: 0;
                }
            }

            @media (max-width: 480px) {
                .character-card {
                    max-width: none;
                }

                .character-card__header {
                    flex-direction: column;
                    align-items: center;
                    text-align: center;
                }

                .character-card__summary {
                    text-align: center;
                }

                .character-card__stats {
                    grid-template-columns: 1fr;
                }
            }
        `

        document.head.appendChild(style)
        this.stylesInjected = true
    }

    private resolveAssetUrl(rawUrl: string): string {
        const absolutePattern = /^(?:[a-z]+:)?\/\//i
        if (absolutePattern.test(rawUrl) || rawUrl.startsWith('data:')) {
            return rawUrl
        }

        const base = import.meta.env.BASE_URL ?? '/'
        const normalizedBase = base.endsWith('/') ? base : `${base}/`
        const normalizedPath = rawUrl.startsWith('/') ? rawUrl.slice(1) : rawUrl

        return `${normalizedBase}${normalizedPath}`
    }

    private handleHealthChange(previous: CharacterVitals | undefined, next: CharacterVitals): void {
        if (!previous) {
            return
        }

        const prevClamped = this.clampVitals(previous)
        const nextClamped = this.clampVitals(next)
        const delta = nextClamped.current - prevClamped.current

        if (delta === 0) {
            return
        }

        if (delta < 0) {
            const amount = Math.abs(delta)
            this.triggerHealthAnimation('damage')
            this.spawnHealthLabel('damage', amount)
            this.spawnHealthParticles(amount)
        } else {
            this.triggerHealthAnimation('heal')
            this.spawnHealthLabel('heal', delta)
        }
    }

    private triggerHealthAnimation(type: 'damage' | 'heal'): void {
        if (this.healthAnimationTimeout !== undefined) {
            window.clearTimeout(this.healthAnimationTimeout)
        }

        this.healthStatRoot.classList.remove('character-card__stat--health-damage', 'character-card__stat--health-heal')
        void this.healthStatRoot.offsetWidth

        const className = type === 'damage' ? 'character-card__stat--health-damage' : 'character-card__stat--health-heal'
        this.healthStatRoot.classList.add(className)

        this.healthAnimationTimeout = window.setTimeout(() => {
            this.healthStatRoot.classList.remove(className)
            this.healthAnimationTimeout = undefined
        }, 1000)
    }

    private spawnHealthLabel(type: 'damage' | 'heal', amount: number): void {
        const label = document.createElement('div')
        label.className = `character-card__health-float-label character-card__health-float-label--${type}`
        const formattedAmount = Number.isInteger(amount) ? `${amount}` : amount.toFixed(1)
        label.textContent = `${type === 'damage' ? '-' : '+'}${formattedAmount}`

        this.healthEffectsLayer.appendChild(label)

        requestAnimationFrame(() => {
            label.classList.add('is-active')
        })

        const lifetime = type === 'damage' ? 800 : 1100
        window.setTimeout(() => {
            label.remove()
        }, lifetime)
    }

    private spawnHealthParticles(amount: number): void {
        const particleCount = Math.min(12, Math.max(6, Math.round(amount) * 3))

        for (let i = 0; i < particleCount; i += 1) {
            const particle = document.createElement('span')
            particle.className = 'character-card__health-particle character-card__health-particle--damage'

            const angle = Math.random() * Math.PI * 2
            const distance = 24 + Math.random() * 28
            const duration = Math.round(420 + Math.random() * 280)

            particle.style.setProperty('--tx', `${Math.cos(angle) * distance}px`)
            particle.style.setProperty('--ty', `${Math.sin(angle) * distance}px`)
            particle.style.setProperty('--duration', `${duration}ms`)

            this.healthEffectsLayer.appendChild(particle)

            requestAnimationFrame(() => {
                particle.classList.add('is-active')
            })

            window.setTimeout(() => {
                particle.remove()
            }, duration)
        }
    }

    private clampVitals(vitals: CharacterVitals): CharacterVitals {
        const max = Math.max(0, vitals.max)
        const current = Math.max(0, Math.min(vitals.current, max))
        return { current, max }
    }
}
