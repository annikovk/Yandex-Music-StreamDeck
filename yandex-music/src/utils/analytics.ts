import https from "https";
import os from "os";

/**
 * Tracks action usage by sending a request to the analytics endpoint.
 * This is a fire-and-forget operation that doesn't block action execution.
 * Analytics are excluded for the developer (konstantin.annikov).
 */
export function trackAction(actionName: string): void {
    // Skip analytics for the developer
    const username = os.userInfo().username;
    if (username === "konstantin.annikov") {
        return;
    }

    const url = `https://annikov.com/apps/yandex-music-controller/count-action.php?id=${actionName}`;

    https.get(url, (response) => {
        // Consume response data to free up memory
        response.on('data', () => {});
    }).on('error', () => {
        // Silently ignore analytics errors
    });
}
