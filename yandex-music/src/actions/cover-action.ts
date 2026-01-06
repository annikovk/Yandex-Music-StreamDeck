import { action, SingletonAction, WillAppearEvent, WillDisappearEvent } from "@elgato/streamdeck";
import { yandexMusicController } from "../utils/yandex-music-controller";
import https from "https";
import http from "http";

@action({ UUID: "com.annikov.yandex-music.cover" })
export class CoverAction extends SingletonAction {
    private contexts: Set<string> = new Set();
    private checkInterval: NodeJS.Timeout | null = null;
    private lastTrackId: string | null = null;

    override async onWillAppear(ev: WillAppearEvent): Promise<void> {
        this.contexts.add(ev.action.id);

        if (!this.checkInterval) {
            this.checkInterval = setInterval(() => this.updateCovers(), 3000);
        }

        await this.updateCover(ev.action);
    }

    override onWillDisappear(ev: WillDisappearEvent): void {
        this.contexts.delete(ev.action.id);

        if (this.contexts.size === 0 && this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
            this.lastTrackId = null;
        }
    }

    private async updateCovers(): Promise<void> {
        if (this.contexts.size === 0) return;

        try {
            const trackInfo = await yandexMusicController.getTrackInfo();
            if (!trackInfo || !trackInfo.coverUrl) return;

            const trackId = `${trackInfo.title}-${trackInfo.artist}`;
            if (trackId === this.lastTrackId) return;

            this.lastTrackId = trackId;

            const dataUrl = await this.downloadImage(trackInfo.coverUrl);
            if (dataUrl) {
                for (const contextId of this.contexts) {
                    const action = this.actions.find((a) => a.id === contextId);
                    if (action) {
                        await action.setImage(dataUrl);
                    }
                }
            }
        } catch (err) {
            // Silently fail during cover updates
        }
    }

    private async updateCover(action: any): Promise<void> {
        try {
            const trackInfo = await yandexMusicController.getTrackInfo();
            if (!trackInfo || !trackInfo.coverUrl) return;

            const trackId = `${trackInfo.title}-${trackInfo.artist}`;
            this.lastTrackId = trackId;

            const dataUrl = await this.downloadImage(trackInfo.coverUrl);
            if (dataUrl) {
                await action.setImage(dataUrl);
            }
        } catch (err) {
            // Silently fail
        }
    }

    private async downloadImage(imageUrl: string): Promise<string | null> {
        return new Promise((resolve, reject) => {
            const client = imageUrl.startsWith("https:") ? https : http;

            client
                .get(imageUrl, (response) => {
                    if (response.statusCode !== 200) {
                        reject(new Error(`HTTP ${response.statusCode}`));
                        return;
                    }

                    const chunks: Uint8Array[] = [];
                    let totalLength = 0;

                    response.on("data", (chunk: Uint8Array) => {
                        chunks.push(chunk);
                        totalLength += chunk.length;
                    });

                    response.on("end", () => {
                        try {
                            const buffer = Buffer.concat(chunks as any, totalLength);
                            const contentType = response.headers["content-type"] || "image/jpeg";
                            const base64Data = buffer.toString("base64");
                            const dataUrl = `data:${contentType};base64,${base64Data}`;
                            resolve(dataUrl);
                        } catch (error) {
                            reject(error);
                        }
                    });

                    response.on("error", (error) => {
                        reject(error);
                    });
                })
                .on("error", (error) => {
                    reject(error);
                });
        });
    }
}
