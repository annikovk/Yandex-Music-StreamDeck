import https from "https";
import streamDeck from "@elgato/streamdeck";

/**
 * Installation ID that uniquely identifies this plugin installation.
 * Set during plugin initialization and used in all analytics calls.
 */
let installation_id: string = "";

/**
 * Sets the installation ID for error reporting.
 * Should be called once during plugin initialization.
 */
export function setInstallationId(id: string): void {
    installation_id = id;
}

/**
 * Gets the current installation ID.
 */
export function getInstallationId(): string {
    return installation_id;
}

interface ErrorReport {
    installation_id: string;  // Empty string if not yet initialized
    error_message: string;
    stack_trace?: string;
}

/**
 * Reports error information to analytics endpoint.
 * This is a fire-and-forget operation with 5-second timeout.
 * Silently ignores its own errors to prevent cascading failures.
 */
export function reportError(message: string, error?: unknown): void {
    try {
        // Extract error details
        let errorMessage = message;
        let stackTrace: string | undefined;

        if (error) {
            if (error instanceof Error) {
                // Check if error.message is already in message to avoid duplication
                if (!message.includes(error.message)) {
                    errorMessage = `${message}: ${error.message}`;
                }
                stackTrace = error.stack;
            } else if (typeof error === 'object') {
                const errStr = JSON.stringify(error);
                if (!message.includes(errStr)) {
                    errorMessage = `${message}: ${errStr}`;
                }
            } else if (typeof error === 'string') {
                if (!message.includes(error)) {
                    errorMessage = `${message}: ${error}`;
                }
            }
        }

        const errorReport: ErrorReport = {
            installation_id: installation_id || "", // Empty string if not yet initialized
            error_message: errorMessage,
            stack_trace: stackTrace
        };

        const postData = JSON.stringify(errorReport);

        const options = {
            hostname: 'annikov.com',
            port: 443,
            path: '/apps/yandex-music-controller/report-error.php',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData),
            },
            timeout: 5000 // 5-second timeout
        };

        const req = https.request(options, (response) => {
            // Consume response data to free up memory
            response.on('data', () => {});
        });

        req.on('error', () => {
            // Silently ignore analytics errors to prevent cascading failures
        });

        req.on('timeout', () => {
            req.destroy();
        });

        req.write(postData);
        req.end();
    } catch (err) {
        // Silently ignore any errors in error reporting to prevent cascading failures
    }
}

/**
 * Logs an error locally and reports it to analytics.
 * This is the primary error handling function that should be used throughout the codebase.
 */
export function logAndReportError(message: string, error?: unknown): void {
    // First, log locally (preserves existing behavior)
    if (error) {
        streamDeck.logger.error(message, error);
    } else {
        streamDeck.logger.error(message);
    }

    // Then, report to analytics (fire-and-forget)
    reportError(message, error);
}
