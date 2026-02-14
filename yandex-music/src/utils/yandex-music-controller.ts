import CDP from "chrome-remote-interface";
import streamDeck from "@elgato/streamdeck";
import { exec } from "child_process";
import { promisify } from "util";
import os from "os";
import { promises as fs } from "fs";
import path from "path";
import { logAndReportError } from "./error-reporting";

const execAsync = promisify(exec);

export interface TrackInfo {
    coverUrl: string;
    originalCoverUrl: string;
    title: string;
    artist: string;
}

export interface TrackTime {
    currentTime: string;
    totalTime: string;
    progressValue: number;
    progressMax: number;
    progressPercent: number;
}

class YandexMusicController {
    private port = 9222;
    private connected = false;
    private client: any = null;
    private connectionPromise: Promise<any> | null = null;
    private reconnectAttempts = 0;
    private maxReconnectAttempts = 3;
    private reconnectDelay = 1000;

    async setPort(newPort: number): Promise<boolean> {
        if (newPort === this.port) {
            streamDeck.logger.info(`Port unchanged (${newPort})`);
            return false;
        }

        streamDeck.logger.info(`Changing port from ${this.port} to ${newPort}`);

        await this.disconnect();

        this.port = newPort;
        this.connected = false;
        this.connectionPromise = null;
        this.reconnectAttempts = 0;

        try {
            await this.connect();
            streamDeck.logger.info(`Successfully connected to new port ${newPort}`);
            return true;
        } catch (err) {
            logAndReportError(`Error connecting to new port ${newPort}`, err);
            return false;
        }
    }

    /**
     * Detects Yandex Music installation on macOS.
     * Returns the application path if found, null otherwise.
     */
    async detectMacOSAppPath(): Promise<string | null> {
        const appPath = "/Applications/Яндекс Музыка.app";
        try {
            await fs.access(appPath);
            return appPath;
        } catch {
            return null;
        }
    }

    private async launchApp(): Promise<boolean> {
        const platform = process.platform;
        streamDeck.logger.info(`Launching Yandex Music on platform: ${platform}`);

        try {
            if (platform === 'darwin') {
                return await this.launchAppMacOS();
            } else if (platform === 'win32') {
                return await this.launchAppWindows();
            } else {
                logAndReportError(`Unsupported platform: ${platform}`, undefined);
                return false;
            }
        } catch (err) {
            logAndReportError(`Error launching Yandex Music on ${platform}`, err);
            return false;
        }
    }

    private async launchAppMacOS(): Promise<boolean> {
        try {
            const appPath = await this.detectMacOSAppPath();
            if (!appPath) {
                logAndReportError("Yandex Music not found. Please install from https://music.yandex.ru/download/", undefined);
                return false;
            }

            if (!this.isConnected()) {
                streamDeck.logger.info("Killing existing Yandex Music process (macOS)...");
                try {
                    await execAsync("pkill -f 'Яндекс Музыка'");
                    await new Promise(resolve => setTimeout(resolve, 1000));
                } catch (err) {
                    streamDeck.logger.warn("Error killing existing app (may not be running):", err);
                }
            }

            streamDeck.logger.info("Launching Yandex Music with debugging port (macOS)...");
            const command = `open -a "${appPath}" --args --remote-debugging-port=${this.port}`;
            await execAsync(command);

            streamDeck.logger.info("Launch command executed, waiting for app to start...");
            await new Promise(resolve => setTimeout(resolve, 3000));

            return true;
        } catch (err) {
            logAndReportError("Error launching Yandex Music (macOS)", err);
            return false;
        }
    }

