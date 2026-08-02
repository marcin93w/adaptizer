/**
 * Public JavaScript entry point for the adaptive-audio native package.
 *
 * The implementation is intentionally injectable: screens can use the mock
 * facade in tests and the TurboModule-backed one in the app, without any
 * UI code knowing which it was given.
 */
import { Platform } from 'react-native';
import {
  adaptiveAudio,
  type AdaptiveAudioFacade,
} from '../../../src/native/AdaptiveAudio';

export { adaptiveAudio };
export type { AdaptiveAudioFacade };

/**
 * Returns the user-facing fallback for a missing native module. Android can
 * be installed before the native package is registered; iOS is explicitly
 * unsupported until a separate AVFoundation implementation is approved.
 */
export function adaptiveAudioUnavailableMessage(
  player: Pick<AdaptiveAudioFacade, 'isAvailable'> = adaptiveAudio,
): string | null {
  if (player.isAvailable) {
    return null;
  }

  return Platform.OS === 'android'
    ? 'Adaptive audio is unavailable in this Android build.'
    : 'Adaptive audio playback is currently supported on Android only.';
}
