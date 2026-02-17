/**
 * Type definitions for analytics and error reporting.
 */

export type InstallationId = string;

export interface ErrorReport {
    installation_id: string;
    error_message: string;
    stack_trace?: string;
}

export interface InstallationInfo {
    // System info
    platform: string;
    osVersion: string;
    osRelease: string;
    pluginVersion: string;
    nodeVersion: string;

    // Yandex Music info
    yandexMusicConnected: boolean;
    yandexMusicPath: string | null;
    yandexMusicDetectionMethod: string | null;

    // Stream Deck application info
    streamDeckVersion: string | null;
    streamDeckLanguage: string | null;

    // Installation identification
    installation_id: string;
}

export interface StreamDeckInfo {
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
