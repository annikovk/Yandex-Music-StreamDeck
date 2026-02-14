import { action, KeyDownEvent, SingletonAction, WillAppearEvent, WillDisappearEvent } from "@elgato/streamdeck";
import http from "http";
import https from "https";
import { yandexMusicController } from "../utils/yandex-music-controller";
import { trackAction } from "../utils/analytics";

/**
 * Constants
 */
const UPDATE_INTERVAL_MS = 3000;
const DEFAULT_IMAGE = "imgs/App-logo";
const CATEGORY_IMAGE = "imgs/category-icon";
const STATE_PAUSED = 0;
const STATE_PLAYING = 1;

// Play button SVG path (centered, white)
const PLAY_BUTTON_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="144" height="144" viewBox="0 0 144 144">
  <circle cx="72" cy="72" r="36" fill="rgba(0,0,0,0.6)"/>
  <path fill="#ffffff" d="M62 52 L92 72 L62 92 Z"/>
</svg>`;

const PLAY_BUTTON_BASE64 = Buffer.from(PLAY_BUTTON_SVG).toString("base64");

/**
 * PlayPauseAction - Controls Yandex Music playback and displays album cover
 */
@action({ UUID: "com.annikov.yandex-music.play-pause" })
export class PlayPauseAction extends SingletonAction {
    private contexts: Set<string> = new Set();
    private checkInterval: NodeJS.Timeout | null = null;
    private lastTrackId: string | null = null;

    // ==================== Lifecycle Methods ====================

    override async onWillAppear(ev: WillAppearEvent): Promise<void> {
        this.contexts.add(ev.action.id);
        this.startUpdateInterval();
        await this.updateCover(ev.action);
    }

    override async onKeyDown(ev: KeyDownEvent): Promise<void> {
        await this.handlePlayPauseToggle(ev);
    }

    override onWillDisappear(ev: WillDisappearEvent): void {
        this.contexts.delete(ev.action.id);
        this.stopUpdateIntervalIfNeeded();
    }

    // ==================== Action Handlers ====================

    private async handlePlayPauseToggle(ev: KeyDownEvent): Promise<void> {
        trackAction("play-pause");

        if (!yandexMusicController.isConnected()) {
            const appRunning = await yandexMusicController.ensureAppRunning();
            if (!appRunning) {
                await ev.action.showAlert();
                return;
            }

            // Small buffer after first launch
            // ensureAppRunning already waits for UI readiness,
            // but add 500ms cushion before first toggle
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        const result = await yandexMusicController.togglePlayback();
        if (!result) {
            await ev.action.showAlert();
        } else {
            await this.updateCovers();
        }
    }

    // ==================== Update Interval Management ====================

    private startUpdateInterval(): void {
        if (!this.checkInterval) {
            this.checkInterval = setInterval(() => this.updateCovers(), UPDATE_INTERVAL_MS);
        }
    }

    private stopUpdateIntervalIfNeeded(): void {
        if (this.contexts.size === 0 && this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
            this.lastTrackId = null;
        }
    }

    // ==================== Cover Update Logic ====================

    private async updateCovers(): Promise<void> {
        if (this.contexts.size === 0) return;

        try {
            if (!yandexMusicController.isConnected()) {
                await this.setDefaultImageForAllContexts();
                this.lastTrackId = null;
                return;
            }

            const isPlaying = await yandexMusicController.isPlaying();
            const trackInfo = await yandexMusicController.getTrackInfo();

            if (!trackInfo || !trackInfo.coverUrl) return;
            if (!this.hasTrackChanged(trackInfo, isPlaying)) return;

            this.lastTrackId = this.buildTrackId(trackInfo, isPlaying);
            await this.updateAllContextImages(trackInfo.coverUrl, isPlaying);
        } catch (err) {
            // Silently fail during cover updates
        }
    }

    private async updateCover(action: any): Promise<void> {
        try {
            if (!yandexMusicController.isConnected()) {
                await action.setImage(CATEGORY_IMAGE);
                return;
            }

            const isPlaying = await yandexMusicController.isPlaying();
            const trackInfo = await yandexMusicController.getTrackInfo();

            if (!trackInfo || !trackInfo.coverUrl) return;

            this.lastTrackId = this.buildTrackId(trackInfo, isPlaying);
            await this.setActionImage(action, trackInfo.coverUrl, isPlaying);
        } catch (err) {
            // Silently fail
        }
    }

    // ==================== Helper Methods ====================

    private async setDefaultImageForAllContexts(): Promise<void> {
        for (const contextId of this.contexts) {
            const action = this.actions.find((a) => a.id === contextId);
            if (action) {
                await action.setImage(DEFAULT_IMAGE);
            }
        }
    }

    private async updateAllContextImages(coverUrl: string, isPlaying: boolean): Promise<void> {
        for (const contextId of this.contexts) {
            const action = this.actions.find((a) => a.id === contextId);
            if (action) {
                await this.setActionImage(action, coverUrl, isPlaying);
            }
        }
    }

    private async setActionImage(action: any, coverUrl: string, isPlaying: boolean): Promise<void> {
        const dataUrl = await this.downloadImage(coverUrl);
        if (dataUrl) {
            if (isPlaying) {
                await action.setImage(dataUrl);
            } else {
                const overlayedImage = this.createPausedOverlay(dataUrl);
                await action.setImage(overlayedImage);
            }
        }
        await action.setState(isPlaying ? STATE_PLAYING : STATE_PAUSED);
    }

    private createPausedOverlay(coverDataUrl: string): string {
        // Create an SVG that layers the cover image with a play button overlay
        const svg = `
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="144" height="144" viewBox="0 0 144 144">
  <image href="${coverDataUrl}" width="144" height="144"/>
  <image href="data:image/svg+xml;base64,${PLAY_BUTTON_BASE64}" width="144" height="144"/>
