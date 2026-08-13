/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import App from '../App';
import type { Song } from '../src/domain/song';
import { createMockAdaptiveAudio } from '../src/native/mockAdaptiveAudio';

const SONGS: readonly Song[] = [
  {
    id: 1,
    author: 'The Adaptizers',
    album: 'Motion',
    name: 'Signal in Motion',
    storageLocation: 'songs/signal-in-motion',
    dimension: 'movementSpeed',
  },
];

test('renders with injected repository and player boundaries', async () => {
  const player = createMockAdaptiveAudio();
  const repository = { fetchSongs: jest.fn().mockResolvedValue(SONGS) };

  await ReactTestRenderer.act(async () => {
    ReactTestRenderer.create(<App player={player} repository={repository} />);
    await Promise.resolve();
  });

  expect(repository.fetchSongs).toHaveBeenCalledTimes(1);
});
