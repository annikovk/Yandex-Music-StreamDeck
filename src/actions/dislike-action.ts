import { action, KeyDownEvent, SingletonAction } from "@elgato/streamdeck";
import { yandexMusicController } from "../utils/yandex-music-controller";
import { trackAction } from "../utils/telemetry/analytics-reporter";

@action({ UUID: "com.annikov.yandex-music.dislike" })
export class DislikeAction extends SingletonAction {
    override async onKeyDown(ev: KeyDownEvent): Promise<void> {
        trackAction("dislike");

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

        const result = await yandexMusicController.dislikeTrack();
        if (!result) {
            await ev.action.showAlert();
        }
    }
}
