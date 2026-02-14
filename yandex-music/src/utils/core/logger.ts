/**
 * Typed logging utilities with error handling helpers.
 * Wraps streamDeck.logger with type-safe error handling.
 */

import streamDeck from "@elgato/streamdeck";

/**
 * Type guard to check if a value is an Error object.
 */
export function isError(value: unknown): value is Error {
    return value instanceof Error;
}

/**
 * Safely formats an error for logging.
 * Handles Error objects, strings, and unknown types.
 */
export function formatError(error: unknown): string {
    if (isError(error)) {
        return error.message;
    }
    if (typeof error === 'string') {
        return error;
    }
    if (typeof error === 'object' && error !== null) {
        return JSON.stringify(error);
    }
    return String(error);
}

/**
 * Extracts stack trace from an error if available.
 */
export function getErrorStack(error: unknown): string | undefined {
    if (isError(error)) {
        return error.stack;
    }
    return undefined;
}

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
        if (error !== undefined) {
            streamDeck.logger.error(message, error);
        } else {
            streamDeck.logger.error(message);
        }
    },

    setLevel: (level: "trace" | "debug" | "info" | "warn" | "error"): void => {
        streamDeck.logger.setLevel(level);
    },
};
