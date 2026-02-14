/**
 * Single source of truth for installation ID management.
 * Eliminates duplication between error-reporting and analytics modules.
 */

import type { InstallationId } from '../types/analytics.types';

let installationId: InstallationId = '';

/**
 * Sets the installation ID for this plugin instance.
 * Should be called once during plugin initialization.
 */
export function setInstallationId(id: InstallationId): void {
    installationId = id;
}

/**
 * Gets the current installation ID.
 * Returns empty string if not yet initialized.
 */
export function getInstallationId(): InstallationId {
    return installationId;
}
