/**
 * Track information extraction.
 * Extracts track metadata (cover, title, artist) and time information.
 */

import { DOM_SELECTORS } from '../constants/dom-selectors';
import { logger } from '../core/logger';
import type { CDPExecutor } from '../cdp/cdp-executor';
import type { TrackInfo, TrackTime } from '../types/yandex-music.types';

interface TrackInfoResult {
    success: boolean;
    message?: string;
    coverUrl?: string;
    originalCoverUrl?: string;
    title?: string;
    artist?: string;
    diagnostics?: {
        playerBarFound: boolean;
        coverFound: boolean;
        titleFound: boolean;
        artistFound: boolean;
        coverClasses?: string;
        titleClasses?: string;
        artistClasses?: string;
    };
}

interface TrackTimeResult {
    success: boolean;
    message?: string;
    currentTime?: string;
    totalTime?: string;
    progressValue?: number;
    progressMax?: number;
    progressPercent?: number;
}

export class TrackInfoExtractor {
    constructor(
        private cdpExecutor: CDPExecutor,
        private isInGracePeriod?: () => boolean
    ) {}

    /**
     * Gets current track information (cover, title, artist).
     */
    async getTrackInfo(): Promise<TrackInfo | null> {
        try {
            const result = await this.cdpExecutor.evaluate<TrackInfoResult>(
                `
                (function() {
                    try {
                        let playerBar = document.querySelector("${DOM_SELECTORS.PLAYER_BAR_PRIMARY}");
                        let playerBarFound = !!playerBar;
                        if (!playerBar) {
                            playerBar = document.querySelector("${DOM_SELECTORS.PLAYER_BAR_FALLBACK}");
                            playerBarFound = !!playerBar;
                            if (!playerBar) {
                                console.log("Player bar not found");
                                return {
                                    success: false,
                                    message: 'Player bar not found',
                                    diagnostics: { playerBarFound: false, coverFound: false, titleFound: false, artistFound: false }
                                };
                            }
                        }

                        const coverImg = playerBar.querySelector("${DOM_SELECTORS.COVER_IMAGE}");
                        const titleElement = playerBar.querySelector("${DOM_SELECTORS.TRACK_TITLE}");
                        const artistElement = playerBar.querySelector("${DOM_SELECTORS.ARTIST_NAME}");

                        if (coverImg && titleElement && artistElement) {
                            const originalCoverUrl = coverImg.src;
                            const title = titleElement.textContent;
                            const artist = artistElement.textContent;

                            let coverUrl = originalCoverUrl;
                            if (originalCoverUrl.includes('/100x100')) {
                                coverUrl = originalCoverUrl.replace('/100x100', '/400x400');
                            } else if (originalCoverUrl.includes('/200x200')) {
                                coverUrl = originalCoverUrl.replace('/200x200', '/400x400');
                            }

                            console.log("Track info found:", { title, artist, originalCoverUrl, coverUrl });

                            return {
                                success: true,
                                coverUrl: coverUrl,
                                originalCoverUrl: originalCoverUrl,
                                title: title,
                                artist: artist
                            };
                        } else {
                            // Gather diagnostic info
                            const diagnostics = {
                                playerBarFound: playerBarFound,
                                coverFound: !!coverImg,
                                titleFound: !!titleElement,
                                artistFound: !!artistElement,
                                coverClasses: coverImg ? coverImg.className : (playerBar.querySelector('img') ? playerBar.querySelector('img').className : 'no img found'),
                                titleClasses: titleElement ? titleElement.className : 'not found',
                                artistClasses: artistElement ? artistElement.className : 'not found'
                            };
                            console.log("Track info not found. Diagnostics:", diagnostics);
                            return {
                                success: false,
                                message: 'Track info incomplete: ' + JSON.stringify({
                                    cover: !!coverImg,
                                    title: !!titleElement,
                                    artist: !!artistElement
                                }),
                                diagnostics: diagnostics
                            };
                        }
                    } catch (err) {
                        return { success: false, message: 'Error: ' + err.message };
                    }
                })()
                `,
                { awaitPromise: true }
            );

            if (result?.success && result.coverUrl && result.originalCoverUrl && result.title && result.artist) {
                logger.info("Track info retrieved: " + result.title + " by " + result.artist);
                return {
                    coverUrl: result.coverUrl,
                    originalCoverUrl: result.originalCoverUrl,
                    title: result.title,
                    artist: result.artist,
                };
            }

            // Log diagnostic information when track info fails (only if not in grace period)
            if (!this.isInGracePeriod?.()) {
                if (result?.diagnostics) {
                    logger.error(
                        "Track info extraction afailed - CDP connected but DOM elements not found. " +
                        "Diagnostics: " + JSON.stringify(result.diagnostics, null, 2)
                    );
                } else if (result?.message) {
                    logger.error("Track info extraction failed: " + result.message);
                }
            }

            return null;
        } catch (error: unknown) {
            // Silently return null for track info errors
            return null;
        }
    }

    /**
     * Gets current track time information.
     */
    async getTrackTime(): Promise<TrackTime | null> {
        try {
            const result = await this.cdpExecutor.evaluate<TrackTimeResult>(
                `
                (function() {
                    try {
                        let playerBar = document.querySelector("${DOM_SELECTORS.PLAYER_BAR_PRIMARY}");
                        if (!playerBar) {
                            playerBar = document.querySelector("${DOM_SELECTORS.PLAYER_BAR_FALLBACK}");
                            if (!playerBar) return { success: false, message: 'Player bar not found' };
                        }

                        const currentTimeElement = playerBar.querySelector("${DOM_SELECTORS.CURRENT_TIME}");
                        const totalTimeElement = playerBar.querySelector("${DOM_SELECTORS.TOTAL_TIME}");
                        const progressSlider = playerBar.querySelector("${DOM_SELECTORS.PROGRESS_SLIDER}");

                        if (currentTimeElement && totalTimeElement && progressSlider) {
                            const currentTimeText = currentTimeElement.textContent.trim();
                            const totalTimeText = totalTimeElement.textContent.trim();
                            const progressValue = parseFloat(progressSlider.value) || 0;
                            const progressMax = parseFloat(progressSlider.max) || 100;

                            return {
                                success: true,
                                currentTime: currentTimeText,
                                totalTime: totalTimeText,
                                progressValue: progressValue,
                                progressMax: progressMax,
                                progressPercent: (progressValue / progressMax) * 100
                            };
                        } else {
                            return { success: false, message: 'Time elements not found' };
                        }
                    } catch (err) {
                        return { success: false, message: 'Error: ' + err.message };
                    }
                })()
                `,
                { awaitPromise: true }
            );

            if (result?.success && result.currentTime && result.totalTime) {
                return {
                    currentTime: result.currentTime,
                    totalTime: result.totalTime,
                    progressValue: result.progressValue ?? 0,
                    progressMax: result.progressMax ?? 100,
                    progressPercent: result.progressPercent ?? 0,
                };
            } else {
                if (!this.isInGracePeriod?.()) {
                    logger.error("Failed to get track time: " + (result?.message || 'Unknown error'));
                }
                return null;
            }
        } catch (error: unknown) {
            if (!this.isInGracePeriod?.()) {
                logger.error("Error getting track time", error);
            }
            return null;
        }
    }
}
