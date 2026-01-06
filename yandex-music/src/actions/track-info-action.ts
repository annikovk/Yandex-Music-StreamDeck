import { action, SingletonAction, WillAppearEvent, WillDisappearEvent } from "@elgato/streamdeck";
import { yandexMusicController } from "../utils/yandex-music-controller";

@action({ UUID: "com.annikov.yandex-music.track-info" })
export class TrackInfoAction extends SingletonAction {
    private contexts: Set<string> = new Set();
    private checkInterval: NodeJS.Timeout | null = null;
    private scrollingText = {
        text: "",
        position: 0,
        maxLength: 12,
        speed: 0.5,
        frameCounter: 0,
    };

    override async onWillAppear(ev: WillAppearEvent): Promise<void> {
        this.contexts.add(ev.action.id);

        if (!this.checkInterval) {
            this.checkInterval = setInterval(() => this.updateTrackInfo(), 500);
        }

        await ev.action.setTitle("Loading...");
    }

    override onWillDisappear(ev: WillDisappearEvent): void {
        this.contexts.delete(ev.action.id);

        if (this.contexts.size === 0 && this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
            this.scrollingText.text = "";
            this.scrollingText.position = 0;
            this.scrollingText.frameCounter = 0;
        }
    }

    private async updateTrackInfo(): Promise<void> {
        if (this.contexts.size === 0) return;

        try {
            const trackInfo = await yandexMusicController.getTrackInfo();
            if (trackInfo && trackInfo.title && trackInfo.artist) {
                const fullText = `${trackInfo.artist} - ${trackInfo.title}`;

                if (this.scrollingText.text !== fullText) {
                    this.scrollingText.text = fullText;
                    this.scrollingText.position = 0;
                    this.scrollingText.frameCounter = 0;
                }

                const currentPosition = Math.floor(this.scrollingText.position);
                const displayText = this.getScrollingText(
                    this.scrollingText.text,
                    currentPosition,
                    this.scrollingText.maxLength
                );

                for (const contextId of this.contexts) {
                    const action = this.actions.find((a) => a.id === contextId);
                    if (action) {
                        await action.setTitle(displayText);
                    }
                }

                this.scrollingText.frameCounter++;
                this.scrollingText.position += this.scrollingText.speed;
            } else {
                for (const contextId of this.contexts) {
                    const action = this.actions.find((a) => a.id === contextId);
                    if (action) {
                        await action.setTitle("No data");
                    }
                }
            }
        } catch (err) {
            // Silently fail during updates
        }
    }

    private getScrollingText(fullText: string, position: number, maxLength: number): string {
        if (fullText.length <= maxLength) {
            return fullText;
        }

        const padding = "   ";
        const extendedText = fullText + padding;
        const totalLength = extendedText.length;

        let startPos = position % totalLength;
        let result = "";

        for (let i = 0; i < maxLength; i++) {
            result += extendedText[(startPos + i) % totalLength];
        }

        return result;
    }
}
