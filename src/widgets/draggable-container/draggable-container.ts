import Draggabilly from "draggabilly";

export type DraggableContainerPosition = {
    top?: number;
    left?: number;
    right?: number;
    bottom?: number;
};

export type DraggableContainerOptions = {
    container?: HTMLElement;
    initialPosition?: DraggableContainerPosition;
    containment?: Element | string | boolean;
};

export class DraggableContainer {
    public readonly element: HTMLDivElement;
    private readonly draggabilly: Draggabilly;

    constructor(content: HTMLElement, options?: DraggableContainerOptions) {
        const host = options?.container ?? document.body;

        this.element = document.createElement("div");
        this.element.style.position = "fixed";
        this.element.style.zIndex = "2000";
        this.element.style.display = "inline-block";
        this.element.style.touchAction = "none";
        this.element.style.cursor = "grab";
        this.element.style.userSelect = "none";

        this.element.appendChild(content);
        host.appendChild(this.element);

        this.applyInitialPosition(options?.initialPosition);

        this.draggabilly = new Draggabilly(this.element, {
            containment: options?.containment ?? document.body,
        });

        this.draggabilly.on("dragStart", () => {
            const rect = this.element.getBoundingClientRect();
            this.element.style.left = `${rect.left}px`;
            this.element.style.top = `${rect.top}px`;
            this.element.style.right = "";
            this.element.style.bottom = "";
            this.element.style.cursor = "grabbing";
        });

        this.draggabilly.on("dragEnd", () => {
            this.element.style.cursor = "grab";
        });
    }

    public destroy(): void {
        this.draggabilly.destroy();
        this.element.remove();
    }

    private applyInitialPosition(position: DraggableContainerPosition | undefined): void {
        if (!position) {
            this.element.style.right = "24px";
            this.element.style.bottom = "24px";
            return;
        }

        if (typeof position.top === "number") {
            this.element.style.top = `${position.top}px`;
        }
        if (typeof position.left === "number") {
            this.element.style.left = `${position.left}px`;
        }
        if (typeof position.right === "number") {
            this.element.style.right = `${position.right}px`;
        }
        if (typeof position.bottom === "number") {
            this.element.style.bottom = `${position.bottom}px`;
        }

        if (
            typeof position.top !== "number" &&
            typeof position.bottom !== "number"
        ) {
            this.element.style.top = "24px";
        }
        if (
            typeof position.left !== "number" &&
            typeof position.right !== "number"
        ) {
            this.element.style.left = "24px";
        }
    }
}
