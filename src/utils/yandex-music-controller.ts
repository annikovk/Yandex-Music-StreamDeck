/**
 * Yandex Music Controller - Thin Facade
 * Delegates to specialized modules for all operations.
 */

import { CDP_CONFIG, RETRY_CONFIG } from './constants/config';
import { logger } from './core/logger';
import type { TrackInfo, TrackTime } from './types/yandex-music.types';
import { getCustomExecutablePath } from './core/settings';

// CDP modules
import { CDPClientManager } from './cdp/cdp-client';
import { CDPReconnectionManager } from './cdp/cdp-connection';
import { CDPExecutor } from './cdp/cdp-executor';

// App modules
import { AppDetector } from './app/app-detector';
import { AppLauncher } from './app/app-launcher';
import { AppLifecycleManager } from './app/app-lifecycle';

// DOM modules
import { PlayerControls } from './dom/player-controls';
import { PlayerStateQuery } from './dom/player-state';
import { TrackInfoExtractor } from './dom/track-info';

export class YandexMusicController {
    // CDP components
    private cdpClient: CDPClientManager;
    private cdpReconnection: CDPReconnectionManager;
    private cdpExecutor: CDPExecutor;

    // App components
    private appDetector: AppDetector;
    private appLauncher: AppLauncher;
    private appLifecycle: AppLifecycleManager;

    // DOM components
    private playerControls: PlayerControls;
    private playerState: PlayerStateQuery;
    private trackInfo: TrackInfoExtractor;

    constructor() {
        // Initialize CDP components
        this.cdpClient = new CDPClientManager();
        this.cdpReconnection = new CDPReconnectionManager();
        this.cdpExecutor = new CDPExecutor(
            () => this.cdpClient.getClient(),
            () => this.isInAnyGracePeriod()
        );

        // Initialize app components
        this.appDetector = new AppDetector();
        this.appLauncher = new AppLauncher(this.appDetector, CDP_CONFIG.DEFAULT_PORT);
        this.appLifecycle = new AppLifecycleManager();

        // Initialize DOM components
        this.playerControls = new PlayerControls(this.cdpExecutor);
        this.playerState = new PlayerStateQuery(this.cdpExecutor);
        this.trackInfo = new TrackInfoExtractor(
            this.cdpExecutor,
            () => this.isInAnyGracePeriod()
        );

        // Set up reconnection callback
        this.cdpClient.setOnDisconnect(() => {
            logger.error("CDP connection lost, attempting reconnection");
            this.cdpReconnection.attemptReconnect(() => this.connect());
        });
    }

    // ==================== Port Management ====================

    async setPort(newPort: number): Promise<boolean> {
        const changed = this.cdpClient.setPort(newPort);
        if (!changed) {
            return false;
        }

        logger.info(`Changing port from ${this.cdpClient.getPort()} to ${newPort}`);

        await this.disconnect();
        this.cdpReconnection.resetAttempts();
        this.appLauncher.setPort(newPort);

        try {
            await this.connect();
            logger.info(`Successfully connected to new port ${newPort}`);
            return true;
        } catch (error: unknown) {
            logger.error(`Error connecting to new port ${newPort}`, error);
            return false;
        }
    }

    // ==================== Connection Management ====================

    async connect(): Promise<void> {
        try {
            await this.cdpClient.connect();
            this.cdpReconnection.resetAttempts();
        } catch (error: unknown) {
            throw error;
        }
    }

    async disconnect(): Promise<void> {
        await this.cdpClient.disconnect();
    }

    isConnected(): boolean {
        return this.cdpClient.isConnected();
    }

    /**
     * Checks if we're in any grace period (app launch or connection).
     * During grace periods, error reporting is suppressed to avoid false positives.
     */
    private isInAnyGracePeriod(): boolean {
        return this.appLifecycle.isInLaunchGracePeriod() ||
               this.cdpClient.getConnectionLifecycle().isInConnectionGracePeriod();
    }

    async getClient(): Promise<unknown> {
        try {
            await this.connect();
            return this.cdpClient.getClient();
        } catch (error: unknown) {
            logger.error("Failed to get CDP client", error);
            return null;
        }
    }

    // ==================== App Detection ====================

    async detectMacOSAppPath(): Promise<string | null> {
        return this.appDetector.detectMacOSAppPath();
    }

    async detectWindowsAppPath(): Promise<string | null> {
        return this.appDetector.detectWindowsAppPath();
    }

    // ==================== App Lifecycle ====================

