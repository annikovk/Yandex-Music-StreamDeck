/**
 * Error handling utilities.
 * Type guards and formatting functions for safe error handling.
 */

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