    private async launchAppWindows(): Promise<boolean> {
        try {
            if (!this.isConnected()) {
                streamDeck.logger.info("Killing existing Yandex Music process (Windows)...");
                try {
                    // Try both possible executable names
                    await execAsync('taskkill /F /IM "Яндекс Музыка.exe" 2>nul || taskkill /F /IM "YandexMusic.exe" 2>nul');
                    await new Promise(resolve => setTimeout(resolve, 1000));
                } catch (err) {
                    streamDeck.logger.warn("Error killing existing app (may not be running):", err);
                }
            }

            streamDeck.logger.info("Finding Yandex Music installation (Windows)...");
            const appPath = await this.detectWindowsAppPath();

            if (!appPath) {
                logAndReportError("Yandex Music not found. Please install from https://music.yandex.ru/download/", undefined);
                return false;
            }

            streamDeck.logger.info(`Found Yandex Music at: ${appPath}`);
            streamDeck.logger.info("Launching Yandex Music with debugging port (Windows)...");

            // Launch process in background using start command
            // Use /B flag to prevent opening a new window
            const command = `start /B "" "${appPath}" --remote-debugging-port=${this.port}`;

            exec(command, (error) => {
                if (error) {
                    logAndReportError("Error in background process", error);
                }
            });

            streamDeck.logger.info("Launch command executed, waiting for app to start...");

            // Wait longer and check for port availability
            for (let i = 0; i < 15; i++) {
                await new Promise(resolve => setTimeout(resolve, 1000));
                streamDeck.logger.info(`Waiting for CDP port... (${i + 1}/15)`);

                try {
                    // Try to check if port is available
                    const testClient = await CDP({ port: this.port, host: 'localhost' });
                    await testClient.close();
                    streamDeck.logger.info("CDP port is ready!");
                    return true;
                } catch (err: any) {
                    // Port not ready yet, continue waiting
                    if (i === 14) {
                        logAndReportError("Failed to connect to CDP port after 15 seconds", err);
                    }
                }
            }

            logAndReportError("Timeout waiting for CDP port", undefined);
            return false;
        } catch (err) {
            logAndReportError("Error launching Yandex Music (Windows)", err);
            return false;
        }
    }

    /**
     * Detects Yandex Music installation on Windows.
     * Returns the application path if found, null otherwise.
     */
    async detectWindowsAppPath(): Promise<string | null> {
        const possiblePaths = [
            // LOCALAPPDATA paths (most common for user-installed apps)
            path.join(process.env.LOCALAPPDATA || '', 'Programs', 'YandexMusic', 'Яндекс Музыка.exe'),
            path.join(process.env.LOCALAPPDATA || '', 'Programs', 'YandexMusic', 'YandexMusic.exe'),

            // Program Files paths (system-wide installations)
            path.join(process.env.ProgramFiles || 'C:\\Program Files', 'YandexMusic', 'Яндекс Музыка.exe'),
            path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'YandexMusic', 'YandexMusic.exe'),

            // Alternative installation paths with space in directory name
            path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Yandex Music', 'Яндекс Музыка.exe'),
            path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Yandex Music', 'YandexMusic.exe'),
        ];

        for (const appPath of possiblePaths) {
            try {
                await fs.access(appPath);
                streamDeck.logger.info(`Found Yandex Music at: ${appPath}`);
                return appPath;
            } catch {
                // File doesn't exist, try next path
            }
        }

