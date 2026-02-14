/**
 * Analytics reporting module.
 * Tracks action usage by sending requests to analytics endpoint.
 */

import https from 'https';
import { ANALYTICS_CONFIG } from '../constants/config';
import { logger } from '../core/logger';
import { getInstallationId } from '../core/installation-id';

export class AnalyticsReporter {
    /**
     * Tracks action usage by sending a request to the analytics endpoint.
     * This is a fire-and-forget operation that doesn't block action execution.
     */
    trackAction(actionName: string): void {
        const url =
            `https://${ANALYTICS_CONFIG.HOSTNAME}${ANALYTICS_CONFIG.ACTION_TRACKING_PATH}` +
            `?id=${actionName}&installation_id=${getInstallationId()}`;

        https
            .get(url, (response) => {
                // Consume response data to free up memory
                logger.info(`Sent analytics event for action "${actionName}"`);
                response.on('data', () => {});
            })
            .on('error', () => {
                logger.error(`Failed to send analytics event for action "${actionName}"`);
                // Silently ignore analytics errors
            });
    }
}

// Export singleton instance
export const analyticsReporter = new AnalyticsReporter();

// Export convenience function
export const trackAction = (actionName: string): void =>
    analyticsReporter.trackAction(actionName);
