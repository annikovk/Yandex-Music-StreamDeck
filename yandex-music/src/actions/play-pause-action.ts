import { action, KeyDownEvent, SingletonAction, WillAppearEvent, WillDisappearEvent } from "@elgato/streamdeck";
import { yandexMusicController } from "../utils/yandex-music-controller";

@action({ UUID: "com.annikov.yandex-music.play-pause" })
export class PlayPauseAction extends SingletonAction {
    private contexts: Set<string> = new Set();
    private checkInterval: NodeJS.Timeout | null = null;

    override async onWillAppear(ev: WillAppearEvent): Promise<void> {
        this.contexts.add(ev.action.id);

        if (!this.checkInterval) {
            this.checkInterval = setInterval(() => this.updateStates(), 500);
        }

        await this.updateState(ev.action);
    }

    override onWillDisappear(ev: WillDisappearEvent): void {
        this.contexts.delete(ev.action.id);

        if (this.contexts.size === 0 && this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
        }
    }

    override async onKeyDown(ev: KeyDownEvent): Promise<void> {
        const result = await yandexMusicController.togglePlayback();
        if (!result) {
            await ev.action.showAlert();
        }
    }

    private async updateStates(): Promise<void> {
        if (this.contexts.size === 0) return;

        try {
            const isPlaying = await yandexMusicController.isPlaying();
            for (const contextId of this.contexts) {
                const action = this.actions.find((a) => a.id === contextId);
                if (action && "setState" in action) {
                    await (action as any).setState(isPlaying ? 1 : 0);
                }
            }
        } catch (err) {
            // Silently fail during state checks
        }
    }

    private async updateState(action: any): Promise<void> {
        try {
            const isPlaying = await yandexMusicController.isPlaying();
            if ("setState" in action) {
                await action.setState(isPlaying ? 1 : 0);
            }
        } catch (err) {
            // Silently fail
        }
    }
}
