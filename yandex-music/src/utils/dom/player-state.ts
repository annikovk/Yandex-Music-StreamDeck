/**
 * Player state queries.
 * Queries current playback state (playing, liked, muted).
 */

import { DOM_SELECTORS, SVG_ICONS, ARIA_LABELS } from '../constants/dom-selectors';
import { logger } from '../core/logger';
import type { CDPExecutor } from '../cdp/cdp-executor';

export class PlayerStateQuery {
    constructor(private cdpExecutor: CDPExecutor) {}

    /**
     * Checks if music is currently playing.
     */
    async isPlaying(): Promise<boolean> {
        try {
            const result = await this.cdpExecutor.evaluate<{ isPlaying: boolean }>(
                `
                (function() {
                    // Check for pause button (means playing)
                    let pauseButton = document.querySelector("${DOM_SELECTORS.PAUSE_BUTTON}");
                    if (pauseButton) return { isPlaying: true };

                    // Check for play button (means paused)
                    let playButton = document.querySelector("${DOM_SELECTORS.PLAY_BUTTON}");
                    if (playButton) return { isPlaying: false };

                    // Check by SVG icon (pause)
                    const pauseSvg = document.querySelector("${DOM_SELECTORS.PAUSE_SVG_ICON}");
                    if (pauseSvg) return { isPlaying: true };

                    // Check by SVG icon (play)
                    const playSvg = document.querySelector("${DOM_SELECTORS.PLAY_SVG_ICON}");
                    if (playSvg) return { isPlaying: false };

                    return { isPlaying: false };
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
            const result = await this.cdpExecutor.evaluate<{ isLiked: boolean }>(
                `
                (function() {
                    try {
                        let playerBar = document.querySelector("${DOM_SELECTORS.PLAYER_BAR_PRIMARY}");
                        if (!playerBar) {
                            playerBar = document.querySelector("${DOM_SELECTORS.PLAYER_BAR_FALLBACK}");
                            if (!playerBar) return { isLiked: false };
                        }

                        // Try finding like button by test ID
                        let likeButton = playerBar.querySelector("${DOM_SELECTORS.LIKE_BUTTON}");
                        if (likeButton) {
                            const isLiked = likeButton.getAttribute('aria-pressed') === 'true';
                            const likeIconHref = likeButton.querySelector('svg use')?.getAttribute('xlink:href');
                            const isLikedBySvg = likeIconHref && likeIconHref.includes('${SVG_ICONS.LIKED}');
                            return { isLiked: isLiked || isLikedBySvg };
                        }

                        // Fallback: find by position in sonata section
                        const sonataSection = playerBar.querySelector("${DOM_SELECTORS.SONATA_SECTION}");
                        if (sonataSection) {
                            const likeButton = sonataSection.querySelector('button:last-of-type');
                            if (likeButton) {
                                const isLiked = likeButton.getAttribute('aria-pressed') === 'true';
                                const likeIconHref = likeButton.querySelector('svg use')?.getAttribute('xlink:href');
                                const isLikedBySvg = likeIconHref && likeIconHref.includes('${SVG_ICONS.LIKED}');
                                return { isLiked: isLiked || isLikedBySvg };
                            }
                        }

                        return { isLiked: false };
                    } catch (err) {
                        return { isLiked: false };
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
            const result = await this.cdpExecutor.evaluate<{ isMuted: boolean }>(
                `
                (function() {
                    // Try finding mute button by test ID and aria-label
                    let muteButton = document.querySelector("${DOM_SELECTORS.MUTE_BUTTON}");
                    if (muteButton) {
                        const ariaLabel = muteButton.getAttribute('aria-label');
                        const isMuted = ariaLabel === '${ARIA_LABELS.MUTE_BUTTON_MUTED}';
                        return { isMuted };
                    }

                    // Check by SVG icon (muted)
                    const volumeOffSvg = document.querySelector("${DOM_SELECTORS.VOLUME_OFF_SVG}");
                    if (volumeOffSvg) return { isMuted: true };

                    return { isMuted: false };
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
