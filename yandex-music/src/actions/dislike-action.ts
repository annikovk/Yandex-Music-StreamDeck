import { action, KeyDownEvent, SingletonAction } from "@elgato/streamdeck";
import { yandexMusicController } from "../utils/yandex-music-controller";
import { trackAction } from "../utils/telemetry/analytics-reporter";

@action({ UUID: "com.annikov.yandex-music.dislike" })
export class DislikeAction extends SingletonAction {
    override async onKeyDown(ev: KeyDownEvent): Promise<void> {
        trackAction("dislike");

        const result = await yandexMusicController.dislikeTrack();
        if (!result) {
            await ev.action.showAlert();
        }
    }
}
