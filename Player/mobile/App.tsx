/**
 * Adaptizer Player - C02 catalog presentation backed by the D01 mock.
 *
 * @format
 */

import React, { useMemo } from 'react';
import { CatalogScreen } from './src/ui/CatalogScreen';
import type { Song } from './src/domain/song';
import { createMockAdaptiveAudio } from './src/native/mockAdaptiveAudio';

const DEMO_SONGS: readonly Song[] = [
  {
    id: 1,
    author: 'The Adaptizers',
    album: 'Motion',
    name: 'Signal in Motion',
    storageLocation: 'mock://catalog/signal-in-motion',
  },
  {
    id: 2,
    author: 'Pulse Assembly',
    album: 'Ten Levels',
    name: 'Orange Horizon',
    storageLocation: 'mock://catalog/orange-horizon',
  },
  {
    id: 3,
    author: 'Dynamic Range',
    album: 'Accelerate',
    name: 'Shake the Room',
    storageLocation: 'mock://catalog/shake-the-room',
  },
];

function App(): React.JSX.Element {
  const player = useMemo(() => createMockAdaptiveAudio(), []);

  return <CatalogScreen songs={DEMO_SONGS} player={player} />;
}

export default App;
