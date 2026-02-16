/**
 * Typed wrapper around CDP Runtime.evaluate.
 * Provides type-safe execution of JavaScript in the browser context.
 */

import type { CDPClient, EvaluateOptions } from '../types/cdp.types';
import { logger } from '../core/logger';

export class CDPExecutor {
    constructor(
        private getClient: () => CDPClient | null,
        private isInGracePeriod?: () => boolean
    ) {}

    /**
     * Evaluates JavaScript expression and returns typed result.
     * Returns null if evaluation fails or client is unavailable.
     */
    async evaluate<T = unknown>(
        expression: string,
        options: Partial<EvaluateOptions> = {}
    ): Promise<T | null> {
        try {
            const client = this.getClient();
            if (!client) {
                return null;
            }

            const { Runtime } = client;
            const result = await Runtime.evaluate({
                expression,
                awaitPromise: options.awaitPromise ?? false,
                returnByValue: options.returnByValue ?? true,
                ...options,
            });

            if (result.exceptionDetails) {
                if (!this.isInGracePeriod?.()) {
                    logger.error(
                        'CDP evaluation exception',
                        result.exceptionDetails.exception?.description
                    );
                }
                return null;
            }

            return (result.result?.value as T) ?? null;
        } catch (error: unknown) {
            logger.error('Error evaluating expression', error);
            return null;
        }
    }

    /**
     * Evaluates JavaScript and returns the full result with success status.
     * Useful when you need to distinguish between null results and failures.
     */
    async evaluateWithResult<T = unknown>(
        expression: string,
        options: Partial<EvaluateOptions> = {}
    ): Promise<{ success: boolean; value: T | null }> {
        try {
            const client = this.getClient();
            if (!client) {
                return { success: false, value: null };
            }

            const { Runtime } = client;
            const result = await Runtime.evaluate({
                expression,
                awaitPromise: options.awaitPromise ?? false,
                returnByValue: options.returnByValue ?? true,
                ...options,
            });

            if (result.exceptionDetails) {
                if (!this.isInGracePeriod?.()) {
                    logger.error(
                        'CDP evaluation exception',
                        result.exceptionDetails.exception?.description
                    );
                }
                return { success: false, value: null };
            }

            return {
                success: true,
                value: (result.result?.value as T) ?? null,
            };
        } catch (error: unknown) {
            logger.error('Error evaluating expression', error);
            return { success: false, value: null };
        }
    }
}
