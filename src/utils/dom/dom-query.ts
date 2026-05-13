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
     * Builds a query expression to find a button by test ID, scoped to the player bar.
     */
    buildButtonQuery(buttonId: string): string {
        return `
            ${this.buildPlayerBarQuery()}
            let button = playerBar.querySelector("[data-test-id='${buttonId}']");
        `;
    }
}
