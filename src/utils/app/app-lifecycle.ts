/**
 * Manages application lifecycle tracking.
 * Tracks launch grace period and UI readiness state.
 */

import { APP_LIFECYCLE_CONFIG } from '../constants/config';
import { DOM_SELECTORS } from '../constants/dom-selectors';
import { logger } from '../core/logger';
import type { CDPExecutor } from '../cdp/cdp-executor';

export class AppLifecycleManager {
    private appJustLaunched: boolean = false;
    private appLaunchTimestamp: number = 0;

    /**
     * Marks that the app was just launched.
     * Starts the grace period timer.
     */
    markAppLaunched(): void {
        this.appJustLaunched = true;
        this.appLaunchTimestamp = Date.now();
    }

    /**
     * Resets the launch state.
     * Should be called if launch fails.
     */
    resetLaunchState(): void {
        this.appJustLaunched = false;
        this.appLaunchTimestamp = 0;
    }

    /**
     * Checks if we're within the grace period after app launch.
     * During this period, UI operations should be more forgiving.
     */
    isInLaunchGracePeriod(): boolean {
        if (!this.appJustLaunched) {
            return false;
        }

        const timeSinceLaunch = Date.now() - this.appLaunchTimestamp;
        if (timeSinceLaunch > APP_LIFECYCLE_CONFIG.LAUNCH_GRACE_PERIOD_MS) {
            this.appJustLaunched = false;
            return false;
        }

        return true;
    }

    /**
     * Waits for the Yandex Music UI to be fully loaded and ready.
     * Checks for presence of player bar DOM elements.
     */
    async waitForUIReady(
        cdpExecutor: CDPExecutor,
        timeoutMs: number = APP_LIFECYCLE_CONFIG.UI_READY_TIMEOUT_MS
    ): Promise<boolean> {
        const startTime = Date.now();
        const checkIntervalMs = APP_LIFECYCLE_CONFIG.UI_READY_CHECK_INTERVAL_MS;

        while (Date.now() - startTime < timeoutMs) {
            try {
                const result = await cdpExecutor.evaluate<{ ready: boolean }>(
                    `
                    (function() {
                        const playerBar = document.querySelector("${DOM_SELECTORS.PLAYER_BAR_PRIMARY}") ||
                                        document.querySelector("${DOM_SELECTORS.PLAYER_BAR_FALLBACK}");
                        return { ready: !!playerBar };
                    })()
                    `
                );

                if (result?.ready) {
                    logger.info("UI is ready");
                    return true;
                }
            } catch (error: unknown) {
                // UI not ready yet, continue waiting
            }

            await new Promise(resolve => setTimeout(resolve, checkIntervalMs));
        }

        logger.warn("Timeout waiting for UI to be ready, continuing anyway");
        return true; // Don't fail completely, just warn
    }
}
