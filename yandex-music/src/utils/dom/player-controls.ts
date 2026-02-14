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
     */
    async togglePlayback(): Promise<boolean> {
        logger.info("Toggling playback");

        const result = await this.cdpExecutor.evaluate<ActionResult>(
            `
            (function() {
                try {
                    // Try finding pause button (means playing)
                    let pauseButton = document.querySelector("${DOM_SELECTORS.PAUSE_BUTTON}");
                    if (pauseButton) {
                        console.log("Found pause button - track is playing");
                        pauseButton.click();
                        return { success: true, message: 'Track paused' };
                    }

                    // Try finding play button (means paused)
                    let playButton = document.querySelector("${DOM_SELECTORS.PLAY_BUTTON}");
                    if (playButton) {
                        if (!playButton.classList.contains("${DOM_SELECTORS.PLAY_BUTTON_WITH_COVER_CLASS}")) {
                            console.log("Found play button - track is paused");
                            playButton.click();
                            return { success: true, message: 'Track playing' };
                        }
                    }

                    // Try finding by SVG icon (pause)
                    const pauseSvg = document.querySelector("${DOM_SELECTORS.PAUSE_SVG_ICON}");
                    if (pauseSvg) {
                        const pauseButton = pauseSvg.closest('button');
                        if (pauseButton) {
                            console.log("Found pause button by SVG icon");
                            pauseButton.click();
                            return { success: true, message: 'Track paused' };
                        }
                    }

                    // Try finding by SVG icon (play)
                    const playSvg = document.querySelector("${DOM_SELECTORS.PLAY_SVG_ICON}");
                    if (playSvg) {
                        const playButton = playSvg.closest('button');
                        if (playButton) {
                            console.log("Found play button by SVG icon");
                            playButton.click();
                            return { success: true, message: 'Track playing' };
                        }
                    }

                    // Fallback: use middle button from sonata controls
                    const sonataButtons = document.querySelectorAll("${DOM_SELECTORS.SONATA_BUTTONS}");
                    if (sonataButtons.length >= 3) {
                        const middleButton = sonataButtons[1];
                        console.log("Using middle button");
                        middleButton.click();
                        return { success: true, message: 'Track toggled' };
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
                    let muteButton = document.querySelector("${DOM_SELECTORS.MUTE_BUTTON}");
                    if (muteButton) {
                        const ariaLabel = muteButton.getAttribute('aria-label');
                        const isMuted = ariaLabel === 'Включить звук';
                        console.log("Mute button found, current state:", isMuted ? "Muted" : "Unmuted");
                        muteButton.click();
                        return { success: true, message: isMuted ? 'Sound on' : 'Sound off' };
                    }

                    // Try finding by SVG icon (muted)
                    const volumeOffSvg = document.querySelector("${DOM_SELECTORS.VOLUME_OFF_SVG}");
                    if (volumeOffSvg) {
                        const muteButton = volumeOffSvg.closest('button');
                        if (muteButton) {
                            console.log("Found mute button by SVG - muted");
                            muteButton.click();
                            return { success: true, message: 'Sound on' };
                        }
                    }

                    // Try finding by SVG icon (unmuted)
                    const volumeSvg = document.querySelector("${DOM_SELECTORS.VOLUME_ON_SVG}");
                    if (volumeSvg) {
                        const muteButton = volumeSvg.closest('button');
                        if (muteButton) {
                            console.log("Found mute button by SVG - unmuted");
                            muteButton.click();
                            return { success: true, message: 'Sound off' };
                        }
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
     * Generic button click handler with fallback for like/dislike buttons.
     */
    private async clickButton(buttonId: string, actionDescription: string): Promise<boolean> {
        logger.info("Executing action: " + actionDescription);

        const isLikeOrDislike = buttonId === 'LIKE_BUTTON' || buttonId === 'DISLIKE_BUTTON';

        const expression = `
            (function() {
                try {
                    ${this.queryHelper.buildButtonQuery(buttonId)}

                    if (button) {
                        console.log("Button found:", "${buttonId}");
                        button.click();
                        return { success: true, message: 'Button clicked' };
                    }

                    ${isLikeOrDislike ? this.queryHelper.buildLikeDislikeFallbackQuery(buttonId) : ''}

                    ${isLikeOrDislike ? `
                    if (button) {
                        console.log("${buttonId} found by position");
                        button.click();
                        return { success: true, message: '${buttonId} clicked' };
                    }
                    ` : ''}

                    console.log("Button not found:", "${buttonId}");
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
