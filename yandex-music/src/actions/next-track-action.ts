import { action, KeyDownEvent, SingletonAction } from "@elgato/streamdeck";
import { yandexMusicController } from "../utils/yandex-music-controller";
import { trackAction } from "../utils/analytics";

@action({ UUID: "com.annikov.yandex-music.next" })
export class NextTrackAction extends SingletonAction {
    override async onKeyDown(ev: KeyDownEvent): Promise<void> {
        trackAction("next");

        const result = await yandexMusicController.nextTrack();
        if (!result) {
            await ev.action.showAlert();
        }
    }
}
