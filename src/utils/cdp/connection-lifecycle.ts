/**
 * Manages CDP connection lifecycle tracking.
 * Tracks connection grace period to avoid false error reporting during initial connection.
 */

import { APP_LIFECYCLE_CONFIG } from '../constants/config';

export class ConnectionLifecycleManager {
    private connectionEstablished: boolean = false;
    private connectionTimestamp: number = 0;

    /**
     * Marks that the CDP connection was just established.
     * Starts the grace period timer.
     */
    markConnectionEstablished(): void {
        this.connectionEstablished = true;
        this.connectionTimestamp = Date.now();
    }

    /**
     * Resets the connection state.
     * Should be called when connection is lost.
     */
    resetConnectionState(): void {
        this.connectionEstablished = false;
        this.connectionTimestamp = 0;
    }

    /**
     * Checks if we're within the grace period after connection establishment.
     * During this period, DOM operation errors should not be reported to analytics.
     */
    isInConnectionGracePeriod(): boolean {
        if (!this.connectionEstablished) {
            return false;
        }

        const timeSinceConnection = Date.now() - this.connectionTimestamp;
        if (timeSinceConnection > APP_LIFECYCLE_CONFIG.LAUNCH_GRACE_PERIOD_MS) {
            this.connectionEstablished = false;
            return false;
        }

        return true;
    }

    /**
     * Gets the time elapsed since connection was established.
     * Returns 0 if connection was never established or was reset.
     */
    getTimeSinceConnection(): number {
        if (!this.connectionEstablished) {
            return 0;
        }
        return Date.now() - this.connectionTimestamp;
    }
}
