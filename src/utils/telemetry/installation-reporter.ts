/**
 * Installation reporting module.
 * Reports plugin installation information to analytics endpoint.
 */

import https from 'https';
import os from 'os';
import { ANALYTICS_CONFIG } from '../constants/config';
import { logger } from '../core/logger';
import { getInstallationId } from '../core/installation-id';
import { appDetector } from '../app/app-detector';
import type { InstallationInfo, StreamDeckInfo } from '../types/analytics.types';

export class InstallationReporter {
    /**
     * Reports plugin installation information to analytics endpoint.
     * This is called once when the plugin starts to collect telemetry.
     */
    async report(
        streamDeckInfo: StreamDeckInfo | undefined,
        isConnected: () => boolean
    ): Promise<void> {
        try {
            // Detect Yandex Music installation
            const detectionResult = await appDetector.detectAppPath();

            // Check if app is connected
            const yandexMusicConnected = isConnected();

            // Collect installation information
            const installationInfo: InstallationInfo = {
                platform: process.platform,
                osVersion: os.version(),
                osRelease: os.release(),
                pluginVersion: streamDeckInfo?.plugin?.version || 'unknown',
                nodeVersion: process.version,
                yandexMusicConnected: yandexMusicConnected,
                yandexMusicPath: detectionResult.path,
                yandexMusicDetectionMethod: detectionResult.detectionMethod || null,
                streamDeckVersion: streamDeckInfo?.application?.version || null,
                streamDeckLanguage: streamDeckInfo?.application?.language || null,
                installation_id: getInstallationId(),
            };

            // Send POST request to analytics endpoint
            const postData = JSON.stringify(installationInfo);

            const options = {
                hostname: ANALYTICS_CONFIG.HOSTNAME,
                port: ANALYTICS_CONFIG.PORT,
                path: ANALYTICS_CONFIG.INSTALLATION_REPORT_PATH,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(postData),
                },
            };

            logger.info("Sending installation report:", postData);

            const req = https.request(options, (response) => {
                // Consume response data to free up memory
                response.on('data', () => {});
            });

            req.on('error', () => {
                // Silently ignore analytics errors
            });

            req.write(postData);
            req.end();
        } catch (err: unknown) {
            // Silently ignore any errors in analytics
        }
    }
}

// Export singleton instance
export const installationReporter = new InstallationReporter();
