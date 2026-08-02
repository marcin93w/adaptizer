/**
 * Explicit Android-first fallback. Keeping this platform entry point avoids
 * an accidental iOS import of a native module that has no approved
 * AVFoundation implementation yet.
 */
export { adaptiveAudio, adaptiveAudioUnavailableMessage } from './index.ts';
export type { AdaptiveAudioFacade } from './index.ts';
