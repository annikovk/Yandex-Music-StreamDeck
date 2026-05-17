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
    // Player bar root.
    // YM ships two mutually-exclusive player containers depending on the view:
    //   - PLAYERBAR_DESKTOP   — search / concerts / landing / collection (the
    //                           classic bottom bar with the long progress bar)
    //   - VIBE_PLAYERBAR      — Моя Волна / My Vibe (compact floating bar)
    // Both contain the same data-test-id buttons inside (PLAY_BUTTON,
    // NEXT_TRACK_BUTTON, LIKE_BUTTON, CHANGE_VOLUME_BUTTON, ...), so once we
    // pick the right root, every button query "just works" when scoped to it.
    PLAYER_BAR_PRIMARY: ".PlayerBarDesktopWithBackgroundProgressBar_root__bpmwN",
    PLAYER_BAR_FALLBACK: "[data-test-id='PLAYERBAR_DESKTOP']",
    PLAYER_BAR_VIBE: "[data-test-id='VIBE_PLAYERBAR']",

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

    // Track info (desktop bar)
    COVER_IMAGE: "img.PlayerBarDesktopWithBackgroundProgressBar_cover__MKmEt",
    TRACK_TITLE: "[data-test-id='TRACK_TITLE']",
    ARTIST_NAME: "[data-test-id='SEPARATED_ARTIST_TITLE']",

    // Track info (Vibe bar) — class-substring selectors are hash-agnostic.
    // The Vibe bar does not surface a separate "artist" label in its compact
    // layout; the album name on AlbumCover_root's aria-label is the closest
    // human-readable string available, so we fall back to it as a stand-in.
    VIBE_COVER_IMAGE: "img[class*='AlbumCover_cover']",
    VIBE_TRACK_TITLE: "[class*='VibePlayerbarMeta_trackNameText']",
    VIBE_ALBUM_LABEL: "[class*='AlbumCover_root'][aria-label]",

    // Time info
    CURRENT_TIME: "[data-test-id='TIMECODE_TIME_START']",
    TOTAL_TIME: "[data-test-id='TIMECODE_TIME_END']",
    PROGRESS_SLIDER: "[data-test-id='TIMECODE_SLIDER']",
} as const;

/**
 * Substrings checked against `<use xlink:href>` (e.g. "/icons/sprite.svg#play_filled_l").
 *
 * The desktop player bar uses sprite IDs like `play_filled_l` / `pause_filled_l`,
 * while the Vibe player bar on My Vibe uses just `play` / `pause`. We match by
 * substring to cover both — the sprite is only ever read from the PLAY_BUTTON
 * element itself (scoped to the player bar), so no false-positive risk from
 * unrelated sprites elsewhere on the page (e.g. `playQueue_xs` in toolbars).
 */
export const SVG_ICONS = {
    PAUSE_FILLED: 'pause',
    PLAY_FILLED: 'play',
    VOLUME_OFF: 'volumeOff',
    LIKED: 'liked_',
} as const;
