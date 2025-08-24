// Media and video related type definitions

export type MediaType = 'hls' | 'dash' | 'file';

export type SkipReason = 'drm' | '403' | 'cors' | 'mime-mismatch' | 'widevine-hint' | 'live';

export interface VideoVariant {
  bandwidth?: number; // bits per second
  resolution?: string; // "1920x1080"
  codecs?: string; // codec information
  frameRate?: number; // frames per second
  label?: string; // display label "1080p"
  audioOnly?: boolean; // audio only track
  manifestUrl?: string; // HLS/DASH manifest URL
}

export interface MediaCandidate {
  id: string; // unique identifier (dedupKey)
  url: string; // video URL
  mediaType: MediaType; // media type
  pageUrl?: string; // source page URL
  pageTitle?: string; // page title
  thumbnailUrl?: string; // thumbnail URL
  duration?: number; // video duration in seconds
  fileSize?: number; // file size in bytes
  variants?: VideoVariant[]; // available quality options
  headers?: Record<string, string>; // required HTTP headers
  detectedAt: Date; // detection timestamp
}

export interface MediaCandidateDTO {
  id: string;
  url: string;
  mediaType: MediaType;
  pageUrl?: string;
  pageTitle?: string;
  thumbnailUrl?: string;
  durationSec?: number;
  fileSizeBytes?: number;
  variants?: VideoVariant[];
  headers?: Record<string, string>;
  detectedAt: string; // ISO8601 string
}
