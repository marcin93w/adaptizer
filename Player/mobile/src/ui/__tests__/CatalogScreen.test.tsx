import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { buildDashManifestUrl } from '../../data/dashUrl';
import type { SongsRepository } from '../../domain/song';
import type { Song } from '../../domain/song';
import { createMockAdaptiveAudio } from '../../native/mockAdaptiveAudio';
import { CatalogScreen } from '../CatalogScreen';

const SONGS: readonly Song[] = [
  {
    id: 1,
    author: 'The Adaptizers',
    album: 'Motion',
    name: 'Signal in Motion',
    storageLocation: 'songs/signal-in-motion',
  },
  {
    id: 2,
    author: 'Pulse Assembly',
    album: 'Ten Levels',
    name: 'Orange Horizon',
    storageLocation: 'songs/orange-horizon',
  },
];

function createRepository(
  ...results: Array<readonly Song[] | Error>
): SongsRepository & { fetchSongs: jest.Mock } {
  const fetchSongs = jest.fn();
  for (const result of results) {
    if (result instanceof Error) {
      fetchSongs.mockRejectedValueOnce(result);
    } else {
      fetchSongs.mockResolvedValueOnce(result);
    }
  }
  return { fetchSongs } as SongsRepository & { fetchSongs: jest.Mock };
}

async function renderScreen(repository: SongsRepository) {
  const player = createMockAdaptiveAudio();
  let renderer: ReactTestRenderer.ReactTestRenderer;

  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(
      <CatalogScreen player={player} repository={repository} />,
    );
  });

  return { player, renderer: renderer! };
}

describe('CatalogScreen', () => {
  it('loads the repository, renders the catalog, and prepares the first song', async () => {
    const repository = createRepository(SONGS);
    const { renderer, player } = await renderScreen(repository);

    expect(
      renderer.root.findByProps({
        accessibilityLabel: 'Signal in Motion by The Adaptizers',
      }),
    ).toBeDefined();
    expect(
      renderer.root.findByProps({ accessibilityLabel: 'Refresh songs' }),
    ).toBeDefined();
    expect(player.prepareCalls).toEqual([
      {
        sourceUri: buildDashManifestUrl(SONGS[0].storageLocation),
        metadata: {
          id: '1',
          title: SONGS[0].name,
          artist: SONGS[0].author,
        },
      },
    ]);
    expect(player.playCallCount).toBe(0);
    expect(repository.fetchSongs).toHaveBeenCalledWith(expect.any(AbortSignal));
  });

  it('selects a song and starts it through the injected mock player', async () => {
    const repository = createRepository(SONGS);
    const { renderer, player } = await renderScreen(repository);

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
      sourceUri: buildDashManifestUrl(SONGS[1].storageLocation),
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

  it('renders loading and empty catalog states without preparing a player', async () => {
    let resolveSongs!: (songs: Song[]) => void;
    const pendingRepository = {
      fetchSongs: jest.fn(
        () =>
          new Promise<Song[]>(resolve => {
            resolveSongs = resolve;
          }),
      ),
    } as unknown as SongsRepository;
    const player = createMockAdaptiveAudio();
    let renderer: ReactTestRenderer.ReactTestRenderer;

    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(
        <CatalogScreen player={player} repository={pendingRepository} />,
      );
    });
    expect(
      renderer!.root.findByProps({ accessibilityLabel: 'Loading songs' }),
    ).toBeDefined();
    expect(player.prepareCalls).toHaveLength(0);

    await ReactTestRenderer.act(async () => {
      resolveSongs!([]);
    });
    expect(
      renderer!.root.findByProps({ accessibilityLabel: 'Empty song catalog' }),
    ).toBeDefined();
    expect(
      renderer!.root.findByProps({ accessibilityLabel: 'Play playback' }).props
        .disabled,
    ).toBe(true);
    expect(player.prepareCalls).toHaveLength(0);
  });

  it('shows an error and retries the repository request', async () => {
    const repository = createRepository(
      new Error('The catalog service is unavailable.'),
      SONGS,
    );
    const { renderer, player } = await renderScreen(repository);

    expect(
      renderer.root.findByProps({ accessibilityLabel: 'Song catalog error' }),
    ).toBeDefined();
    expect(JSON.stringify(renderer.toJSON())).toContain(
      'The catalog service is unavailable.',
    );

    await ReactTestRenderer.act(async () => {
      renderer.root
        .findByProps({ accessibilityLabel: 'Retry loading songs' })
        .props.onPress();
    });

    expect(
      renderer.root.findByProps({
        accessibilityLabel: 'Signal in Motion by The Adaptizers',
      }),
    ).toBeDefined();
    expect(repository.fetchSongs).toHaveBeenCalledTimes(2);
    expect(player.prepareCalls).toHaveLength(1);
  });

  it('refreshes a successful catalog without starting playback unexpectedly', async () => {
    const repository = createRepository(SONGS, [SONGS[1]]);
    const { renderer, player } = await renderScreen(repository);

    await ReactTestRenderer.act(async () => {
      renderer.root
        .findByProps({ accessibilityLabel: 'Refresh songs' })
        .props.onPress();
    });

    expect(repository.fetchSongs).toHaveBeenCalledTimes(2);
    expect(player.prepareCalls).toHaveLength(2);
    expect(player.playCallCount).toBe(0);
  });

  it('renders player states and errors emitted by the injected mock', async () => {
    const repository = createRepository(SONGS);
    const { renderer, player } = await renderScreen(repository);

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
      renderer.root.findByProps({ accessibilityLabel: 'Player status: Error' }),
    ).toBeDefined();
  });
});
