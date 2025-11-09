export function createDebugButton(text: string, onClick: () => void): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = text;

    button.style.padding = '6px 10px';
    button.style.background = 'rgba(30, 41, 59, 0.85)';
    button.style.color = '#e2e8f0';
    button.style.border = '1px solid rgba(148, 163, 184, 0.3)';
    button.style.borderRadius = '6px';
    button.style.cursor = 'pointer';
    button.style.fontSize = '12px';
    button.style.lineHeight = '1';
    button.style.transition = 'background 120ms ease, border-color 120ms ease';

    button.addEventListener('mouseenter', () => {
        button.style.background = 'rgba(51, 65, 85, 0.9)';
        button.style.borderColor = 'rgba(148, 163, 184, 0.45)';
    });

    button.addEventListener('mouseleave', () => {
        button.style.background = 'rgba(30, 41, 59, 0.85)';
        button.style.borderColor = 'rgba(148, 163, 184, 0.3)';
    });

    button.addEventListener('click', onClick);

    return button;
}
