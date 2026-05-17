/**
 * Player state queries.
 * Queries current playback state (playing, liked, muted).
 */

import { DOM_SELECTORS, SVG_ICONS } from '../constants/dom-selectors';
import { logger } from '../core/logger';
import type { CDPExecutor } from '../cdp/cdp-executor';

export class PlayerStateQuery {
    constructor(private cdpExecutor: CDPExecutor) {}

    /**
     * Checks if music is currently playing.
     * Newer YM versions keep `data-test-id='PLAY_BUTTON'` regardless of state
     * and only swap the SVG sprite (#play_filled_* vs #pause_filled_*).
     */
    async isPlaying(): Promise<boolean> {
        try {
            const result = await this.cdpExecutor.evaluate<{ isPlaying: boolean; debug?: string }>(
                `
                (function() {
                    try {
                        let playerBar = document.querySelector("${DOM_SELECTORS.PLAYER_BAR_PRIMARY}")
                            || document.querySelector("${DOM_SELECTORS.PLAYER_BAR_FALLBACK}")
                            || document.querySelector("${DOM_SELECTORS.PLAYER_BAR_VIBE}");
                        if (!playerBar) return { isPlaying: false, debug: 'no-playerbar' };

                        // Newer versions: only PLAY_BUTTON exists, sprite href encodes state.
                        const playButton = playerBar.querySelector("${DOM_SELECTORS.PLAY_BUTTON}");
                        if (playButton) {
                            const use = playButton.querySelector('use');
                            const href = use ? (use.getAttribute('xlink:href') || use.getAttribute('href') || '') : '';
                            if (href.includes('${SVG_ICONS.PAUSE_FILLED}')) return { isPlaying: true, debug: 'sprite-pause' };
                            if (href.includes('${SVG_ICONS.PLAY_FILLED}')) return { isPlaying: false, debug: 'sprite-play' };
                        }

                        // Legacy versions: separate PAUSE_BUTTON appeared while playing.
                        const pauseButton = playerBar.querySelector("${DOM_SELECTORS.PAUSE_BUTTON}");
                        if (pauseButton) return { isPlaying: true, debug: 'legacy-pause-tid' };

                        return { isPlaying: false, debug: 'no-state' };
                    } catch (err) {
                        return { isPlaying: false, debug: 'error: ' + err.message };
                    }
                })()
                `
            );

            return result?.isPlaying ?? false;
        } catch (error: unknown) {
            logger.error("Error checking playback state", error);
            return false;
        }
    }

    /**
     * Checks if current track is liked.
     */
    async isLiked(): Promise<boolean> {
        try {
            const result = await this.cdpExecutor.evaluate<{ isLiked: boolean; debug?: string }>(
                `
                (function() {
                    try {
                        const playerBar = document.querySelector("${DOM_SELECTORS.PLAYER_BAR_PRIMARY}")
                            || document.querySelector("${DOM_SELECTORS.PLAYER_BAR_FALLBACK}")
                            || document.querySelector("${DOM_SELECTORS.PLAYER_BAR_VIBE}");
                        if (!playerBar) return { isLiked: false, debug: 'no-playerbar' };

                        const likeButton = playerBar.querySelector("${DOM_SELECTORS.LIKE_BUTTON}");
                        if (!likeButton) return { isLiked: false, debug: 'no-button' };

                        const ariaPressed = likeButton.getAttribute('aria-pressed');
                        if (ariaPressed === 'true' || ariaPressed === 'false') {
                            return { isLiked: ariaPressed === 'true', debug: 'aria-pressed' };
                        }

                        const use = likeButton.querySelector('use');
                        const href = use ? (use.getAttribute('xlink:href') || use.getAttribute('href') || '') : '';
                        return { isLiked: href.includes('${SVG_ICONS.LIKED}'), debug: 'sprite-href' };
                    } catch (err) {
                        return { isLiked: false, debug: 'error: ' + err.message };
                    }
                })()
                `
            );

            return result?.isLiked ?? false;
        } catch (error: unknown) {
            logger.error("Error checking like state", error);
            return false;
        }
    }

    /**
     * Checks if audio is currently muted.
     */
    async isMuted(): Promise<boolean> {
        try {
            const result = await this.cdpExecutor.evaluate<{ isMuted: boolean; debug?: string }>(
                `
                (function() {
                    try {
                        const playerBar = document.querySelector("${DOM_SELECTORS.PLAYER_BAR_PRIMARY}")
                            || document.querySelector("${DOM_SELECTORS.PLAYER_BAR_FALLBACK}")
                            || document.querySelector("${DOM_SELECTORS.PLAYER_BAR_VIBE}");
                        if (!playerBar) return { isMuted: false, debug: 'no-playerbar' };

                        const muteButton = playerBar.querySelector("${DOM_SELECTORS.MUTE_BUTTON}");
                        if (!muteButton) return { isMuted: false, debug: 'no-button' };

                        const use = muteButton.querySelector('use');
                        const href = use ? (use.getAttribute('xlink:href') || use.getAttribute('href') || '') : '';
                        return { isMuted: href.includes('${SVG_ICONS.VOLUME_OFF}'), debug: 'sprite-href' };
                    } catch (err) {
                        return { isMuted: false, debug: 'error: ' + err.message };
                    }
                })()
                `
            );

            return result?.isMuted ?? false;
        } catch (error: unknown) {
            logger.error("Error checking mute state", error);
            return false;
        }
    }
}
