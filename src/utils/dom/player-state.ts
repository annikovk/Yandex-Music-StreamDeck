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
            const result = await this.cdpExecutor.evaluate<{ isLiked: boolean; debug?: string }>(
                `
                (function() {
                    try {
                        let playerBar = document.querySelector("${DOM_SELECTORS.PLAYER_BAR_PRIMARY}");
                        if (!playerBar) {
                            playerBar = document.querySelector("${DOM_SELECTORS.PLAYER_BAR_FALLBACK}");
                            if (!playerBar) {
                                console.log('[Like State] Player bar not found');
                                return { isLiked: false, debug: 'no-playerbar' };
                            }
                        }

                        // Try finding like button by test ID
                        let likeButton = playerBar.querySelector("${DOM_SELECTORS.LIKE_BUTTON}");
                        if (likeButton) {
                            const ariaPressed = likeButton.getAttribute('aria-pressed');
                            const isLiked = ariaPressed === 'true';
                            const svgUse = likeButton.querySelector('svg use');
                            const likeIconHref = svgUse?.getAttribute('xlink:href');
                            const isLikedBySvg = likeIconHref && likeIconHref.includes('${SVG_ICONS.LIKED}');

                            console.log('[Like State] Found like button:', {
                                ariaPressed,
                                likeIconHref,
                                isLiked,
                                isLikedBySvg,
                                finalState: isLiked || isLikedBySvg
                            });

                            return { isLiked: isLiked || isLikedBySvg, debug: 'primary-method' };
                        }

                        // Fallback: find by position in sonata section
                        const sonataSection = playerBar.querySelector("${DOM_SELECTORS.SONATA_SECTION}");
                        if (sonataSection) {
                            const likeButton = sonataSection.querySelector('button:last-of-type');
                            if (likeButton) {
                                const ariaPressed = likeButton.getAttribute('aria-pressed');
                                const isLiked = ariaPressed === 'true';
                                const svgUse = likeButton.querySelector('svg use');
                                const likeIconHref = svgUse?.getAttribute('xlink:href');
                                const isLikedBySvg = likeIconHref && likeIconHref.includes('${SVG_ICONS.LIKED}');

                                console.log('[Like State] Found like button (fallback):', {
                                    ariaPressed,
                                    likeIconHref,
                                    isLiked,
                                    isLikedBySvg,
                                    finalState: isLiked || isLikedBySvg
                                });

                                return { isLiked: isLiked || isLikedBySvg, debug: 'fallback-method' };
                            }
                        }

                        console.log('[Like State] Like button not found');
                        return { isLiked: false, debug: 'no-button' };
                    } catch (err) {
                        console.log('[Like State] Error:', err);
                        return { isLiked: false, debug: 'error' };
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
                        // Try finding mute button by test ID
                        let muteButton = document.querySelector("${DOM_SELECTORS.MUTE_BUTTON}");
                        if (muteButton) {
                            // Check SVG icon (language-independent)
                            const svgUse = muteButton.querySelector('svg use');
                            const svgHref = svgUse ? svgUse.getAttribute('xlink:href') : null;

                            if (svgHref) {
                                const isMuted = svgHref.includes('${SVG_ICONS.VOLUME_OFF}');

                                console.log('[Mute State] Detected via SVG:', {
                                    svgHref,
                                    isMuted
                                });

                                return { isMuted, debug: 'svg-href-method' };
                            }
                        }

                        // Fallback: Direct SVG selector check
                        const volumeOffSvg = document.querySelector("${DOM_SELECTORS.VOLUME_OFF_SVG}");
                        if (volumeOffSvg) {
                            console.log('[Mute State] Detected via direct SVG selector');
                            return { isMuted: true, debug: 'svg-direct-method' };
                        }

                        console.log('[Mute State] Mute button not found or not muted');
                        return { isMuted: false, debug: 'no-button' };
                    } catch (err) {
                        console.log('[Mute State] Error:', err);
                        return { isMuted: false, debug: 'error' };
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
