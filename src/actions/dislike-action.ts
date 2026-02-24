import { action, KeyDownEvent, SingletonAction } from "@elgato/streamdeck";
import { yandexMusicController } from "../utils/yandex-music-controller";
import { trackAction } from "../utils/telemetry/analytics-reporter";

@action({ UUID: "com.annikov.yandex-music.dislike" })
export class DislikeAction extends SingletonAction {
    override async onKeyDown(ev: KeyDownEvent): Promise<void> {
        trackAction("dislike");

        if (!yandexMusicController.isConnected()) {
            const appRunning = await yandexMusicController.ensureAppRunning();
            if (!appRunning) {
                await ev.action.showAlert();
                return;
            }
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        const result = await yandexMusicController.dislikeTrack();
        if (!result) {
            await ev.action.showAlert();
        }
    }
}
