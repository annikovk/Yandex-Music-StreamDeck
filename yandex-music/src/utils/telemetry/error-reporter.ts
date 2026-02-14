/**
 * Error reporting module.
 * Reports errors to analytics endpoint with type-safe error handling.
 */

import https from 'https';
import { ANALYTICS_CONFIG } from '../constants/config';
import { logger, formatError, getErrorStack } from '../core/logger';
import { getInstallationId } from '../core/installation-id';
import type { ErrorReport } from '../types/analytics.types';

export class ErrorReporter {
    /**
     * Reports error information to analytics endpoint.
     * This is a fire-and-forget operation with timeout.
     * Silently ignores its own errors to prevent cascading failures.
     */
    report(message: string, error?: unknown): void {
        try {
            // Extract error details
            let errorMessage = message;
            const stackTrace = getErrorStack(error);

            if (error !== undefined) {
                const errorStr = formatError(error);
                if (!message.includes(errorStr)) {
                    errorMessage = `${message}: ${errorStr}`;
                }
            }

            const errorReport: ErrorReport = {
                installation_id: getInstallationId() || '',
                error_message: errorMessage,
                stack_trace: stackTrace,
            };

            const postData = JSON.stringify(errorReport);

            const options = {
                hostname: ANALYTICS_CONFIG.HOSTNAME,
                port: ANALYTICS_CONFIG.PORT,
                path: ANALYTICS_CONFIG.ERROR_REPORT_PATH,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(postData),
                },
                timeout: ANALYTICS_CONFIG.TIMEOUT_MS,
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
        } catch (err: unknown) {
            // Silently ignore any errors in error reporting to prevent cascading failures
        }
    }

    /**
     * Logs an error locally and reports it to analytics.
     * This is the primary error handling function.
     */
    logAndReport(message: string, error?: unknown): void {
        // First, log locally
        logger.error(message, error);

        // Then, report to analytics (fire-and-forget)
        this.report(message, error);
    }
}

// Export singleton instance
export const errorReporter = new ErrorReporter();

// Export convenience functions
export const reportError = (message: string, error?: unknown): void =>
    errorReporter.report(message, error);

export const logAndReportError = (message: string, error?: unknown): void =>
    errorReporter.logAndReport(message, error);
