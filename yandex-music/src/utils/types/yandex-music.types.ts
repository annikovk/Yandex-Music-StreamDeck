/**
 * Type definitions for Yandex Music domain objects.
 */

export interface TrackInfo {
    coverUrl: string;
    originalCoverUrl: string;
    title: string;
    artist: string;
}

export interface TrackTime {
    currentTime: string;
    totalTime: string;
    progressValue: number;
    progressMax: number;
    progressPercent: number;
}
