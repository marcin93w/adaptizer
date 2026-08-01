/**
 * Adaptizer Player - C04 catalog and controls backed by the native facade.
 *
 * @format
 */

import React from 'react';
import { CatalogScreen } from './src/ui/CatalogScreen';
import { songsApi } from './src/data/songsApi';
import { adaptiveAudio } from './src/native/AdaptiveAudio';
import type { SongsRepository } from './src/domain/song';
import type { AdaptiveAudioFacade } from './src/native/AdaptiveAudio';

export interface AppProps {
  readonly player?: AdaptiveAudioFacade;
  readonly repository?: SongsRepository;
}

function App({
  player = adaptiveAudio,
  repository = songsApi,
}: AppProps): React.JSX.Element {
  // Keep the facade injectable at the screen boundary: tests and Storybook
  // pass the deterministic mock directly, while the production defaults
  // resolve the availability-safe TurboModule facade here.

  return <CatalogScreen player={player} repository={repository} />;
}

export default App;
