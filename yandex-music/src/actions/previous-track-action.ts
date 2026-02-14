import { action, KeyDownEvent, SingletonAction } from "@elgato/streamdeck";
import { yandexMusicController } from "../utils/yandex-music-controller";
import { trackAction } from "../utils/telemetry/analytics-reporter";

@action({ UUID: "com.annikov.yandex-music.previous" })
export class PreviousTrackAction extends SingletonAction {
    override async onKeyDown(ev: KeyDownEvent): Promise<void> {
        trackAction("previous");
        const result = await yandexMusicController.previousTrack();
        if (!result) {
            await ev.action.showAlert();
        }
    }
}
