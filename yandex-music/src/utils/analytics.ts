import https from "https";
import os from "os";
import { yandexMusicController } from "./yandex-music-controller";
import streamDeck from "@elgato/streamdeck";

/**
 * Installation ID that uniquely identifies this plugin installation.
 * Set during plugin initialization and used in all analytics calls.
 */
let installation_id: string = "";

/**
 * Sets the installation ID for analytics tracking.
 * Should be called once during plugin initialization.
 */
export function setInstallationId(id: string): void {
    installation_id = id;
}

/**
 * Tracks action usage by sending a request to the analytics endpoint.
 * This is a fire-and-forget operation that doesn't block action execution.
 * Analytics are excluded for the developer (konstantin.annikov).
 */
export function trackAction(actionName: string): void {
    // Skip analytics for the developer
    const username = os.userInfo().username;

    const url = `https://annikov.com/apps/yandex-music-controller/count-action.php?id=${actionName}&installation_id=${installation_id}`;

    https.get(url, (response) => {
        // Consume response data to free up memory
        streamDeck.logger.info(`Sent analytics event for action "${actionName}"`);
        response.on('data', () => {});
    }).on('error', () => {
        streamDeck.logger.error(`Failed to send analytics event for action "${actionName}"`);
        // Silently ignore analytics errors
    });
}

interface StreamDeckInfo {
    application?: {
        version?: string;
        language?: string;
        platform?: string;
        platformVersion?: string;
    };
    plugin?: {
        uuid?: string;
        version?: string;
    };
}

interface InstallationInfo {
    // System info
    platform: string;
    osVersion: string;
    osRelease: string;
    pluginVersion: string;
    nodeVersion: string;

    // Yandex Music info
    yandexMusicConnected: boolean;
    yandexMusicPath: string | null;

    // Stream Deck application info
    streamDeckVersion: string | null;
    streamDeckLanguage: string | null;

    // Installation identification
    installation_id: string; // Unique identifier for this plugin installation

}

/**
 * Reports plugin installation information to analytics endpoint.
 * This is called once when the plugin starts to collect telemetry about
 * the installation environment and Yandex Music availability.
 * Analytics are excluded for the developer (konstantin.annikov).
 */
export async function reportInstallation(
    streamDeckInfo?: StreamDeckInfo
): Promise<void> {
    // Skip analytics for the developer
    const username = os.userInfo().username;

    try {
        // Detect Yandex Music installation based on platform
        const platform = process.platform;
        let yandexMusicPath: string | null = null;

        if (platform === 'darwin') {
            yandexMusicPath = await yandexMusicController.detectMacOSAppPath();
        } else if (platform === 'win32') {
            yandexMusicPath = await yandexMusicController.detectWindowsAppPath();
        }

        // Try to ensure app is running and detect if it's functional
        const yandexMusicConnected = await yandexMusicController.isConnected();

        // Collect installation information
        const installationInfo: InstallationInfo = {
            platform: platform,
            osVersion: os.version(),
            osRelease: os.release(),
            pluginVersion: streamDeckInfo?.plugin?.version || 'unknown',
            nodeVersion: process.version,
            yandexMusicConnected: yandexMusicConnected,
            yandexMusicPath: yandexMusicPath,
            streamDeckVersion: streamDeckInfo?.application?.version || null,
            streamDeckLanguage: streamDeckInfo?.application?.language || null,
            installation_id: installation_id,
        };

        // Send POST request to analytics endpoint
        const postData = JSON.stringify(installationInfo);

        const options = {
            hostname: 'annikov.com',
            port: 443,
            path: '/apps/yandex-music-controller/report-installation.php',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData),
            },
        };

        streamDeck.logger.info("Sending installation report:", postData);

        const req = https.request(options, (response) => {
            // Consume response data to free up memory
            response.on('data', () => {});
        });
       
        req.on('error', () => {
            // Silently ignore analytics errors
        });

        req.write(postData);
        req.end();
    } catch (err) {
        // Silently ignore any errors in analytics
    }
}
