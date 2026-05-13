export type IconTheme = 'white' | 'gradient' | 'yellow' | 'orange' | 'gray';

const BASE = 'imgs/actions/actions-icons';

export const ICON_THEMES: Record<IconTheme, {
    play: string; back: string; next: string;
    like: string; noLike: string; dislike: string;
    soundOn: string; soundOff: string;
}> = {
    white:    { play: `${BASE}/white/play`,    back: `${BASE}/white/back`,    next: `${BASE}/white/next`,    like: `${BASE}/white/like-1`,    noLike: `${BASE}/white/like-0`,    dislike: `${BASE}/white/dislike`,    soundOn: `${BASE}/white/sound-on`,    soundOff: `${BASE}/white/sound-off` },
    gradient: { play: `${BASE}/gradient/play`, back: `${BASE}/gradient/back`, next: `${BASE}/gradient/next`, like: `${BASE}/gradient/like-1`, noLike: `${BASE}/gradient/like-0`, dislike: `${BASE}/gradient/dislike`, soundOn: `${BASE}/gradient/sound-on`, soundOff: `${BASE}/gradient/sound-off` },
    yellow:   { play: `${BASE}/yellow/play`,   back: `${BASE}/yellow/back`,   next: `${BASE}/yellow/next`,   like: `${BASE}/yellow/like-1`,   noLike: `${BASE}/yellow/like-0`,   dislike: `${BASE}/yellow/dislike`,   soundOn: `${BASE}/yellow/sound-on`,   soundOff: `${BASE}/yellow/sound-off` },
    orange:   { play: `${BASE}/orange/play`,   back: `${BASE}/orange/back`,   next: `${BASE}/orange/next`,   like: `${BASE}/orange/like-1`,   noLike: `${BASE}/orange/like-0`,   dislike: `${BASE}/orange/dislike`,   soundOn: `${BASE}/orange/sound-on`,   soundOff: `${BASE}/orange/sound-off` },
    gray:     { play: `${BASE}/gray/play`,     back: `${BASE}/gray/back`,     next: `${BASE}/gray/next`,     like: `${BASE}/gray/like-1`,     noLike: `${BASE}/gray/like-0`,     dislike: `${BASE}/gray/dislike`,     soundOn: `${BASE}/gray/sound-on`,     soundOff: `${BASE}/gray/sound-off` },
};
