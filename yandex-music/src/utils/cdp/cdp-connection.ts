/**
 * CDP reconnection logic with exponential backoff.
 * Manages reconnection attempts when connection is lost.
 */

import { RECONNECTION_CONFIG } from '../constants/config';
import { logger } from '../core/logger';

export class CDPReconnectionManager {
    private attemptCount: number = 0;
    private isReconnecting: boolean = false;

    /**
     * Attempts to reconnect with exponential backoff.
     * Returns a promise that resolves when reconnection should be attempted.
     */
    async attemptReconnect(connectFn: () => Promise<void>): Promise<void> {
        if (this.attemptCount >= RECONNECTION_CONFIG.MAX_ATTEMPTS) {
            logger.error(
                `Max reconnection attempts reached (${RECONNECTION_CONFIG.MAX_ATTEMPTS})`
            );
            return;
        }

        if (this.isReconnecting) {
            logger.info("Reconnection already in progress");
            return;
        }

        this.attemptCount++;
        this.isReconnecting = true;

        const delayMs = RECONNECTION_CONFIG.EXPONENTIAL_BACKOFF
            ? RECONNECTION_CONFIG.INITIAL_DELAY_MS * this.attemptCount
            : RECONNECTION_CONFIG.INITIAL_DELAY_MS;

        logger.info(
            `Reconnection attempt ${this.attemptCount}/${RECONNECTION_CONFIG.MAX_ATTEMPTS} ` +
            `in ${delayMs}ms...`
        );

        await new Promise(resolve => setTimeout(resolve, delayMs));

        try {
            await connectFn();
            logger.info("Reconnection successful");
            this.resetAttempts();
        } catch (error: unknown) {
            logger.error("Reconnection failed", error);
            this.isReconnecting = false;
            // Recursively attempt reconnection
            await this.attemptReconnect(connectFn);
        }
    }

    /**
     * Resets reconnection attempt counter.
     * Should be called after successful connection.
     */
    resetAttempts(): void {
        this.attemptCount = 0;
        this.isReconnecting = false;
    }

    /**
     * Gets the current attempt count.
     */
    getAttemptCount(): number {
        return this.attemptCount;
    }

    /**
     * Checks if currently attempting to reconnect.
     */
    isAttemptingReconnect(): boolean {
        return this.isReconnecting;
    }
}
