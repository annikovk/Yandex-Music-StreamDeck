/**
 * Centralized CSS selectors for Yandex Music DOM elements.
 *
 * Selector rules:
 * 1. Prefer stable `data-test-id` attributes over CSS-module class names
 *    (which contain content hashes that change on every app release).
 * 2. Always scope queries to the player bar root — there are many
 *    `data-test-id='PLAY_BUTTON'` etc. on the home page (NewRelease cards).
 * 3. Determine play/pause state from the `<use xlink:href>` inside the
 *    single PLAY_BUTTON inside the player bar — newer YM versions no longer
 *    rename the test-id to PAUSE_BUTTON when playing.
 */

export const DOM_SELECTORS = {
    // Player bar root
    PLAYER_BAR_PRIMARY: ".PlayerBarDesktopWithBackgroundProgressBar_root__bpmwN",
    PLAYER_BAR_FALLBACK: "[data-test-id='PLAYERBAR_DESKTOP']",

    // Play/Pause button (single button per bar; state via sprite href)
    PLAY_BUTTON: "[data-test-id='PLAY_BUTTON']",
    PAUSE_BUTTON: "[data-test-id='PAUSE_BUTTON']",

    // Control buttons
    PREVIOUS_TRACK_BUTTON: "[data-test-id='PREVIOUS_TRACK_BUTTON']",
    NEXT_TRACK_BUTTON: "[data-test-id='NEXT_TRACK_BUTTON']",
    LIKE_BUTTON: "[data-test-id='LIKE_BUTTON']",
    DISLIKE_BUTTON: "[data-test-id='DISLIKE_BUTTON']",

    // Mute button
    MUTE_BUTTON: "[data-test-id='CHANGE_VOLUME_BUTTON']",

    // Track info
    COVER_IMAGE: "img.PlayerBarDesktopWithBackgroundProgressBar_cover__MKmEt",
    TRACK_TITLE: "[data-test-id='TRACK_TITLE']",
    ARTIST_NAME: "[data-test-id='SEPARATED_ARTIST_TITLE']",

    // Time info
    CURRENT_TIME: "[data-test-id='TIMECODE_TIME_START']",
    TOTAL_TIME: "[data-test-id='TIMECODE_TIME_END']",
    PROGRESS_SLIDER: "[data-test-id='TIMECODE_SLIDER']",
} as const;

/**
 * Substrings checked against `<use xlink:href>` (e.g. "/icons/sprite.svg#play_filled_l").
 * Matching by substring keeps the check stable across icon-size variants (_l/_m/_xs).
 */
export const SVG_ICONS = {
    PAUSE_FILLED: 'pause_filled',
    PLAY_FILLED: 'play_filled',
    VOLUME_OFF: 'volumeOff',
    LIKED: 'liked_',
} as const;
