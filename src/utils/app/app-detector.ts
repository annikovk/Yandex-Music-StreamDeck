/**
 * Detects Yandex Music application installation paths.
 * Platform-specific detection for macOS and Windows.
 */

import { promises as fs } from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { APP_PATHS } from '../constants/config';
import { logger } from '../core/logger';

const execAsync = promisify(exec);

export class AppDetector {
    /**
     * Detects Yandex Music installation path for the current platform.
     * @param customPath - Optional custom executable path (supports both macOS and Windows)
     */
    async detectAppPath(customPath?: string): Promise<string | null> {
        const platform = process.platform;

        // Priority 1: Use custom path if provided and valid
        if (customPath) {
            const isValid = await this.validateCustomPath(customPath);
            if (isValid) {
                return customPath;
            } else {
                logger.warn('Custom executable path invalid, falling back to auto-detection');
            }
        }

        // Priority 2: Fall back to automatic detection
        if (platform === 'darwin') {
            return this.detectMacOSAppPath();
        } else if (platform === 'win32') {
            return this.detectWindowsAppPath();
        }

        logger.warn(`Unsupported platform: ${platform}`);
        return null;
    }

    /**
     * Validates that a custom executable path exists and is accessible.
     */
    private async validateCustomPath(path: string): Promise<boolean> {
        try {
            await fs.access(path);
            logger.info(`Custom executable path validated: ${path}`);
            return true;
        } catch {
            logger.warn(`Custom executable path invalid: ${path}`);
            return false;
        }
    }

    /**
     * Detects Yandex Music installation on macOS.
     */
    async detectMacOSAppPath(): Promise<string | null> {
        try {
            await fs.access(APP_PATHS.MACOS);
            return APP_PATHS.MACOS;
        } catch {
            logger.error(
                `Yandex Music not found at default location: ${APP_PATHS.MACOS}. ` +
                `You can specify a custom path in plugin settings (Stream Deck → Plugin Settings).`
            );
            return null;
        }
    }

    /**
     * Detects Yandex Music installation on Windows.
     * Tries multiple detection strategies in order:
     * 1. Standard installation paths
     * 2. Windows Registry lookup
     * 3. PowerShell-based filesystem search
     */
    async detectWindowsAppPath(): Promise<string | null> {
        // Strategy 1: Check standard installation paths
        const possiblePaths = this.getWindowsPossiblePaths();

        logger.info(`Checking ${possiblePaths.length} standard installation paths...`);
        for (const appPath of possiblePaths) {
            try {
                await fs.access(appPath);
                logger.info(`Found Yandex Music at: ${appPath}`);
                return appPath;
            } catch {
                // File doesn't exist, try next path
            }
        }

        // Strategy 2: Try Windows Registry
        logger.info('Standard paths failed, checking Windows Registry...');
        const registryPath = await this.detectFromWindowsRegistry();
        if (registryPath) {
            logger.info(`Found Yandex Music via Registry at: ${registryPath}`);
            return registryPath;
        }

        // Strategy 3: PowerShell filesystem search as last resort
        logger.info('Registry lookup failed, attempting PowerShell search (may take a moment)...');
        const searchPath = await this.detectViaWindowsSearch();
        if (searchPath) {
            logger.info(`Found Yandex Music via search at: ${searchPath}`);
            return searchPath;
        }

        logger.error(
            `Yandex Music executable not found. ` +
            `You can specify a custom path in plugin settings (Stream Deck → Plugin Settings). ` +
            `Searched standard paths: ${possiblePaths.join(', ')}`
        );
        return null;
    }

    /**
     * Gets all possible Windows installation paths.
     */
    private getWindowsPossiblePaths(): string[] {
        const localAppData = process.env.LOCALAPPDATA || '';
        const programFiles = process.env.ProgramFiles || 'C:\\Program Files';
        const programFilesX86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
        const appData = process.env.APPDATA || '';

        const paths: string[] = [];

        // Generate paths for all combinations of directory names and executable names
        const dirVariants = ['YandexMusic', 'Yandex Music', 'yandex-music'];
        const basePaths = [
            path.join(localAppData, 'Programs'),
            programFiles,
            programFilesX86,
            path.join(appData, 'Local', 'Programs'),
        ];

        for (const basePath of basePaths) {
            for (const dirVariant of dirVariants) {
                for (const exeName of APP_PATHS.WINDOWS_EXECUTABLE_NAMES) {
                    paths.push(path.join(basePath, dirVariant, exeName));
                }
            }
        }

        return paths;
    }

    /**
     * Attempts to find Yandex Music installation via Windows Registry.
     * Checks both HKEY_CURRENT_USER and HKEY_LOCAL_MACHINE.
     */
    private async detectFromWindowsRegistry(): Promise<string | null> {
        // Registry keys to check (common installation locations)
        const registryKeys = [
            'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\YandexMusic',
            'HKLM\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\YandexMusic',
            'HKLM\\Software\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\YandexMusic',
        ];

        for (const key of registryKeys) {
            try {
                const { stdout } = await execAsync(
                    `reg query "${key}" /v InstallLocation 2>nul`,
                    { encoding: 'utf8', windowsHide: true }
                );

                // Parse registry output to extract InstallLocation value
                const match = stdout.match(/InstallLocation\s+REG_SZ\s+(.+)/);
                if (match && match[1]) {
                    const installDir = match[1].trim();

                    // Try both executable names
                    for (const exeName of APP_PATHS.WINDOWS_EXECUTABLE_NAMES) {
                        const exePath = path.join(installDir, exeName);
                        try {
                            await fs.access(exePath);
                            return exePath;
                        } catch {
                            // Try next executable name
                        }
                    }
                }
            } catch {
                // Registry key doesn't exist or query failed, try next key
            }
        }

        return null;
    }

    /**
     * Uses PowerShell to search for Yandex Music executable in common locations.
     * This is a slower fallback method but can find non-standard installations.
     */
    private async detectViaWindowsSearch(): Promise<string | null> {
        try {
            // Search in LOCALAPPDATA and Program Files with a timeout
            const searchPaths = [
                process.env.LOCALAPPDATA || '',
                process.env.ProgramFiles || 'C:\\Program Files',
                process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)',
            ].filter(p => p);

            for (const searchPath of searchPaths) {
                for (const exeName of APP_PATHS.WINDOWS_EXECUTABLE_NAMES) {
                    try {
                        // Use single quotes in PowerShell to avoid escaping issues with double quotes
                        // Single quotes are not valid in Windows filenames, so no escaping needed
                        const psCommand = `Get-ChildItem -Path '${searchPath}' -Filter '${exeName}' -Recurse -ErrorAction SilentlyContinue -Depth 3 | Select-Object -First 1 -ExpandProperty FullName`;
                        const { stdout } = await execAsync(
                            `powershell.exe -NoProfile -Command "${psCommand}"`,
                            {
                                encoding: 'utf8',
                                windowsHide: true,
                                timeout: 10000 // 10 second timeout per search
                            }
                        );

                        const foundPath = stdout.trim();
                        if (foundPath) {
                            // Verify the file actually exists
                            try {
                                await fs.access(foundPath);
                                return foundPath;
                            } catch {
                                // Path doesn't exist, continue searching
                            }
                        }
                    } catch (err) {
                        // Timeout or search failed, try next
                        logger.info(`PowerShell search failed for ${exeName} in ${searchPath}: ${err}`);
                    }
                }
            }
        } catch (err) {
            logger.error(`PowerShell search encountered error: ${err}`);
        }

        return null;
    }
}
