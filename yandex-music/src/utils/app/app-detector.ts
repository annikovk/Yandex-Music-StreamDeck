/**
 * Detects Yandex Music application installation paths.
 * Platform-specific detection for macOS and Windows.
 */

import { promises as fs } from 'fs';
import path from 'path';
import { APP_PATHS } from '../constants/config';
import { logger } from '../core/logger';

export class AppDetector {
    /**
     * Detects Yandex Music installation path for the current platform.
     */
    async detectAppPath(): Promise<string | null> {
        const platform = process.platform;

        if (platform === 'darwin') {
            return this.detectMacOSAppPath();
        } else if (platform === 'win32') {
            return this.detectWindowsAppPath();
        }

        logger.warn(`Unsupported platform: ${platform}`);
        return null;
    }

    /**
     * Detects Yandex Music installation on macOS.
     */
    async detectMacOSAppPath(): Promise<string | null> {
        try {
            await fs.access(APP_PATHS.MACOS);
            return APP_PATHS.MACOS;
        } catch {
            return null;
        }
    }

    /**
     * Detects Yandex Music installation on Windows.
     * Checks multiple possible installation locations.
     */
    async detectWindowsAppPath(): Promise<string | null> {
        const possiblePaths = this.getWindowsPossiblePaths();

        for (const appPath of possiblePaths) {
            try {
                await fs.access(appPath);
                logger.info(`Found Yandex Music at: ${appPath}`);
                return appPath;
            } catch {
                // File doesn't exist, try next path
            }
        }

        logger.error(
            `Yandex Music executable not found in any expected location. ` +
            `Searched paths: ${possiblePaths.join(', ')}`
        );
        return null;
    }

    /**
     * Gets all possible Windows installation paths.
     */
    private getWindowsPossiblePaths(): string[] {
        return [
            // LOCALAPPDATA paths (most common for user-installed apps)
            path.join(
                process.env.LOCALAPPDATA || '',
                'Programs',
                'YandexMusic',
                APP_PATHS.WINDOWS_EXECUTABLE_NAMES[0]
            ),
            path.join(
                process.env.LOCALAPPDATA || '',
                'Programs',
                'YandexMusic',
                APP_PATHS.WINDOWS_EXECUTABLE_NAMES[1]
            ),

            // Program Files paths (system-wide installations)
            path.join(
                process.env.ProgramFiles || 'C:\\Program Files',
                'YandexMusic',
                APP_PATHS.WINDOWS_EXECUTABLE_NAMES[0]
            ),
            path.join(
                process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)',
                'YandexMusic',
                APP_PATHS.WINDOWS_EXECUTABLE_NAMES[1]
            ),

            // Alternative installation paths with space in directory name
            path.join(
                process.env.LOCALAPPDATA || '',
                'Programs',
                'Yandex Music',
                APP_PATHS.WINDOWS_EXECUTABLE_NAMES[0]
            ),
            path.join(
                process.env.LOCALAPPDATA || '',
                'Programs',
                'Yandex Music',
                APP_PATHS.WINDOWS_EXECUTABLE_NAMES[1]
            ),
        ];
    }
}
