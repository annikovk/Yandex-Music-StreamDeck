/**
 * Settings utilities for accessing Stream Deck global settings.
 */

import streamDeck from "@elgato/streamdeck";
import type { PluginGlobalSettings } from "../../types/settings";

/**
 * Retrieves the custom executable path from global settings.
 * Returns undefined if no custom path is configured.
 */
export async function getCustomExecutablePath(): Promise<string | undefined> {
    const settings = await streamDeck.settings.getGlobalSettings() as PluginGlobalSettings;
    return settings.customExecutablePath;
}

/**
 * Sets the auto-detection status flags in global settings.
 * This informs the Property Inspector about detection success/failure.
 */
export async function setAutoDetectionFailed(failed: boolean): Promise<void> {
    const settings = await streamDeck.settings.getGlobalSettings() as PluginGlobalSettings;

    if (failed) {
        settings.autoDetectionFailed = true;
        delete settings.autoDetectionSucceeded;
    } else {
        delete settings.autoDetectionFailed;
    }

    await streamDeck.settings.setGlobalSettings(settings as any);
}

/**
 * Sets the auto-detection success flag in global settings.
 * Called when the plugin successfully finds and launches the app.
 */
export async function setAutoDetectionSucceeded(succeeded: boolean): Promise<void> {
    const settings = await streamDeck.settings.getGlobalSettings() as PluginGlobalSettings;

    if (succeeded) {
        settings.autoDetectionSucceeded = true;
        delete settings.autoDetectionFailed;
    } else {
        delete settings.autoDetectionSucceeded;
    }

    await streamDeck.settings.setGlobalSettings(settings as any);
}
