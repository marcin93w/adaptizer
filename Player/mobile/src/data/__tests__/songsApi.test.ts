import { config } from '../../config';
import {
  HttpSongsRepository,
  SongsApiError,
  SongsFetchCancelledError,
} from '../songsApi';

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

function malformedJsonResponse(status: number): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.reject(new SyntaxError('Unexpected token')),
  } as unknown as Response;
}

describe('HttpSongsRepository.fetchSongs', () => {
  let mockFetch: jest.Mock;

  beforeEach(() => {
    mockFetch = jest.fn();
    (globalThis as { fetch: typeof fetch }).fetch =
      mockFetch as unknown as typeof fetch;
  });

  it('resolves with the mapped songs on a successful multi-song response', async () => {
    const wirePayload = [
      {
        id: 1,
        author: 'Author One',
        album: 'Album One',
        name: 'Song One',
        storage_location: 'songs/one',
      },
      {
        id: 2,
        author: 'Author Two',
        album: 'Album Two',
        name: 'Song Two',
        storage_location: 'songs/two',
      },
    ];
    mockFetch.mockResolvedValueOnce(jsonResponse(200, wirePayload));

    const repository = new HttpSongsRepository();
    const songs = await repository.fetchSongs();

    expect(songs).toEqual([
      {
        id: 1,
        author: 'Author One',
        album: 'Album One',
        name: 'Song One',
        storageLocation: 'songs/one',
      },
      {
        id: 2,
        author: 'Author Two',
        album: 'Album Two',
        name: 'Song Two',
        storageLocation: 'songs/two',
      },
    ]);
    // Confirm the snake_case wire field never leaks into the domain object.
    expect(songs[0]).not.toHaveProperty('storage_location');
  });

  it('resolves with an empty array for an empty catalog, and this is not an error', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(200, []));

    const repository = new HttpSongsRepository();
    const result = await repository.fetchSongs();

    expect(result).toEqual([]);
    expect(Array.isArray(result)).toBe(true);
  });

  it('rejects with a typed network error carrying the status on a server failure', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(500, {}));

    const repository = new HttpSongsRepository();
    const promise = repository.fetchSongs();

    await expect(promise).rejects.toBeInstanceOf(SongsApiError);
    await expect(promise).rejects.toMatchObject({
      code: 'network',
      status: 500,
    });
    // Must not be silently swallowed into an empty catalog (the legacy defect):
    // a rejected promise can never also resolve, so the assertions above
    // already guarantee this never becomes `[]`. Assert it explicitly too.
    let resolvedValue: unknown = 'not-called';
    try {
      resolvedValue = await promise;
    } catch {
      // expected
    }
    expect(resolvedValue).not.toEqual([]);
  });

  it('rejects with a typed error on malformed JSON', async () => {
    mockFetch.mockResolvedValueOnce(malformedJsonResponse(200));

    const repository = new HttpSongsRepository();

    await expect(repository.fetchSongs()).rejects.toMatchObject({
      code: 'unknown',
    });
  });

  it('rejects with a typed error when the body is a JSON object instead of an array', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(200, { not: 'an array' }));

    const repository = new HttpSongsRepository();

    await expect(repository.fetchSongs()).rejects.toMatchObject({
      code: 'unknown',
    });
  });

  it('rejects with a typed error when an item is missing storage_location', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse(200, [
        {
          id: 1,
          author: 'Author',
          album: 'Album',
          name: 'Name',
          // storage_location intentionally omitted
        },
      ]),
    );

    const repository = new HttpSongsRepository();

    await expect(repository.fetchSongs()).rejects.toMatchObject({
      code: 'unknown',
      name: 'SongsApiError',
    });
  });

  it('rejects with a distinct cancellation error when the signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();

    const repository = new HttpSongsRepository();

    await expect(
      repository.fetchSongs(controller.signal),
    ).rejects.toBeInstanceOf(SongsFetchCancelledError);
    // fetch should not even be attempted once already aborted.
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('rejects with a distinct cancellation error when fetch itself aborts mid-flight', async () => {
    const abortError = Object.assign(new Error('The operation was aborted'), {
      name: 'AbortError',
    });
    mockFetch.mockRejectedValueOnce(abortError);

    const controller = new AbortController();
    const repository = new HttpSongsRepository();

    await expect(
      repository.fetchSongs(controller.signal),
    ).rejects.toBeInstanceOf(SongsFetchCancelledError);
  });

  it('does not resolve a cancellation to an empty array', async () => {
    const controller = new AbortController();
    controller.abort();

    const repository = new HttpSongsRepository();
    const result = repository.fetchSongs(controller.signal);

    await expect(result).rejects.toBeInstanceOf(SongsFetchCancelledError);
  });

  it('uses the base URL from config rather than a hard-coded literal', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(200, []));

    const repository = new HttpSongsRepository();
    await repository.fetchSongs();

    expect(mockFetch).toHaveBeenCalledWith(
      `${config.songsApiBaseUrl}/`,
      expect.anything(),
    );
  });

  it('allows a custom base URL to be injected, proving the URL is not hard-coded in the implementation', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(200, []));

    const customBaseUrl = 'https://example.test';
    const repository = new HttpSongsRepository(customBaseUrl);
    await repository.fetchSongs();

    expect(mockFetch).toHaveBeenCalledWith(
      `${customBaseUrl}/`,
      expect.anything(),
    );
  });
});
