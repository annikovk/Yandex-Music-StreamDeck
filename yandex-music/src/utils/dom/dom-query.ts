/**
 * DOM query helper utilities.
 * Provides consistent query building for Yandex Music DOM elements.
 */

import { DOM_SELECTORS } from '../constants/dom-selectors';

export class DOMQueryHelper {
    /**
     * Builds a query expression to find the player bar element.
     */
    buildPlayerBarQuery(): string {
        return `
            let playerBar = document.querySelector("${DOM_SELECTORS.PLAYER_BAR_PRIMARY}");
            if (!playerBar) {
                playerBar = document.querySelector("${DOM_SELECTORS.PLAYER_BAR_FALLBACK}");
                if (!playerBar) {
                    return { success: false, message: 'Player bar not found' };
                }
            }
        `;
    }

    /**
     * Builds a query expression to find a button by test ID.
     */
    buildButtonQuery(buttonId: string): string {
        return `
            ${this.buildPlayerBarQuery()}
            let button = playerBar.querySelector("[data-test-id='${buttonId}']");
        `;
    }

    /**
     * Builds a fallback query for like/dislike buttons by position.
     */
    buildLikeDislikeFallbackQuery(buttonId: string): string {
        const isLike = buttonId === 'LIKE_BUTTON';
        const selector = isLike ? 'button:last-of-type' : 'button:first-of-type';

        return `
            if (!button) {
                const sonataSection = playerBar.querySelector("${DOM_SELECTORS.SONATA_SECTION}");
                if (sonataSection) {
                    button = sonataSection.querySelector("${selector}");
                }
            }
        `;
    }
}
