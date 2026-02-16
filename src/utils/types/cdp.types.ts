/**
 * Type definitions for Chrome DevTools Protocol (CDP) client.
 * These types replace 'any' types throughout the codebase for better type safety.
 */

export interface CDPRuntime {
    enable(): Promise<void>;
    evaluate(options: EvaluateOptions): Promise<EvaluateResult>;
}

export interface CDPPage {
    enable(): Promise<void>;
}

export interface CDPClient {
    Runtime: CDPRuntime;
    Page: CDPPage;
    on(event: "disconnect", handler: () => void): void;
    close(): Promise<void>;
}

export interface EvaluateOptions {
    expression: string;
    awaitPromise?: boolean;
    returnByValue?: boolean;
}

export interface EvaluateResult {
    result?: {
        value?: unknown;
    };
    exceptionDetails?: {
        exception?: {
            description?: string;
        };
    };
}
