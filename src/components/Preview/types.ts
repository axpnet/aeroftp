/**
 * Universal Preview System - Type Definitions
 * 
 * Centralized types for the preview system to ensure consistency
 * and enable easy refactoring.
 */

// Supported file categories
export type PreviewCategory = 'image' | 'audio' | 'video' | 'pdf' | 'markdown' | 'text' | 'code' | 'unknown';

// File metadata for preview
export interface PreviewFileData {
    name: string;
    path: string;
    size: number;
    isRemote: boolean;
    mimeType?: string;
    content?: string | ArrayBuffer;
    blobUrl?: string;
    modified?: string;
}

// Media metadata (audio/video)
export interface MediaMetadata {
    title?: string;
    artist?: string;
    album?: string;
    year?: string;
    genre?: string;
    duration?: number;
    bitrate?: number;
    sampleRate?: number;
    channels?: number;
    codec?: string;
    coverArt?: string; // Base64 or URL
}

// Image metadata (EXIF)
export interface ImageMetadata {
    width: number;
    height: number;
    format: string;
    colorSpace?: string;
    camera?: string;
    dateTaken?: string;
    gps?: { lat: number; lng: number };
}

// PDF metadata
export interface PDFMetadata {
    title?: string;
    author?: string;
    pages: number;
    createdDate?: string;
}

// Playback state for audio/video
export interface PlaybackState {
    isPlaying: boolean;
    currentTime: number;
    duration: number;
    volume: number;
    isMuted: boolean;
    playbackRate: number;
    isLooping: boolean;
    bufferedPercent: number;
}

// Equalizer preset
export interface EQPreset {
    name: string;
    bands: number[]; // 10 bands: 32Hz to 16kHz
}

// Equalizer state
export interface EqualizerState {
    enabled: boolean;
    bands: number[]; // -12 to +12 dB for each band
    balance: number; // -1 (left) to +1 (right)
    presetName: string;
}

// Stream progress for remote files
export interface StreamProgress {
    loaded: number;
    total: number;
    percent: number;
    isComplete: boolean;
}

// Preview modal props
export interface UniversalPreviewProps {
    isOpen: boolean;
    file: PreviewFileData | null;
    onClose: () => void;
    onDownload?: () => void;
    onNext?: () => void;
    onPrevious?: () => void;
    hasNext?: boolean;
    hasPrevious?: boolean;
}

// Viewer component base props
export interface ViewerBaseProps {
    file: PreviewFileData;
    onError?: (error: string) => void;
}
