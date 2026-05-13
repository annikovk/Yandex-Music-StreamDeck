import { action, KeyDownEvent, SingletonAction, WillAppearEvent, WillDisappearEvent } from "@elgato/streamdeck";
import { yandexMusicController } from "../utils/yandex-music-controller";
import { trackAction } from "../utils/telemetry/analytics-reporter";
import { iconThemeManager } from "../utils/core/icon-theme-manager";

@action({ UUID: "com.annikov.yandex-music.next" })
export class NextTrackAction extends SingletonAction {
    private unsubscribeTheme: (() => void) | null = null;

    override async onWillAppear(ev: WillAppearEvent): Promise<void> {
        await ev.action.setImage(iconThemeManager.icons().next);
        this.unsubscribeTheme ??= iconThemeManager.onChange(() => this.refreshIcon());
    }

    override onWillDisappear(_ev: WillDisappearEvent): void {
        if (this.actions.length === 0) {
            this.unsubscribeTheme?.();
            this.unsubscribeTheme = null;
        }
    }

    override async onKeyDown(ev: KeyDownEvent): Promise<void> {
        trackAction("next");

        // Ensure app is running before executing action
        if (!yandexMusicController.isConnected()) {
            const appRunning = await yandexMusicController.ensureAppRunning();
            if (!appRunning) {
                await ev.action.showAlert();
                return;
            }
            // Small buffer after first launch
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        const result = await yandexMusicController.nextTrack();
        if (!result) {
            await ev.action.showAlert();
        }
    }

    private async refreshIcon(): Promise<void> {
        for (const act of this.actions) {
            await act.setImage(iconThemeManager.icons().next);
        }
    }
}
