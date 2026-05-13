import streamDeck, { action, KeyDownEvent, KeyUpEvent, SingletonAction, WillAppearEvent, WillDisappearEvent } from "@elgato/streamdeck";
import { yandexMusicController } from "../utils/yandex-music-controller";
import { trackAction } from "../utils/telemetry/analytics-reporter";
import { iconThemeManager } from "../utils/core/icon-theme-manager";

@action({ UUID: "com.annikov.yandex-music.like" })
export class LikeAction extends SingletonAction {
    private contexts: Set<string> = new Set();
    private checkInterval: NodeJS.Timeout | null = null;
    private lastKnownLikedState: boolean | null = null;
    // Suppress polling while an optimistic update is in flight so a stale DOM
    // read cannot overwrite it before likeTrack() completes.
    private suppressPollingUntil: number = 0;
    // Cancellable timer that does an authoritative DOM read after 2 s to
    // self-correct if the optimistic toggle guessed wrong (stale cache).
    private verifyTimeout: NodeJS.Timeout | null = null;

    override async onWillAppear(ev: WillAppearEvent): Promise<void> {
        this.contexts.add(ev.action.id);
        if (!this.checkInterval) {
            this.checkInterval = setInterval(() => this.updateStates(), 1000);
            iconThemeManager.onChange(() => this.refreshIcons());
        }
        await this.updateStates(true);
    }

    override onWillDisappear(ev: WillDisappearEvent): void {
        this.contexts.delete(ev.action.id);
        if (this.contexts.size === 0 && this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
        }
    }

    override async onKeyDown(ev: KeyDownEvent): Promise<void> {
        trackAction("like");

        if (!yandexMusicController.isConnected()) {
            const appRunning = await yandexMusicController.ensureAppRunning();
            if (!appRunning) {
                await ev.action.showAlert();
                return;
            }
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        // Must be set before the first await so no polling tick can sneak in
        // between applyState's internal setState await and this assignment.
        this.suppressPollingUntil = Date.now() + 2000;
        if (this.verifyTimeout) clearTimeout(this.verifyTimeout);

        const optimisticState = !(this.lastKnownLikedState ?? false);
        await this.applyState(optimisticState);

        const result = await yandexMusicController.likeTrack();
        if (!result) {
            await this.applyState(!optimisticState);
            this.suppressPollingUntil = 0;
            await ev.action.showAlert();
            return;
        }

        this.verifyTimeout = setTimeout(async () => {
            this.lastKnownLikedState = null;
            await this.updateStates(true);
        }, 2000);
    }

    override async onKeyUp(ev: KeyUpEvent): Promise<void> {
        // Stream Deck resets the icon to its pre-press state on key release,
        // overriding any setState called during onKeyDown. Re-apply here.
        if (this.lastKnownLikedState !== null) {
            await (ev.action as any).setState(this.lastKnownLikedState ? 1 : 0);
            await ev.action.setImage(this.lastKnownLikedState
                ? iconThemeManager.icons().like
                : iconThemeManager.icons().noLike);
        }
    }

    private async updateStates(force = false): Promise<void> {
        if (this.contexts.size === 0) return;
        if (!force && Date.now() < this.suppressPollingUntil) return;

        try {
            const isLiked = await yandexMusicController.isLiked();
            if (isLiked === this.lastKnownLikedState) return;
            await this.applyState(isLiked);
        } catch (err) {
            streamDeck.logger.error('[Like] Error updating states', err);
        }
    }

    private async applyState(isLiked: boolean): Promise<void> {
        this.lastKnownLikedState = isLiked;
        const targetState = isLiked ? 1 : 0;
        const iconPath = isLiked ? iconThemeManager.icons().like : iconThemeManager.icons().noLike;
        for (const contextId of this.contexts) {
            const act = this.actions.find((a) => a.id === contextId);
            if (act && "setState" in act) {
                await (act as any).setState(targetState);
                await act.setImage(iconPath);
            }
        }
    }

    private async refreshIcons(): Promise<void> {
        if (this.lastKnownLikedState !== null) {
            await this.applyState(this.lastKnownLikedState);
        }
    }
}
