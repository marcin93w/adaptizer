import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { CatalogScreen } from '../CatalogScreen';
import { createMockAdaptiveAudio } from '../../native/mockAdaptiveAudio';
import type { Song } from '../../domain/song';

const SONGS: readonly Song[] = [
  {
    id: 1,
    author: 'The Adaptizers',
    album: 'Motion',
    name: 'Signal in Motion',
    storageLocation: 'mock://signal-in-motion',
  },
  {
    id: 2,
    author: 'Pulse Assembly',
    album: 'Ten Levels',
    name: 'Orange Horizon',
    storageLocation: 'mock://orange-horizon',
  },
];

async function renderScreen(
  songs: readonly Song[] = SONGS,
  catalogLoading = false,
) {
  const player = createMockAdaptiveAudio();
  let renderer: ReturnType<typeof ReactTestRenderer.create>;

  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(
      <CatalogScreen
        catalogLoading={catalogLoading}
        player={player}
        songs={songs}
      />,
    );
  });

  return { player, renderer: renderer! };
}

describe('CatalogScreen', () => {
  it('renders the normal catalog, now-playing row, intensity and transport controls', async () => {
    const { renderer, player } = await renderScreen();

    expect(
      renderer.root.findByProps({ accessibilityLabel: 'Adaptizer Player' }),
    ).toBeDefined();
    expect(
      renderer.root.findByProps({
        accessibilityLabel: 'Signal in Motion by The Adaptizers',
      }),
    ).toBeDefined();
    expect(
      renderer.root.findByProps({ accessibilityLabel: 'Playback intensity' }),
    ).toBeDefined();
    expect(
      renderer.root.findByProps({ accessibilityLabel: 'Seek back 15 seconds' }),
    ).toBeDefined();
    expect(
      renderer.root.findByProps({ accessibilityLabel: 'Play playback' }),
    ).toBeDefined();
    expect(player.prepareCalls).toEqual([
      {
        sourceUri: SONGS[0].storageLocation,
        metadata: {
          id: '1',
          title: SONGS[0].name,
          artist: SONGS[0].author,
        },
      },
    ]);
    expect(player.playCallCount).toBe(0);
  });

  it('selects a song and starts it through the injected mock player', async () => {
    const { renderer, player } = await renderScreen();

    await ReactTestRenderer.act(async () => {
      renderer.root
        .findByProps({
          accessibilityLabel: 'Orange Horizon by Pulse Assembly',
        })
        .props.onPress();
    });

    expect(
      renderer.root.findByProps({
        accessibilityLabel: 'Orange Horizon by Pulse Assembly',
      }).props.accessibilityState,
    ).toEqual({ selected: true });
    expect(player.prepareCalls[player.prepareCalls.length - 1]).toEqual({
      sourceUri: SONGS[1].storageLocation,
      metadata: {
        id: '2',
        title: SONGS[1].name,
        artist: SONGS[1].author,
      },
    });
    expect(
      renderer.root.findByProps({
        accessibilityLabel: 'Player status: Buffering',
      }),
    ).toBeDefined();
    expect(player.playCallCount).toBe(1);
  });

  it('renders loading and empty catalog states without native or network dependencies', async () => {
    const loading = await renderScreen(SONGS, true);
    expect(
      loading.renderer.root.findByProps({
        accessibilityLabel: 'Loading songs',
      }),
    ).toBeDefined();
    expect(loading.player.prepareCalls).toHaveLength(0);

    const empty = await renderScreen([]);
    expect(
      empty.renderer.root.findByProps({
        accessibilityLabel: 'Empty song catalog',
      }),
    ).toBeDefined();
    expect(
      empty.renderer.root.findByProps({ accessibilityLabel: 'Play playback' })
        .props.disabled,
    ).toBe(true);
    expect(empty.player.prepareCalls).toHaveLength(0);
  });

  it('renders player states and errors emitted by the D01 mock', async () => {
    const { renderer, player } = await renderScreen();

    await ReactTestRenderer.act(async () => {
      player.emitPlaybackState({ state: 'playing', sourceId: '1' });
    });
    expect(
      renderer.root.findByProps({
        accessibilityLabel: 'Player status: Playing',
      }),
    ).toBeDefined();
    expect(
      renderer.root.findByProps({ accessibilityLabel: 'Pause playback' }),
    ).toBeDefined();

    await ReactTestRenderer.act(async () => {
      player.emitPlaybackState({ state: 'paused', sourceId: '1' });
    });
    expect(
      renderer.root.findByProps({
        accessibilityLabel: 'Player status: Paused',
      }),
    ).toBeDefined();

    await ReactTestRenderer.act(async () => {
      player.emitPlayerError({
        code: 'network',
        message: 'The catalog stream is unavailable.',
        recoverable: true,
      });
    });
    expect(JSON.stringify(renderer.toJSON())).toContain(
      'The catalog stream is unavailable.',
    );
    expect(
      renderer.root.findByProps({
        accessibilityLabel: 'Player status: Error',
      }),
    ).toBeDefined();
  });
});