        logAndReportError(`Yandex Music executable not found in any expected location. Searched paths: ${possiblePaths.join(', ')}`, undefined);
        return null;
    }

    async connect(): Promise<any> {
        if (this.connectionPromise) {
            return this.connectionPromise;
        }

        this.connectionPromise = new Promise(async (resolve, reject) => {
            try {
                if (this.client) {
                    streamDeck.logger.info("Using existing CDP connection");
                    this.connected = true;
                    resolve(this.client);
                    return;
                }

                streamDeck.logger.info("Creating new CDP connection on port", this.port);
                this.client = await CDP({ port: this.port, host: 'localhost' });

                await Promise.all([this.client.Page.enable(), this.client.Runtime.enable()]);

                this.connected = true;
                this.reconnectAttempts = 0;

                this.client.on("disconnect", () => {
                    logAndReportError("CDP connection lost, attempting reconnection", undefined);
                    this.connected = false;
                    this.client = null;
                    this.connectionPromise = null;
                    this.reconnect();
                });

                streamDeck.logger.info("CDP connection established successfully");
                resolve(this.client);
            } catch (err: any) {
                this.connected = false;
                this.client = null;
                this.connectionPromise = null;

                if (err.message?.includes("connect ECONNREFUSED")) {
                    logAndReportError(`Failed to connect to Yandex Music on port ${this.port}. Ensure the app is running with --remote-debugging-port=${this.port}`, err);
                } else {
                    logAndReportError("Error creating CDP client", err);
                }

                reject(err);
            }
        });

        return this.connectionPromise;
    }

    private async reconnect(): Promise<void> {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            logAndReportError(`Max reconnection attempts reached (${this.maxReconnectAttempts})`, undefined);
            return;
        }

        this.reconnectAttempts++;
        streamDeck.logger.info(`Reconnection attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}...`);

        setTimeout(async () => {
            try {
                await this.connect();
                streamDeck.logger.info("Reconnection successful");
            } catch (err) {
                logAndReportError("Reconnection error", err);
                this.reconnect();
            }
        }, this.reconnectDelay * this.reconnectAttempts);
    }

    async getClient(): Promise<any> {
        try {
            return await this.connect();
        } catch (err) {
            logAndReportError("Failed to get CDP client", err);
            return null;
        }
    }

    async checkConnection(): Promise<boolean> {
        try {
            const client = await this.getClient();
            return !!client;
        } catch (err) {
            logAndReportError("Error checking Yandex Music connection", err);
            return false;
        }
    }

    isConnected(): boolean {
        return this.connected;
    }

    async ensureAppRunning(): Promise<boolean> {
        if (this.connected) {
            return true;
        }

        streamDeck.logger.info("App not connected, attempting to launch...");
        const launched = await this.launchApp();
        if (!launched) {
            return false;
        }

        // Try to connect after launching
        try {
            await this.connect();
            return this.connected;
        } catch (err) {
            logAndReportError("Failed to connect after launching", err);
            return false;
        }
    }

    async previousTrack(): Promise<boolean> {
        return await this.executeAction("PREVIOUS_TRACK_BUTTON", "Previous track");
    }

    async nextTrack(): Promise<boolean> {
        return await this.executeAction("NEXT_TRACK_BUTTON", "Next track");
    }

    async likeTrack(): Promise<boolean> {
        return await this.executeAction("LIKE_BUTTON", "Like track");
    }

    async dislikeTrack(): Promise<boolean> {
        return await this.executeAction("DISLIKE_BUTTON", "Dislike track");
    }

    async togglePlayback(): Promise<boolean> {
        try {
            streamDeck.logger.info("Connecting to Yandex Music");

            const client = await this.getClient();
            if (!client) {
                logAndReportError("Failed to get CDP client", undefined);
                return false;
            }

            const { Runtime } = client;

            streamDeck.logger.info("Checking playback state...");

            const result = await Runtime.evaluate({
                expression: `
          (function() {
            try {
              let pauseButton = document.querySelector("button.BaseSonataControlsDesktop_sonataButton__GbwFt[data-test-id='PAUSE_BUTTON']");
              if (pauseButton) {
                console.log("Found pause button - track is playing");
                pauseButton.click();
                return { success: true, message: 'Track paused', wasPlaying: true };
              }

              let playButton = document.querySelector("button.BaseSonataControlsDesktop_sonataButton__GbwFt[data-test-id='PLAY_BUTTON']");
              if (playButton) {
                if (!playButton.classList.contains("PlayButtonWithCover_playButton__rV9pQ")) {
                  console.log("Found play button - track is paused");
                  playButton.click();
                  return { success: true, message: 'Track playing', wasPlaying: false };
                }
              }

              const pauseSvgL = document.querySelector("svg.BaseSonataControlsDesktop_playButtonIcon__TlFqv use[xlink:href='/icons/sprite.svg#pause_filled_l']");
              if (pauseSvgL) {
                const pauseButton = pauseSvgL.closest('button');
                if (pauseButton) {
                  console.log("Found pause button by SVG icon");
                  pauseButton.click();
                  return { success: true, message: 'Track paused', wasPlaying: true };
                }
              }

              const playSvgL = document.querySelector("svg.BaseSonataControlsDesktop_playButtonIcon__TlFqv use[xlink:href='/icons/sprite.svg#play_filled_l']");
              if (playSvgL) {
                const playButton = playSvgL.closest('button');
                if (playButton) {
                  console.log("Found play button by SVG icon");
                  playButton.click();
                  return { success: true, message: 'Track playing', wasPlaying: false };
                }
              }

              const sonataButtons = document.querySelectorAll(".BaseSonataControlsDesktop_sonataButtons__7vLtw button");
              if (sonataButtons.length >= 3) {
                const middleButton = sonataButtons[1];
                console.log("Using middle button");
                middleButton.click();
                return { success: true, message: 'Track toggled', wasPlaying: null };
              }

              return { success: false, message: 'Play/pause button not found' };
            } catch (err) {
              return { success: false, message: 'Error: ' + err.message, error: err.toString() };
            }
          })()
        `,
                awaitPromise: true,
                returnByValue: true,
            });

            if (result.result?.value) {
                const value = result.result.value;

                if (value.success) {
                    streamDeck.logger.info(value.message);
                    return true;
                } else {
                    logAndReportError(`Failed to toggle playback: ${value.message}`, undefined);
                    return false;
                }
            } else {
                logAndReportError("Failed to execute script", undefined);
                return false;
            }
        } catch (err) {
            logAndReportError("Script execution error", err);
            return false;
        }
    }

    async isPlaying(): Promise<boolean> {
        try {
            const client = await this.getClient();
            if (!client) return false;

            const { Runtime } = client;

            const result = await Runtime.evaluate({
                expression: `
          (function() {
            let pauseButton = document.querySelector("button.BaseSonataControlsDesktop_sonataButton__GbwFt[data-test-id='PAUSE_BUTTON']");
            if (pauseButton) return { isPlaying: true };

            let playButton = document.querySelector("button.BaseSonataControlsDesktop_sonataButton__GbwFt[data-test-id='PLAY_BUTTON']");
            if (playButton) return { isPlaying: false };

            const pauseSvg = document.querySelector("svg.BaseSonataControlsDesktop_playButtonIcon__TlFqv use[xlink:href='/icons/sprite.svg#pause_filled_l']");
            if (pauseSvg) return { isPlaying: true };

            const playSvg = document.querySelector("svg.BaseSonataControlsDesktop_playButtonIcon__TlFqv use[xlink:href='/icons/sprite.svg#play_filled_l']");
            if (playSvg) return { isPlaying: false };

            return { isPlaying: false };
          })()
        `,
                returnByValue: true,
            });

            return result.result?.value?.isPlaying ?? false;
        } catch (err) {
            logAndReportError("Error checking playback state", err);
            return false;
        }
    }

    async isLiked(): Promise<boolean> {
        try {
            const client = await this.getClient();
            if (!client) return false;

            const { Runtime } = client;

            const result = await Runtime.evaluate({
                expression: `
          (function() {
            try {
              let playerBar = document.querySelector('.PlayerBarDesktopWithBackgroundProgressBar_root__bpmwN');
              if (!playerBar) {
                playerBar = document.querySelector('[data-test-id="PLAYERBAR_DESKTOP"]');
                if (!playerBar) return { isLiked: false };
              }

              let likeButton = playerBar.querySelector("[data-test-id='LIKE_BUTTON']");
              if (likeButton) {
                const isLiked = likeButton.getAttribute('aria-pressed') === 'true';
                const likeIconHref = likeButton.querySelector('svg use')?.getAttribute('xlink:href');
                const isLikedBySvg = likeIconHref && likeIconHref.includes('liked_xs');
                return { isLiked: isLiked || isLikedBySvg };
              }

              const sonataSection = playerBar.querySelector('.PlayerBarDesktopWithBackgroundProgressBar_sonata__mGFb_');
              if (sonataSection) {
                const likeButton = sonataSection.querySelector('button:last-of-type');
                if (likeButton) {
                  const isLiked = likeButton.getAttribute('aria-pressed') === 'true';
                  const likeIconHref = likeButton.querySelector('svg use')?.getAttribute('xlink:href');
                  const isLikedBySvg = likeIconHref && likeIconHref.includes('liked_xs');
                  return { isLiked: isLiked || isLikedBySvg };
                }
              }

              return { isLiked: false };
            } catch (err) {
              return { isLiked: false };
            }
          })()
        `,
                returnByValue: true,
            });

            return result.result?.value?.isLiked ?? false;
        } catch (err) {
            logAndReportError("Error checking like state", err);
            return false;
        }
    }

    async isMuted(): Promise<boolean> {
        try {
            const client = await this.getClient();
            if (!client) return false;

            const { Runtime } = client;

            const result = await Runtime.evaluate({
                expression: `
          (function() {
            let muteButton = document.querySelector("button.ChangeVolume_button__4HLEr[data-test-id='CHANGE_VOLUME_BUTTON']");
            if (muteButton) {
              const ariaLabel = muteButton.getAttribute('aria-label');
              const isMuted = ariaLabel === 'Включить звук';
              return { isMuted };
            }

            const volumeOffSvg = document.querySelector("svg.ChangeVolume_icon__5Zv2a use[xlink:href='/icons/sprite.svg#volumeOff_xs']");
            if (volumeOffSvg) return { isMuted: true };

            return { isMuted: false };
          })()
        `,
                returnByValue: true,
            });

            return result.result?.value?.isMuted ?? false;
        } catch (err) {
            logAndReportError("Error checking mute state", err);
            return false;
        }
    }

    private async executeAction(buttonId: string, actionDescription: string): Promise<boolean> {
        try {
            streamDeck.logger.info("Connecting to Yandex Music");

            const client = await this.getClient();
            if (!client) {
                logAndReportError("Failed to get CDP client", undefined);
                return false;
            }

            const { Runtime } = client;

            streamDeck.logger.info(`Executing action: ${actionDescription}...`);

            const result = await Runtime.evaluate({
                expression: `
          (function() {
            try {
              let playerBar = document.querySelector('.PlayerBarDesktopWithBackgroundProgressBar_root__bpmwN');
              if (!playerBar) {
                playerBar = document.querySelector('[data-test-id="PLAYERBAR_DESKTOP"]');
                if (!playerBar) {
                  console.log("Player bar not found");
                  return { success: false, message: 'Player bar not found' };
                }
              }

              let button = playerBar.querySelector("[data-test-id='${buttonId}']");

              if (button) {
                console.log("Button found:", "${buttonId}");
                button.click();
                return { success: true, message: 'Button clicked' };
              } else {
                console.log("Button not found:", "${buttonId}");

                if ('${buttonId}' === 'LIKE_BUTTON' || '${buttonId}' === 'DISLIKE_BUTTON') {
                  const sonataSection = playerBar.querySelector('.PlayerBarDesktopWithBackgroundProgressBar_sonata__mGFb_');
                  if (sonataSection) {
                    if ('${buttonId}' === 'LIKE_BUTTON') {
                      const likeButton = sonataSection.querySelector('button:last-of-type');
                      if (likeButton) {
                        console.log("Like button found by position");
                        likeButton.click();
                        return { success: true, message: 'Like button clicked' };
                      }
                    }
                    else if ('${buttonId}' === 'DISLIKE_BUTTON') {
                      const dislikeButton = sonataSection.querySelector('button:first-of-type');
                      if (dislikeButton) {
                        console.log("Dislike button found by position");
                        dislikeButton.click();
                        return { success: true, message: 'Dislike button clicked' };
                      }
                    }
                  }
                }

                return { success: false, message: 'Button not found' };
              }
            } catch (err) {
              return { success: false, message: 'Error: ' + err.message, error: err.toString() };
            }
          })()
        `,
                awaitPromise: true,
                returnByValue: true,
            });

            if (result.result?.value) {
                const value = result.result.value;

                if (value.success) {
                    streamDeck.logger.info(`${actionDescription} successful`);
                    return true;
                } else {
                    logAndReportError(`Failed to execute: ${actionDescription}: ${value.message}`, undefined);
                    return false;
                }
            } else {
                logAndReportError("Failed to execute script", undefined);
                return false;
            }
        } catch (err) {
            logAndReportError("Script execution error", err);
            return false;
        }
    }

    async getTrackInfo(): Promise<TrackInfo | null> {
        try {
            streamDeck.logger.info("Connecting to Yandex Music");

            const client = await this.getClient();
            if (!client) {
                logAndReportError("Failed to get CDP client", undefined);
                return null;
            }

            const { Runtime } = client;

            streamDeck.logger.info("Getting track info...");

            const result = await Runtime.evaluate({
                expression: `
          (function() {
            try {
              let playerBar = document.querySelector('.PlayerBarDesktopWithBackgroundProgressBar_root__bpmwN');
              if (!playerBar) {
                playerBar = document.querySelector('[data-test-id="PLAYERBAR_DESKTOP"]');
                if (!playerBar) {
                  console.log("Player bar not found");
                  return { success: false, message: 'Player bar not found' };
                }
              }

              const coverImg = playerBar.querySelector('img.PlayerBarDesktopWithBackgroundProgressBar_cover__MKmEt');
              const titleElement = playerBar.querySelector('[data-test-id="TRACK_TITLE"] .Meta_title__GGBnH');
              const artistElement = playerBar.querySelector('[data-test-id="SEPARATED_ARTIST_TITLE"] .Meta_artistCaption__JESZi');

              if (coverImg && titleElement && artistElement) {
                const originalCoverUrl = coverImg.src;
                const title = titleElement.textContent;
                const artist = artistElement.textContent;

                let coverUrl = originalCoverUrl;
                if (originalCoverUrl.includes('/100x100')) {
                  coverUrl = originalCoverUrl.replace('/100x100', '/400x400');
                } else if (originalCoverUrl.includes('/200x200')) {
                  coverUrl = originalCoverUrl.replace('/200x200', '/400x400');
                }

                console.log("Track info found:", { title, artist, originalCoverUrl, coverUrl });

                return {
                  success: true,
                  coverUrl: coverUrl,
                  originalCoverUrl: originalCoverUrl,
                  title: title,
                  artist: artist
                };
              } else {
                console.log("Track info not found");
                return { success: false, message: 'Track info not found' };
              }
            } catch (err) {
              return { success: false, message: 'Error: ' + err.message, error: err.toString() };
            }
          })()
        `,
                awaitPromise: true,
                returnByValue: true,
            });

            if (result.result?.value) {
                const value = result.result.value;

                if (value.success) {
                    streamDeck.logger.info("Track info retrieved:", value.title, "by", value.artist);
                    return {
                        coverUrl: value.coverUrl,
                        originalCoverUrl: value.originalCoverUrl,
                        title: value.title,
                        artist: value.artist,
                    };
                } else {
                    logAndReportError(`Failed to get track info: ${value.message}`, undefined);
                    return null;
                }
            } else {
                logAndReportError("Failed to execute script", undefined);
                return null;
            }
        } catch (err) {
            logAndReportError("Script execution error", err);
            return null;
        }
    }

    async getTrackTime(): Promise<TrackTime | null> {
        try {
            const client = await this.getClient();
            if (!client) {
                logAndReportError("Failed to get CDP client", undefined);
                return null;
            }

            const { Runtime } = client;

            const result = await Runtime.evaluate({
                expression: `
          (function() {
            try {
              let playerBar = document.querySelector('.PlayerBarDesktopWithBackgroundProgressBar_root__bpmwN');
              if (!playerBar) {
                playerBar = document.querySelector('[data-test-id="PLAYERBAR_DESKTOP"]');
                if (!playerBar) return { success: false, message: 'Player bar not found' };
              }

              const currentTimeElement = playerBar.querySelector('[data-test-id="TIMECODE_TIME_START"]');
              const totalTimeElement = playerBar.querySelector('[data-test-id="TIMECODE_TIME_END"]');
              const progressSlider = playerBar.querySelector('[data-test-id="TIMECODE_SLIDER"]');

              if (currentTimeElement && totalTimeElement && progressSlider) {
                const currentTimeText = currentTimeElement.textContent.trim();
                const totalTimeText = totalTimeElement.textContent.trim();
                const progressValue = parseFloat(progressSlider.value) || 0;
                const progressMax = parseFloat(progressSlider.max) || 100;

                return {
                  success: true,
                  currentTime: currentTimeText,
                  totalTime: totalTimeText,
                  progressValue: progressValue,
                  progressMax: progressMax,
                  progressPercent: (progressValue / progressMax) * 100
                };
              } else {
                return { success: false, message: 'Time elements not found' };
              }
            } catch (err) {
              return { success: false, message: 'Error: ' + err.message, error: err.toString() };
            }
          })()
        `,
                awaitPromise: true,
                returnByValue: true,
            });

            if (result.result?.value) {
                const value = result.result.value;

                if (value.success) {
                    return {
                        currentTime: value.currentTime,
                        totalTime: value.totalTime,
                        progressValue: value.progressValue,
                        progressMax: value.progressMax,
                        progressPercent: value.progressPercent,
                    };
                } else {
                    logAndReportError(`Failed to get track time: ${value.message}`, undefined);
                    return null;
                }
            } else {
                logAndReportError("Failed to execute script", undefined);
                return null;
            }
        } catch (err) {
            logAndReportError("Script execution error", err);
            return null;
        }
    }

    async toggleMute(): Promise<boolean> {
        try {
            streamDeck.logger.info("Connecting to Yandex Music");

            const client = await this.getClient();
            if (!client) {
                logAndReportError("Failed to get CDP client", undefined);
                return false;
            }

            const { Runtime } = client;

            streamDeck.logger.info("Toggling mute...");

            const result = await Runtime.evaluate({
                expression: `
          (function() {
            try {
              let muteButton = document.querySelector("button.ChangeVolume_button__4HLEr[data-test-id='CHANGE_VOLUME_BUTTON']");
              if (muteButton) {
                const ariaLabel = muteButton.getAttribute('aria-label');
                const isMuted = ariaLabel === 'Включить звук';

                console.log("Mute button found, current state:", isMuted ? "Muted" : "Unmuted");
                muteButton.click();

                return { success: true, message: isMuted ? 'Sound on' : 'Sound off', wasMuted: isMuted };
              }

              const volumeOffSvg = document.querySelector("svg.ChangeVolume_icon__5Zv2a use[xlink:href='/icons/sprite.svg#volumeOff_xs']");
              if (volumeOffSvg) {
                const muteButton = volumeOffSvg.closest('button');
                if (muteButton) {
                  console.log("Found mute button by SVG - muted");
                  muteButton.click();
                  return { success: true, message: 'Sound on', wasMuted: true };
                }
              }

              const volumeSvg = document.querySelector("svg.ChangeVolume_icon__5Zv2a use[xlink:href='/icons/sprite.svg#volume_xs']");
              if (volumeSvg) {
                const muteButton = volumeSvg.closest('button');
                if (muteButton) {
                  console.log("Found mute button by SVG - unmuted");
                  muteButton.click();
                  return { success: true, message: 'Sound off', wasMuted: false };
                }
              }

              return { success: false, message: 'Mute button not found' };
            } catch (err) {
              return { success: false, message: 'Error: ' + err.message, error: err.toString() };
            }
          })()
        `,
                awaitPromise: true,
                returnByValue: true,
            });

            if (result.result?.value) {
                const value = result.result.value;

                if (value.success) {
                    streamDeck.logger.info(value.message);
                    return true;
                } else {
                    logAndReportError(`Failed to toggle mute: ${value.message}`, undefined);
                    return false;
                }
            } else {
                logAndReportError("Failed to execute script", undefined);
                return false;
            }
        } catch (err) {
            logAndReportError("Script execution error", err);
            return false;
        }
    }

    async disconnect(): Promise<void> {
        if (this.client) {
            try {
                await this.client.close();
                streamDeck.logger.info("CDP connection closed");
            } catch (err) {
                logAndReportError("Error closing CDP connection", err);
            } finally {
                this.client = null;
                this.connected = false;
                this.connectionPromise = null;
            }
        }
    }
}

export const yandexMusicController = new YandexMusicController();