</svg>`;
        return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
    }

    private buildTrackId(trackInfo: { title: string; artist: string }, isPlaying: boolean): string {
        return `${trackInfo.title}-${trackInfo.artist}-${isPlaying}`;
    }

    private hasTrackChanged(trackInfo: { title: string; artist: string }, isPlaying: boolean): boolean {
        const currentTrackId = this.buildTrackId(trackInfo, isPlaying);
        return currentTrackId !== this.lastTrackId;
    }

    // ==================== Image Download ====================

    private async downloadImage(imageUrl: string): Promise<string | null> {
        return new Promise((resolve, reject) => {
            const client = this.getHttpClient(imageUrl);

            client
                .get(imageUrl, (response) => {
                    if (response.statusCode !== 200) {
                        reject(new Error(`HTTP ${response.statusCode}`));
                        return;
                    }

                    this.handleImageResponse(response, resolve, reject);
                })
                .on("error", reject);
        });
    }

    private getHttpClient(url: string): typeof http | typeof https {
        return url.startsWith("https:") ? https : http;
    }

    private handleImageResponse(
        response: http.IncomingMessage,
        resolve: (value: string | null) => void,
        reject: (reason?: any) => void
    ): void {
        const chunks: Uint8Array[] = [];
        let totalLength = 0;

        response.on("data", (chunk: Uint8Array) => {
            chunks.push(chunk);
            totalLength += chunk.length;
        });

        response.on("end", () => {
            try {
                const dataUrl = this.convertToDataUrl(chunks, totalLength, response.headers["content-type"]);
                resolve(dataUrl);
            } catch (error) {
                reject(error);
            }
        });

        response.on("error", reject);
    }

    private convertToDataUrl(chunks: Uint8Array[], totalLength: number, contentType?: string): string {
        const buffer = Buffer.concat(chunks as any, totalLength);
        const type = contentType || "image/jpeg";
        const base64Data = buffer.toString("base64");
        return `data:${type};base64,${base64Data}`;
    }
}
