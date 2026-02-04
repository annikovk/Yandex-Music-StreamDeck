import streamDeck from "@elgato/streamdeck";

import { PlayPauseAction } from "./actions/play-pause-action";
import { PreviousTrackAction } from "./actions/previous-track-action";
import { NextTrackAction } from "./actions/next-track-action";
import { LikeAction } from "./actions/like-action";
import { DislikeAction } from "./actions/dislike-action";
import { MuteAction } from "./actions/mute-action";
import { yandexMusicController } from "./utils/yandex-music-controller";

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
yandexMusicController
    .connect()
    .then(() => {
        streamDeck.logger.info("CDP connection initialized on plugin startup");
    })
    .catch((err) => {
        streamDeck.logger.error("Error initializing CDP connection:", err);
    });

// Finally, connect to the Stream Deck
streamDeck.connect();
