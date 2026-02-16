import streamDeck from "@elgato/streamdeck";
import { randomUUID } from "crypto";

import { PlayPauseAction } from "./actions/play-pause-action";
import { PreviousTrackAction } from "./actions/previous-track-action";
import { NextTrackAction } from "./actions/next-track-action";
import { LikeAction } from "./actions/like-action";
import { DislikeAction } from "./actions/dislike-action";
import { MuteAction } from "./actions/mute-action";
import { yandexMusicController } from "./utils/yandex-music-controller";
import { setInstallationId } from "./utils/core/installation-id";
import { logAndReportError } from "./utils/telemetry/error-reporter";
import { installationReporter } from "./utils/telemetry/installation-reporter";
import type { StreamDeckInfo } from "./utils/types/analytics.types";
import type { PluginGlobalSettings } from "./types/settings";

async function initializeInstallationId(): Promise<string> {
    const settings = await streamDeck.settings.getGlobalSettings() as PluginGlobalSettings;

    if (settings.installation_id) {
        streamDeck.logger.info("Loaded existing installation_id:", settings.installation_id);
        return settings.installation_id;
    }

    const newInstallationId = randomUUID();
    await streamDeck.settings.setGlobalSettings({
        installation_id: newInstallationId
    });

    streamDeck.logger.info("Generated new installation_id:", newInstallationId);
    return newInstallationId;
}

// Enable info logging
streamDeck.logger.setLevel("info");

// Register all Yandex Music actions
streamDeck.actions.registerAction(new PlayPauseAction());
streamDeck.actions.registerAction(new PreviousTrackAction());
streamDeck.actions.registerAction(new NextTrackAction());
streamDeck.actions.registerAction(new LikeAction());
streamDeck.actions.registerAction(new DislikeAction());
streamDeck.actions.registerAction(new MuteAction());

// Connect to the Stream Deck FIRST (required before using any streamDeck APIs)
await streamDeck.connect();

// NOW initialize installation ID (after streamDeck.connect so we can access settings)
const installationId = await initializeInstallationId();
setInstallationId(installationId);
streamDeck.logger.info("Installation ID initialized:", installationId);

// Try to connect to CDP if app is already running (non-fatal)
await yandexMusicController
    .connect()
    .then(() => {
        streamDeck.logger.info("CDP connection established - Yandex Music is already running");
    })
    .catch(() => {
        // This is expected if the app isn't running yet - it will be launched when needed
        streamDeck.logger.info("Yandex Music not running yet - will launch on first button press");
    });

// Report installation information to analytics
const streamDeckInfo: StreamDeckInfo = {
    application: streamDeck.info.application,
    plugin: streamDeck.info.plugin,
};

installationReporter
    .report(
        streamDeckInfo,
        () => yandexMusicController.detectMacOSAppPath(),
        () => yandexMusicController.isConnected()
    )
    .then(() => {
        streamDeck.logger.info("Installation info reported");
    })
    .catch((err) => {
        logAndReportError("Error reporting installation info", err);
    });