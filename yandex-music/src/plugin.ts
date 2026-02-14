import streamDeck from "@elgato/streamdeck";
import { randomUUID } from "crypto";

import { PlayPauseAction } from "./actions/play-pause-action";
import { PreviousTrackAction } from "./actions/previous-track-action";
import { NextTrackAction } from "./actions/next-track-action";
import { LikeAction } from "./actions/like-action";
import { DislikeAction } from "./actions/dislike-action";
import { MuteAction } from "./actions/mute-action";
import { yandexMusicController } from "./utils/yandex-music-controller";
import { reportInstallation, setInstallationId } from "./utils/analytics";
import { logAndReportError } from "./utils/error-reporting";

async function initializeInstallationId(): Promise<string> {
    const settings = await streamDeck.settings.getGlobalSettings() as { installation_id?: string };

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


// Initialize CDP connection on startup
await yandexMusicController
    .connect()
    .then(() => {
        streamDeck.logger.info("CDP connection initialized on plugin startup");
    })
    .catch((err) => {
        logAndReportError("Error initializing CDP connection", err);
    });

// Finally, connect to the Stream Deck
await streamDeck.connect();

// Initialize and set installation ID
const installationId = await initializeInstallationId();
setInstallationId(installationId);

// Report installation information to analytics
reportInstallation({
    application: streamDeck.info.application,
    plugin: streamDeck.info.plugin,
})
    .then(() => {
        streamDeck.logger.info("Installation info reported");
    })
    .catch((err) => {
        logAndReportError("Error reporting installation info", err);
    });