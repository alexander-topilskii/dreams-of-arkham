import Draggabilly from "draggabilly";


export function createDraggabilly(
    draggableElement: HTMLElement,
    container?: HTMLElement,
    anchor: Partial<{ top: string; right: string; bottom: string; left: string }> = {bottom: "100px", right: "100px"}
): HTMLElement {
    const containerToPlace = container ?? document.body

    const draggabilly = new Draggabilly(draggableElement, {containment: containerToPlace})

    draggableElement.style.position = "absolute";
    draggableElement.style.width = "200px";
    draggableElement.style.height = "200px";
    draggableElement.style.zIndex = "999";
    draggableElement.style.backdropFilter = "blur(6px)";
    draggableElement.style.color = "#fff";
    draggableElement.style.display = "flex";
    draggableElement.style.alignItems = "center";
    draggableElement.style.justifyContent = "center";
    draggableElement.style.cursor = "grab";
    draggableElement.style.userSelect = "none";
    draggableElement.style.background = "rgba(0,0,0,0.6)";
    draggableElement.style.border = "1px solid rgba(255,255,255,0.15)";
    draggableElement.style.borderRadius = "8px";
    draggableElement.style.userSelect = "none";
    draggableElement.style.boxSizing = "border-box";

    if (anchor?.top) draggableElement.style.top = anchor.top;
    if (anchor?.right) draggableElement.style.right = anchor.right;
    if (anchor?.bottom) draggableElement.style.bottom = anchor.bottom;
    if (anchor?.left) draggableElement.style.left = anchor.left;

    return draggableElement
}