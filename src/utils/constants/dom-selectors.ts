/**
 * Centralized CSS selectors for Yandex Music DOM elements.
 * All selectors are defined here to avoid hardcoding throughout the codebase.
 */

export const DOM_SELECTORS = {
    // Player bar
    PLAYER_BAR_PRIMARY: ".PlayerBarDesktopWithBackgroundProgressBar_root__bpmwN",
    PLAYER_BAR_FALLBACK: "[data-test-id='PLAYERBAR_DESKTOP']",

    // Sonata section (contains like/dislike buttons)
    SONATA_SECTION: ".PlayerBarDesktopWithBackgroundProgressBar_sonata__mGFb_",
    SONATA_BUTTONS: ".BaseSonataControlsDesktop_sonataButtons__7vLtw button",

    // Play/Pause buttons
    PAUSE_BUTTON: "button.BaseSonataControlsDesktop_sonataButton__GbwFt[data-test-id='PAUSE_BUTTON']",
    PLAY_BUTTON: "button.BaseSonataControlsDesktop_sonataButton__GbwFt[data-test-id='PLAY_BUTTON']",
    PLAY_BUTTON_ICON_CLASS: "BaseSonataControlsDesktop_playButtonIcon__TlFqv",
    PLAY_BUTTON_WITH_COVER_CLASS: "PlayButtonWithCover_playButton__rV9pQ",

    // SVG icons for play/pause
    PAUSE_SVG_ICON: "svg.BaseSonataControlsDesktop_playButtonIcon__TlFqv use[xlink:href='/icons/sprite.svg#pause_filled_l']",
    PLAY_SVG_ICON: "svg.BaseSonataControlsDesktop_playButtonIcon__TlFqv use[xlink:href='/icons/sprite.svg#play_filled_l']",

    // Control buttons
    PREVIOUS_TRACK_BUTTON: "[data-test-id='PREVIOUS_TRACK_BUTTON']",
    NEXT_TRACK_BUTTON: "[data-test-id='NEXT_TRACK_BUTTON']",
    LIKE_BUTTON: "[data-test-id='LIKE_BUTTON']",
    DISLIKE_BUTTON: "[data-test-id='DISLIKE_BUTTON']",

    // Mute button
    MUTE_BUTTON: "button.ChangeVolume_button__4HLEr[data-test-id='CHANGE_VOLUME_BUTTON']",
    VOLUME_OFF_SVG: "svg.ChangeVolume_icon__5Zv2a use[xlink:href='/icons/sprite.svg#volumeOff_xs']",
    VOLUME_ON_SVG: "svg.ChangeVolume_icon__5Zv2a use[xlink:href='/icons/sprite.svg#volume_xs']",

    // Track info
    COVER_IMAGE: "img.PlayerBarDesktopWithBackgroundProgressBar_cover__MKmEt",
    TRACK_TITLE: "[data-test-id='TRACK_TITLE'] .Meta_title__GGBnH",
    ARTIST_NAME: "[data-test-id='SEPARATED_ARTIST_TITLE'] .Meta_artistCaption__JESZi",

    // Time info
    CURRENT_TIME: "[data-test-id='TIMECODE_TIME_START']",
    TOTAL_TIME: "[data-test-id='TIMECODE_TIME_END']",
    PROGRESS_SLIDER: "[data-test-id='TIMECODE_SLIDER']",
} as const;

export const SVG_ICONS = {
    PAUSE_FILLED: '/icons/sprite.svg#pause_filled_l',
    PLAY_FILLED: '/icons/sprite.svg#play_filled_l',
    VOLUME_OFF: '/icons/sprite.svg#volumeOff_xs',
    VOLUME_ON: '/icons/sprite.svg#volume_xs',
    LIKED: 'liked_xs',
} as const;

