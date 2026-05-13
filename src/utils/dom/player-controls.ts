/**
 * Player control operations.
 * Handles all playback control actions (play/pause, next, previous, like, dislike, mute).
 */

import { DOM_SELECTORS } from '../constants/dom-selectors';
import { logger } from '../core/logger';
import type { CDPExecutor } from '../cdp/cdp-executor';
import { DOMQueryHelper } from './dom-query';

interface ActionResult {
    success: boolean;
    message: string;
}

export class PlayerControls {
    private queryHelper: DOMQueryHelper;

    constructor(private cdpExecutor: CDPExecutor) {
        this.queryHelper = new DOMQueryHelper();
    }

    /**
     * Toggles play/pause state.
     * Newer YM exposes a single PLAY_BUTTON in the player bar that toggles
     * regardless of state — click it directly when scoped to the bar.
     */
    async togglePlayback(): Promise<boolean> {
        logger.info("Toggling playback");

        const result = await this.cdpExecutor.evaluate<ActionResult>(
            `
            (function() {
                try {
                    ${this.queryHelper.buildPlayerBarQuery()}

                    const pauseButton = playerBar.querySelector("${DOM_SELECTORS.PAUSE_BUTTON}");
                    if (pauseButton) {
                        pauseButton.click();
                        return { success: true, message: 'Track paused' };
                    }

                    const playButton = playerBar.querySelector("${DOM_SELECTORS.PLAY_BUTTON}");
                    if (playButton) {
                        playButton.click();
                        return { success: true, message: 'Playback toggled' };
                    }

                    return { success: false, message: 'Play/pause button not found' };
                } catch (err) {
                    return { success: false, message: 'Error: ' + err.message };
                }
            })()
            `,
            { awaitPromise: true }
        );

        if (result?.success) {
            logger.info(result.message);
            return true;
        } else {
            logger.error("Failed to toggle playback: " + (result?.message || 'Unknown error'));
            return false;
        }
    }

    /**
     * Clicks the previous track button.
     */
    async previousTrack(): Promise<boolean> {
        return this.clickButton('PREVIOUS_TRACK_BUTTON', 'Previous track');
    }

    /**
     * Clicks the next track button.
     */
    async nextTrack(): Promise<boolean> {
        return this.clickButton('NEXT_TRACK_BUTTON', 'Next track');
    }

    /**
     * Clicks the like button.
     */
    async likeTrack(): Promise<boolean> {
        return this.clickButton('LIKE_BUTTON', 'Like track');
    }

    /**
     * Clicks the dislike button.
     */
    async dislikeTrack(): Promise<boolean> {
        return this.clickButton('DISLIKE_BUTTON', 'Dislike track');
    }

    /**
     * Toggles mute state.
     */
    async toggleMute(): Promise<boolean> {
        logger.info("Toggling mute");

        const result = await this.cdpExecutor.evaluate<ActionResult>(
            `
            (function() {
                try {
                    ${this.queryHelper.buildPlayerBarQuery()}

                    const muteButton = playerBar.querySelector("${DOM_SELECTORS.MUTE_BUTTON}");
                    if (muteButton) {
                        muteButton.click();
                        return { success: true, message: 'Mute toggled' };
                    }

                    return { success: false, message: 'Mute button not found' };
                } catch (err) {
                    return { success: false, message: 'Error: ' + err.message };
                }
            })()
            `,
            { awaitPromise: true }
        );

        if (result?.success) {
            logger.info(result.message);
            return true;
        } else {
            logger.error("Failed to toggle mute: " + (result?.message || 'Unknown error'));
            return false;
        }
    }

    /**
     * Generic button click handler — always scoped to the player bar so it
     * doesn't accidentally hit duplicate `data-test-id` matches inside
     * NewRelease cards on the home page.
     */
    private async clickButton(buttonId: string, actionDescription: string): Promise<boolean> {
        logger.info("Executing action: " + actionDescription);

        const expression = `
            (function() {
                try {
                    ${this.queryHelper.buildButtonQuery(buttonId)}

                    if (button) {
                        button.click();
                        return { success: true, message: 'Button clicked' };
                    }

                    return { success: false, message: 'Button not found' };
                } catch (err) {
                    return { success: false, message: 'Error: ' + err.message };
                }
            })()
        `;

        const result = await this.cdpExecutor.evaluate<ActionResult>(expression, {
            awaitPromise: true,
        });

        if (result?.success) {
            logger.info(actionDescription + " successful");
            return true;
        } else {
            logger.error(
                "Failed to execute: " + actionDescription + ": " + (result?.message || 'Unknown error')
            );
            return false;
        }
    }
}
