import { IconTheme, ICON_THEMES } from '../constants/icon-themes';

class IconThemeManager {
    private theme: IconTheme = 'white';
    private callbacks: Set<() => void> = new Set();

    get current(): IconTheme { return this.theme; }

    icons() { return ICON_THEMES[this.theme]; }

    update(theme: IconTheme): void {
        if (this.theme === theme) return;
        this.theme = theme;
        this.callbacks.forEach(cb => cb());
    }

    onChange(cb: () => void): () => void {
        this.callbacks.add(cb);
        return () => this.callbacks.delete(cb);
    }
}

export const iconThemeManager = new IconThemeManager();
