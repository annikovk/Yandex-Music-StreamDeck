/**
 * Typed logging utilities.
 * Wraps streamDeck.logger with automatic error reporting to analytics.
 */

import streamDeck from "@elgato/streamdeck";
import { reportError } from "../telemetry/error-reporter";

// Re-export error utilities for convenience
export { isError, formatError, getErrorStack } from './error-utils';

/**
 * Type-safe logger wrapper around streamDeck.logger.
 */
export const logger = {
    info: (message: string, ...args: unknown[]): void => {
        streamDeck.logger.info(message, ...args);
    },

    warn: (message: string, ...args: unknown[]): void => {
        streamDeck.logger.warn(message, ...args);
    },

    error: (message: string, error?: unknown): void => {
        // Log locally first (always succeeds)
        if (error !== undefined) {
            streamDeck.logger.error(message, error);
        } else {
            streamDeck.logger.error(message);
        }

        // Report to analytics (fire-and-forget, never throw)
        try {
            reportError(message, error);
        } catch {
            // Silently ignore any errors in error reporting to prevent cascading failures
        }
    },

    setLevel: (level: "trace" | "debug" | "info" | "warn" | "error"): void => {
        streamDeck.logger.setLevel(level);
    },
};
