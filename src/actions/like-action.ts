import streamDeck, { action, KeyDownEvent, SingletonAction, WillAppearEvent, WillDisappearEvent } from "@elgato/streamdeck";
import { yandexMusicController } from "../utils/yandex-music-controller";
import { trackAction } from "../utils/telemetry/analytics-reporter";

@action({ UUID: "com.annikov.yandex-music.like" })
export class LikeAction extends SingletonAction {
    private contexts: Set<string> = new Set();
    private checkInterval: NodeJS.Timeout | null = null;

    override async onWillAppear(ev: WillAppearEvent): Promise<void> {
        this.contexts.add(ev.action.id);

        if (!this.checkInterval) {
            this.checkInterval = setInterval(() => this.updateStates(), 1000);
        }

        await this.updateState(ev.action);
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

        // Ensure app is running before executing action
        if (!yandexMusicController.isConnected()) {
            const appRunning = await yandexMusicController.ensureAppRunning();
            if (!appRunning) {
                await ev.action.showAlert();
                return;
            }
            // Small buffeasdr after first launch
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        const result = await yandexMusicController.likeTrack();
        if (!result) {
            await ev.action.showAlert();
        } else {
            await this.updateStates(); // Immediate visual feedback
        }
    }

    private async updateStates(): Promise<void> {
        if (this.contexts.size === 0) {
            streamDeck.logger.info('[Like] No contexts, skipping update');
            return;
        }

        try {
            const isLiked = await yandexMusicController.isLiked();
            const targetState = isLiked ? 1 : 0;
            streamDeck.logger.info(`[Like] Updating states: isLiked=${isLiked}, targetState=${targetState}, contexts=${this.contexts.size}`);

            for (const contextId of this.contexts) {
                const action = this.actions.find((a) => a.id === contextId);
                if (action && "setState" in action) {
                    streamDeck.logger.info(`[Like] Setting state to ${targetState} for context ${contextId}`);
                    await (action as any).setState(targetState);
                } else {
                    streamDeck.logger.warn(`[Like] Action not found or no setState for context ${contextId}`);
                }
            }
        } catch (err) {
            streamDeck.logger.error('[Like] Error updating states', err);
        }
    }

    private async updateState(action: any): Promise<void> {
        try {
            const isLiked = await yandexMusicController.isLiked();
            const targetState = isLiked ? 1 : 0;
            streamDeck.logger.info(`[Like] updateState called: isLiked=${isLiked}, targetState=${targetState}`);
            if ("setState" in action) {
                await action.setState(targetState);
                streamDeck.logger.info(`[Like] State set successfully to ${targetState}`);
            } else {
                streamDeck.logger.warn('[Like] Action does not have setState method');
            }
        } catch (err) {
            streamDeck.logger.error('[Like] Error in updateState', err);
        }
    }
}
