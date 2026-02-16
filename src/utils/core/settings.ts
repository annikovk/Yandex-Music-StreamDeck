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
