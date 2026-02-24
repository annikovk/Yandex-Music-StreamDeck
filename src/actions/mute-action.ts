import streamDeck, { action, KeyDownEvent, KeyUpEvent, SingletonAction, WillAppearEvent, WillDisappearEvent } from "@elgato/streamdeck";
import { yandexMusicController } from "../utils/yandex-music-controller";
import { trackAction } from "../utils/telemetry/analytics-reporter";

@action({ UUID: "com.annikov.yandex-music.mute" })
export class MuteAction extends SingletonAction {
    private contexts: Set<string> = new Set();
    private checkInterval: NodeJS.Timeout | null = null;
    private lastKnownMutedState: boolean | null = null;
    private suppressPollingUntil: number = 0;
    private verifyTimeout: NodeJS.Timeout | null = null;

    override async onWillAppear(ev: WillAppearEvent): Promise<void> {
        this.contexts.add(ev.action.id);
        if (!this.checkInterval) {
            this.checkInterval = setInterval(() => this.updateStates(), 1000);
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
        trackAction("mute");

        if (!yandexMusicController.isConnected()) {
            const appRunning = await yandexMusicController.ensureAppRunning();
            if (!appRunning) {
                await ev.action.showAlert();
                return;
            }
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        this.suppressPollingUntil = Date.now() + 2000;
        if (this.verifyTimeout) clearTimeout(this.verifyTimeout);

        const optimisticState = !(this.lastKnownMutedState ?? false);
        await this.applyState(optimisticState);

        const result = await yandexMusicController.toggleMute();
        if (!result) {
            await this.applyState(!optimisticState);
            this.suppressPollingUntil = 0;
            await ev.action.showAlert();
            return;
        }

        this.verifyTimeout = setTimeout(async () => {
            this.lastKnownMutedState = null;
            await this.updateStates(true);
        }, 2000);
    }

    override async onKeyUp(ev: KeyUpEvent): Promise<void> {
        if (this.lastKnownMutedState !== null) {
            await (ev.action as any).setState(this.lastKnownMutedState ? 1 : 0);
        }
    }

    private async updateStates(force = false): Promise<void> {
        if (this.contexts.size === 0) return;
        if (!force && Date.now() < this.suppressPollingUntil) return;

        try {
            const isMuted = await yandexMusicController.isMuted();
            if (isMuted === this.lastKnownMutedState) return;
            await this.applyState(isMuted);
        } catch (err) {
            streamDeck.logger.error('[Mute] Error updating states', err);
        }
    }

    private async applyState(isMuted: boolean): Promise<void> {
        this.lastKnownMutedState = isMuted;
        const targetState = isMuted ? 1 : 0;
        for (const contextId of this.contexts) {
            const act = this.actions.find((a) => a.id === contextId);
            if (act && "setState" in act) {
                await (act as any).setState(targetState);
            }
        }
    }
}
