/**
 * Launches Yandex Music application with CDP debugging enabled.
 * Handles platform-specific launching and port availability checks.
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import CDP from 'chrome-remote-interface';
import { APP_PATHS, APP_LIFECYCLE_CONFIG } from '../constants/config';
import { logger } from '../core/logger';
import { AppDetector } from './app-detector';

const execAsync = promisify(exec);

export class AppLauncher {
    constructor(
        private appDetector: AppDetector,
        private port: number
    ) {}

    /**
     * Updates the CDP port for launching.
     */
    setPort(port: number): void {
        this.port = port;
    }

    /**
     * Launches the application for the current platform.
     * @param customPath - Optional custom executable path (supports both macOS and Windows)
     */
    async launch(customPath?: string): Promise<boolean> {
        const platform = process.platform;
        logger.info(`Launching Yandex Music on platform: ${platform}`);

        try {
            if (platform === 'darwin') {
                return await this.launchMacOS(customPath);
            } else if (platform === 'win32') {
                return await this.launchWindows(customPath);
            } else {
                logger.error(`Unsupported platform: ${platform}`);
                return false;
            }
        } catch (error: unknown) {
            logger.error(`Error launching Yandex Music on ${platform}`, error);
            return false;
        }
    }

    /**
     * Launches Yandex Music on macOS.
     * @param customPath - Optional custom executable path
     */
    private async launchMacOS(customPath?: string): Promise<boolean> {
        try {
            const appPath = await this.appDetector.detectAppPath(customPath);
            if (!appPath) {
                logger.error(
                    "Yandex Music not found. Please install from https://music.yandex.ru/download/"
                );
                return false;
            }

            // Kill existing process
            await this.killExistingProcess('macOS', `pkill -f '${APP_PATHS.MACOS_PROCESS_NAME}'`);

            // Launch with debugging port
            logger.info("Launching Yandex Music with debugging port (macOS)...");
            const command = `open -a "${appPath}" --args --remote-debugging-port=${this.port}`;
            await execAsync(command);

            logger.info("Launch command executed, waiting for app to start...");

            // Wait for CDP port to be ready
            return await this.waitForCDPPort();
        } catch (error: unknown) {
            logger.error("Error launching Yandex Music (macOS)", error);
            return false;
        }
    }

    /**
     * Launches Yandex Music on Windows.
     * @param customPath - Optional custom executable path
     */
    private async launchWindows(customPath?: string): Promise<boolean> {
        try {
            // Kill existing process
            await this.killExistingProcess(
                'Windows',
                'taskkill /F /IM "Яндекс Музыка.exe" 2>nul || taskkill /F /IM "YandexMusic.exe" 2>nul'
            );

            // Find app path (using custom path if provided)
            logger.info("Finding Yandex Music installation (Windows)...");
            const appPath = await this.appDetector.detectAppPath(customPath);

            if (!appPath) {
                logger.error(
                    "Yandex Music not found. Please install from https://music.yandex.ru/download/"
                );
                return false;
            }

            logger.info(`Found Yandex Music at: ${appPath}`);
            logger.info("Launching Yandex Music with debugging port (Windows)...");

            // Launch process in background
            const command = `start /B "" "${appPath}" --remote-debugging-port=${this.port}`;
            exec(command, (error) => {
                if (error) {
                    logger.error("Error in background process", error);
                }
            });

            logger.info("Launch command executed, waiting for app to start...");

            // Wait for CDP port to be ready
            return await this.waitForCDPPort();
        } catch (error: unknown) {
            logger.error("Error launching Yandex Music (Windows)", error);
            return false;
        }
    }

    /**
     * Kills existing Yandex Music process.
     */
    private async killExistingProcess(platform: string, command: string): Promise<void> {
        logger.info(`Killing existing Yandex Music process (${platform})...`);
        try {
            await execAsync(command);
            await new Promise(resolve =>
                setTimeout(resolve, APP_LIFECYCLE_CONFIG.KILL_PROCESS_WAIT_MS)
            );
        } catch (error: unknown) {
            logger.warn("Error killing existing app (may not be running)", error);
        }
    }

    /**
     * Waits for CDP port to become available after launching.
     */
    async waitForCDPPort(): Promise<boolean> {
        const maxAttempts = APP_LIFECYCLE_CONFIG.PORT_READY_MAX_ATTEMPTS;
        const intervalMs = APP_LIFECYCLE_CONFIG.PORT_READY_CHECK_INTERVAL_MS;

        for (let i = 0; i < maxAttempts; i++) {
            await new Promise(resolve => setTimeout(resolve, intervalMs));
            logger.info(`Waiting for CDP port... (${i + 1}/${maxAttempts})`);

            try {
                const testClient = await CDP({
                    port: this.port,
                    host: 'localhost'
                });
                await testClient.close();
                logger.info("CDP port is ready!");
                return true;
            } catch (error: unknown) {
                if (i === maxAttempts - 1) {
                    logger.error(
                        `Failed to connect to CDP port after ${maxAttempts} seconds`,
                        error
                    );
                }
            }
        }

        return false;
    }
}
