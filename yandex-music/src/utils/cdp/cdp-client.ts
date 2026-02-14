/**
 * CDP client connection management.
 * Handles connection lifecycle, disconnection events, and state tracking.
 */

import CDP from "chrome-remote-interface";
import type { CDPClient } from '../types/cdp.types';
import { CDP_CONFIG } from '../constants/config';
import { logger } from '../core/logger';

export type ConnectionState = 'disconnected' | 'connecting' | 'connected';

export class CDPClientManager {
    private port: number = CDP_CONFIG.DEFAULT_PORT;
    private client: CDPClient | null = null;
    private connectionPromise: Promise<CDPClient> | null = null;
    private state: ConnectionState = 'disconnected';
    private onDisconnectCallback?: () => void;

    /**
     * Sets the CDP port number.
     * Returns true if port was changed, false if unchanged.
     */
    setPort(newPort: number): boolean {
        if (newPort === this.port) {
            logger.info(`Port unchanged (${newPort})`);
            return false;
        }

        logger.info(`Changing port from ${this.port} to ${newPort}`);
        this.port = newPort;
        return true;
    }

    /**
     * Gets the current port number.
     */
    getPort(): number {
        return this.port;
    }

    /**
     * Sets the callback to be called when connection is lost.
     */
    setOnDisconnect(callback: () => void): void {
        this.onDisconnectCallback = callback;
    }

    /**
     * Gets the current connection state.
     */
    getConnectionState(): ConnectionState {
        return this.state;
    }

    /**
     * Checks if currently connected.
     */
    isConnected(): boolean {
        return this.state === 'connected';
    }

    /**
     * Establishes CDP connection.
     * Returns existing connection if already connected/connecting.
     */
    async connect(): Promise<CDPClient> {
        // Return existing connection if available
        if (this.connectionPromise) {
            return this.connectionPromise;
        }

        // Create new connection
        this.connectionPromise = this.createConnection();
        return this.connectionPromise;
    }

    /**
     * Gets the connected client.
     * Returns null if not connected.
     */
    getClient(): CDPClient | null {
        return this.client;
    }

    /**
     * Resets connection state for reconnection attempts.
     */
    resetConnection(): void {
        this.client = null;
        this.connectionPromise = null;
        this.state = 'disconnected';
    }

    /**
     * Closes the CDP connection.
     */
    async disconnect(): Promise<void> {
        if (this.client) {
            try {
                await this.client.close();
                logger.info("CDP connection closed");
            } catch (error: unknown) {
                logger.error("Error closing CDP connection", error);
            } finally {
                this.resetConnection();
            }
        }
    }

    /**
     * Creates a new CDP connection.
     */
    private async createConnection(): Promise<CDPClient> {
        try {
            // Use existing client if available
            if (this.client) {
                logger.info("Using existing CDP connection");
                this.state = 'connected';
                return this.client;
            }

            this.state = 'connecting';
            logger.info(`Creating new CDP connection on port ${this.port}`);

            // Connect to CDP
            const client = await CDP({
                port: this.port,
                host: CDP_CONFIG.HOST
            }) as unknown as CDPClient;

            // Enable Runtime and Page domains
            await Promise.all([
                client.Page.enable(),
                client.Runtime.enable()
            ]);

            // Set up disconnect handler
            client.on("disconnect", () => {
                logger.info("CDP connection lost");
                this.resetConnection();
                this.onDisconnectCallback?.();
            });

            this.client = client;
            this.state = 'connected';
            logger.info("CDP connection established successfully");

            return client;
        } catch (error: unknown) {
            this.resetConnection();

            if (error instanceof Error && error.message?.includes("connect ECONNREFUSED")) {
                throw new Error(
                    `Failed to connect to Yandex Music on port ${this.port}. ` +
                    `Ensure the app is running with --remote-debugging-port=${this.port}`
                );
            }

            throw new Error(`Error creating CDP client: ${error}`);
        }
    }
}
