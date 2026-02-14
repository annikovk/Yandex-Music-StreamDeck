/**
 * Centralized configuration constants for the plugin.
 */

// CDP Configuration
export const CDP_CONFIG = {
    DEFAULT_PORT: 9222,
    HOST: 'localhost',
    CONNECTION_TIMEOUT_MS: 5000,
} as const;

// Reconnection Configuration
export const RECONNECTION_CONFIG = {
    MAX_ATTEMPTS: 3,
    INITIAL_DELAY_MS: 1000,
    EXPONENTIAL_BACKOFF: true,
} as const;

// App Lifecycle Configuration
export const APP_LIFECYCLE_CONFIG = {
    LAUNCH_GRACE_PERIOD_MS: 10000,  // 10 seconds after launch
    UI_READY_TIMEOUT_MS: 2000,      // Wait up to 2 seconds for UI
    UI_READY_CHECK_INTERVAL_MS: 500,
    PORT_READY_MAX_ATTEMPTS: 15,
    PORT_READY_CHECK_INTERVAL_MS: 1000,
    KILL_PROCESS_WAIT_MS: 1000,
} as const;

// Retry Configuration
export const RETRY_CONFIG = {
    MAX_ATTEMPTS: 3,
    INITIAL_DELAY_MS: 300,
    GRACE_PERIOD_MIN_ATTEMPTS: 4,
} as const;

// Analytics Configuration
export const ANALYTICS_CONFIG = {
    HOSTNAME: 'annikov.com',
    PORT: 443,
    ERROR_REPORT_PATH: '/apps/yandex-music-controller/report-error.php',
    INSTALLATION_REPORT_PATH: '/apps/yandex-music-controller/report-installation.php',
    ACTION_TRACKING_PATH: '/apps/yandex-music-controller/count-action.php',
    TIMEOUT_MS: 5000,
} as const;

// App Paths
export const APP_PATHS = {
    MACOS: '/Applications/Яндекс Музыка.app',
    MACOS_PROCESS_NAME: 'Яндекс Музыка',
    WINDOWS_EXECUTABLE_NAMES: ['Яндекс Музыка.exe', 'YandexMusic.exe'],
} as const;

// Cover Image URLs
export const COVER_IMAGE_CONFIG = {
    SIZE_REPLACEMENTS: [
        { from: '/100x100', to: '/400x400' },
        { from: '/200x200', to: '/400x400' },
    ],
} as const;