    async ensureAppRunning(): Promise<boolean> {
        if (this.isConnected()) {
            return true;
        }

        logger.info("App not connected, attempting to launch...");

        // Mark app as launching
        this.appLifecycle.markAppLaunched();

        // Retrieve custom executable path from settings
        const customPath = await getCustomExecutablePath();
        if (customPath) {
            logger.info(`Using custom executable path: ${customPath}`);
        }

        const launched = await this.appLauncher.launch(customPath);
        if (!launched) {
            this.appLifecycle.resetLaunchState();
            return false;
        }

        // Try to connect after launching
        try {
            await this.connect();
            if (!this.isConnected()) {
                this.appLifecycle.resetLaunchState();
                return false;
            }

            // Wait for UI to be ready after connection
            return await this.appLifecycle.waitForUIReady(this.cdpExecutor);
        } catch (error: unknown) {
            logger.error("Failed to connect after launching", error);
            this.appLifecycle.resetLaunchState();
            return false;
        }
    }

    // ==================== Player Controls ====================

    async togglePlayback(): Promise<boolean> {
        logger.info("Connecting to Yandex Music");
        return this.playerControls.togglePlayback();
    }

    async previousTrack(): Promise<boolean> {
        return this.playerControls.previousTrack();
    }

    async nextTrack(): Promise<boolean> {
        return this.playerControls.nextTrack();
    }

    async likeTrack(): Promise<boolean> {
        return this.playerControls.likeTrack();
    }

    async dislikeTrack(): Promise<boolean> {
        return this.playerControls.dislikeTrack();
    }

    async toggleMute(): Promise<boolean> {
        return this.playerControls.toggleMute();
    }

    // ==================== Player State ====================

    async isPlaying(): Promise<boolean> {
        return this.playerState.isPlaying();
    }

    async isLiked(): Promise<boolean> {
        return this.playerState.isLiked();
    }

    async isMuted(): Promise<boolean> {
        return this.playerState.isMuted();
    }

    // ==================== Track Info ====================

    async getTrackInfo(): Promise<TrackInfo | null> {
        return this.retryUIOperation(
            () => this.trackInfo.getTrackInfo(),
            "getTrackInfo",
            RETRY_CONFIG.MAX_ATTEMPTS,
            RETRY_CONFIG.INITIAL_DELAY_MS
        );
    }

    async getTrackTime(): Promise<TrackTime | null> {
        return this.trackInfo.getTrackTime();
    }

    // ==================== Retry Logic ====================

    /**
     * Retries a UI operation with exponential backoff.
     * Useful for operations that may fail if UI is not fully loaded.
     * Increases attempts during launch grace period.
     */
    async retryUIOperation<T>(
        operation: () => Promise<T | null>,
        operationName: string,
        maxAttempts: number = RETRY_CONFIG.MAX_ATTEMPTS,
        initialDelayMs: number = RETRY_CONFIG.INITIAL_DELAY_MS
    ): Promise<T | null> {
        // Increase attempts if in any grace period
        const effectiveAttempts = this.isInAnyGracePeriod()
            ? Math.max(maxAttempts, RETRY_CONFIG.GRACE_PERIOD_MIN_ATTEMPTS)
            : maxAttempts;

        let lastError: unknown;

        for (let attempt = 1; attempt <= effectiveAttempts; attempt++) {
            try {
                const result = await operation();
                if (result !== null) {
                    return result;
                }
            } catch (error: unknown) {
                lastError = error;
            }

            if (attempt < effectiveAttempts) {
                const delayMs = initialDelayMs * Math.pow(2, attempt - 1);
                logger.info(
                    `${operationName} attempt ${attempt}/${effectiveAttempts} failed, ` +
                    `retrying in ${delayMs}ms...`
                );
                await new Promise(resolve => setTimeout(resolve, delayMs));
            }
        }

        // Only log error if not in any grace period
        if (!this.isInAnyGracePeriod()) {
            const cdpStatus = this.cdpClient.isConnected() ? 'connected' : 'disconnected';
            const connectionTime = this.cdpClient.getConnectionLifecycle().getTimeSinceConnection();
            logger.error(
                `${operationName} failed after ${effectiveAttempts} attempts. ` +
                `CDP status: ${cdpStatus} (${connectionTime}ms since connection). ` +
                `If CDP is connected but operation fails, DOM selectors may be outdated.`,
                lastError
            );
        }
        return null;
    }
}

// Export singleton instance
export const yandexMusicController = new YandexMusicController();
