import { createDebugButton } from "../debug/debug";

export type DebugPanelOptions = {
    title?: string;
};

export type DebugNumericControlConfig = {
    get: () => number;
    set: (value: number) => void;
    min?: number;
    max?: number;
    step?: number;
    onChange: () => void;
};

export type DebugBooleanControlConfig = {
    get: () => boolean;
    set: (value: boolean) => void;
    onChange: () => void;
};

export class DebugPanel {
    private readonly panel: HTMLDivElement;

    constructor(container: HTMLElement | null | undefined, options?: DebugPanelOptions) {
        this.panel = this.createPanelElement();

        if (options?.title) {
            const header = document.createElement("h2");
            header.textContent = options.title;
            header.style.margin = "0";
            header.style.fontSize = "14px";
            header.style.fontWeight = "600";
            this.panel.appendChild(header);
        }

        if (container instanceof HTMLElement) {
            container.appendChild(this.panel);
        }
    }

    public get element(): HTMLDivElement {
        return this.panel;
    }

    public addGroup(title: string): HTMLDivElement {
        const group = document.createElement("div");
        group.style.display = "flex";
        group.style.flexDirection = "column";
        group.style.gap = "8px";

        const heading = document.createElement("div");
        heading.textContent = title;
        heading.style.fontSize = "11px";
        heading.style.letterSpacing = "0.08em";
        heading.style.textTransform = "uppercase";
        heading.style.opacity = "0.75";

        group.appendChild(heading);
        this.panel.appendChild(group);
        return group;
    }

    public addNumericControl(
        group: HTMLElement,
        label: string,
        config: DebugNumericControlConfig,
    ): HTMLDivElement {
        const row = document.createElement("div");
        row.style.display = "grid";
        row.style.gridTemplateColumns = "1fr auto auto auto";
        row.style.alignItems = "center";
        row.style.gap = "8px";

        const labelEl = document.createElement("span");
        labelEl.textContent = label;
        labelEl.style.whiteSpace = "nowrap";
        labelEl.style.overflow = "hidden";
        labelEl.style.textOverflow = "ellipsis";

        const valueEl = document.createElement("span");
        valueEl.style.minWidth = "36px";
        valueEl.style.textAlign = "center";
        valueEl.style.fontVariantNumeric = "tabular-nums";

        const applyChange = (direction: number) => {
            const step = config.step ?? 1;
            const current = config.get();
            const next = current + direction * step;
            const min = config.min ?? Number.NEGATIVE_INFINITY;
            const max = config.max ?? Number.POSITIVE_INFINITY;
            const clamped = Math.min(max, Math.max(min, next));
            config.set(clamped);
            updateValue();
            config.onChange();
        };

        const decreaseBtn = createDebugButton("−", () => {
            applyChange(-1);
        });
        const increaseBtn = createDebugButton("+", () => {
            applyChange(1);
        });

        const updateValue = () => {
            valueEl.textContent = String(config.get());
        };

        updateValue();

        row.append(labelEl, decreaseBtn, valueEl, increaseBtn);
        group.appendChild(row);
        return row;
    }

    public addBooleanControl(
        group: HTMLElement,
        label: string,
        config: DebugBooleanControlConfig,
    ): HTMLDivElement {
        const row = document.createElement("div");
        row.style.display = "grid";
        row.style.gridTemplateColumns = "1fr auto auto auto";
        row.style.alignItems = "center";
        row.style.gap = "8px";

        const labelEl = document.createElement("span");
        labelEl.textContent = label;
        labelEl.style.whiteSpace = "nowrap";
        labelEl.style.overflow = "hidden";
        labelEl.style.textOverflow = "ellipsis";

        const valueEl = document.createElement("span");
        valueEl.style.minWidth = "36px";
        valueEl.style.textAlign = "center";

        const disableBtn = createDebugButton("−", () => {
            config.set(false);
            updateValue();
            config.onChange();
        });

        const enableBtn = createDebugButton("+", () => {
            config.set(true);
            updateValue();
            config.onChange();
        });

        const updateValue = () => {
            valueEl.textContent = config.get() ? "Да" : "Нет";
        };

        updateValue();

        row.append(labelEl, disableBtn, valueEl, enableBtn);
        group.appendChild(row);
        return row;
    }

    private createPanelElement(): HTMLDivElement {
        const panel = document.createElement("div");
        panel.style.display = "flex";
        panel.style.flexDirection = "column";
        panel.style.gap = "12px";
        panel.style.padding = "16px";
        panel.style.background = "rgba(15, 23, 42, 0.9)";
        panel.style.border = "1px solid rgba(148, 163, 184, 0.3)";
        panel.style.borderRadius = "12px";
        panel.style.color = "#e2e8f0";
        panel.style.fontFamily = "system-ui, sans-serif";
        panel.style.fontSize = "13px";
        panel.style.maxWidth = "320px";
        panel.style.boxShadow = "0 8px 24px rgba(15, 23, 42, 0.35)";
        return panel;
    }
}
