import { action, SingletonAction, WillAppearEvent, WillDisappearEvent } from "@elgato/streamdeck";
import { yandexMusicController } from "../utils/yandex-music-controller";

@action({ UUID: "com.annikov.yandex-music.time-total" })
export class TimeTotalAction extends SingletonAction {
    private contexts: Set<string> = new Set();
    private checkInterval: NodeJS.Timeout | null = null;
    private lastTimeInfo: string | null = null;

    override async onWillAppear(ev: WillAppearEvent): Promise<void> {
        this.contexts.add(ev.action.id);

        if (!this.checkInterval) {
            this.checkInterval = setInterval(() => this.updateTime(), 1000);
        }

        await ev.action.setTitle("0:00\n0:00");
    }

    override onWillDisappear(ev: WillDisappearEvent): void {
        this.contexts.delete(ev.action.id);

        if (this.contexts.size === 0 && this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
            this.lastTimeInfo = null;
        }
    }

    private async updateTime(): Promise<void> {
        if (this.contexts.size === 0) return;

        try {
            const timeInfo = await yandexMusicController.getTrackTime();
            if (timeInfo && timeInfo.currentTime && timeInfo.totalTime) {
                const timeData = `${timeInfo.currentTime}\n${timeInfo.totalTime}`;

                if (timeData !== this.lastTimeInfo) {
                    this.lastTimeInfo = timeData;

                    for (const contextId of this.contexts) {
                        const action = this.actions.find((a) => a.id === contextId);
                        if (action) {
                            await action.setTitle(timeData);
                        }
                    }
                }
            } else {
                if (this.lastTimeInfo) {
                    this.lastTimeInfo = null;
                }
            }
        } catch (err) {
            // Silently fail during updates
        }
    }
}
