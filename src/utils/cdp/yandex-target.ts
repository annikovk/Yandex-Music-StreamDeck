/**
 * Picks the Yandex Music page among the targets on a CDP endpoint.
 *
 * Any Chromium browser started with the same --remote-debugging-port (Chrome
 * driven by an automation tool, for example) answers on that port too. Without
 * an explicit target, chrome-remote-interface attaches to the first "page" it
 * sees, which could then be a Chrome tab: the plugin reports "connected" while
 * every DOM query comes back empty.
 */

import CDP from "chrome-remote-interface";
import { CDP_CONFIG } from '../constants/config';

export function isYandexMusicTarget(target: CDP.Target): boolean {
    return target.type === 'page' && target.url.startsWith(CDP_CONFIG.TARGET_URL_PREFIX);
}

/**
 * Returns the Yandex Music page target on host:port. Throws when the port is
 * closed, and also when it is open but none of its pages belong to Yandex Music
 * (another browser holds the port).
 */
export async function findYandexMusicTarget(host: string, port: number): Promise<CDP.Target> {
    const targets = await CDP.List({ host, port });
    const target = targets.find(isYandexMusicTarget);
    if (target) {
        return target;
    }

    let browser = 'unknown';
    try {
        const version = await CDP.Version({ host, port });
        browser = version.Browser;
    } catch {
        // Version is only for the error message.
    }
    throw new Error(
        `Port ${port} is open but has no Yandex Music page (${targets.length} other targets, ` +
        `browser: ${browser}). Another browser is probably using --remote-debugging-port=${port}.`
    );
}
