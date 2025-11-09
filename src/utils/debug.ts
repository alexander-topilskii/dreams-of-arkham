
export function createDebugButton(text: string, onClick: () => void): HTMLElement {
    const button = document.createElement('button');
    button.textContent = 'добавить карту';
    button.id = 'left-top-add-button';

    button.style.position = 'absolute';
    button.style.top = '10px';
    button.style.left = '10px';
    button.style.padding = '6px 12px';
    button.style.background = '#1e293b';
    button.style.color = 'white';
    button.style.border = '1px solid rgba(255,255,255,0.15)';
    button.style.borderRadius = '8px';
    button.style.cursor = 'pointer';
    button.style.backdropFilter = 'blur(6px)';
    button.style.zIndex = '1000';

    button.addEventListener('click', () => {
        onClick.call(button);
    });

    return button
}
