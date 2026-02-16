/**
 * Global plugin settings that persist across sessions.
 * Stored in Stream Deck's global settings storage.
 */
export interface PluginGlobalSettings {
    /**
     * Unique identifier for this plugin installation.
     * Used for analytics and error reporting.
     * Generated on first launch if not present.
     */
    installation_id?: string;

    /**
     * Optional custom path to Yandex Music executable.
     * When provided, overrides automatic detection.
     * Format:
     *  - Windows: C:\Path\To\Яндекс Музыка.exe
     *  - macOS: /Applications/Яндекс Музыка.app
     */
    customExecutablePath?: string;
}

/**
 * Action-specific settings.
 * Currently unused, reserved for future action-specific configuration.
 */
export interface ActionSettings {
    // Define if needed for future action-specific settings
}
