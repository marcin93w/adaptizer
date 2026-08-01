import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SongsFetchCancelledError, songsApi } from '../data/songsApi';
import { buildDashManifestUrl } from '../data/dashUrl';
import type { Song } from '../domain/song';
import type { SongsRepository } from '../domain/song';
import type { AdaptiveAudioFacade } from '../native/AdaptiveAudio';
import type {
  PlaybackState,
  PlayerErrorEvent,
  ProgressEvent,
} from '../native/types';

const albumArt = require('../assets/album_art.png');
const titleLogo = require('../assets/logo_title.png');

const SEEK_STEP_MS = 15_000;

export interface CatalogScreenProps {
  readonly player: AdaptiveAudioFacade;
  /** Defaults to the live HTTP repository; tests inject a deterministic fake. */
  readonly repository?: SongsRepository;
}

export function CatalogScreen({
  player,
  repository = songsApi,
}: CatalogScreenProps): React.JSX.Element {
  const [songs, setSongs] = useState<readonly Song[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState<unknown>(null);
  const [selectedSongId, setSelectedSongId] = useState<number | null>(null);
  const [playbackState, setPlaybackState] = useState<PlaybackState>('idle');
  const [progress, setProgress] = useState<ProgressEvent>({
    positionMs: 0,
    durationMs: -1,
    bufferedMs: 0,
  });
  const [intensity, setIntensity] = useState(0);
  const [error, setError] = useState<PlayerErrorEvent | null>(null);
  const requestId = useRef(0);
  const abortController = useRef<AbortController | null>(null);
  const playAfterPrepare = useRef(false);

  const loadSongs = useCallback(() => {
    const currentRequestId = ++requestId.current;
    abortController.current?.abort();

    const controller = new AbortController();
    abortController.current = controller;
    setCatalogLoading(true);
    setCatalogError(null);

    repository
      .fetchSongs(controller.signal)
      .then(nextSongs => {
        if (currentRequestId !== requestId.current) {
          return;
        }
        setSongs(nextSongs);
        setCatalogLoading(false);
      })
      .catch(fetchError => {
        if (
          currentRequestId !== requestId.current ||
          controller.signal.aborted ||
          fetchError instanceof SongsFetchCancelledError
        ) {
          return;
        }
        setSongs([]);
        setCatalogError(fetchError);
        setCatalogLoading(false);
      })
      .finally(() => {
        if (currentRequestId === requestId.current) {
          abortController.current = null;
        }
      });
  }, [repository]);

  useEffect(() => {
    loadSongs();
    return () => {
      requestId.current += 1;
      abortController.current?.abort();
      abortController.current = null;
    };
  }, [loadSongs]);

  useEffect(() => {
    setSelectedSongId(currentSelectedSongId => {
      if (
        currentSelectedSongId !== null &&
        songs.some(song => song.id === currentSelectedSongId)
      ) {
        return currentSelectedSongId;
      }
      return songs.length > 0 ? songs[0].id : null;
    });
  }, [songs]);

  const selectedSong = useMemo(
    () =>
      songs.find(song => song.id === selectedSongId) ??
      (songs.length > 0 ? songs[0] : null),
    [selectedSongId, songs],
  );

  useEffect(() => {
    if (!player.isAvailable) {
      setError({
        code: 'not_initialized',
        message: 'The audio player is unavailable.',
        recoverable: false,
      });
      return;
    }

    const subscriptions = [
      player.addPlaybackStateListener(event => {
        setPlaybackState(event.state);
        setError(null);
      }),
      player.addProgressListener(setProgress),
      player.addIntensityChangedListener(event => {
        setIntensity(Math.max(0, Math.min(9, event.intensity)));
      }),
      player.addPlayerErrorListener(setError),
    ];

    return () => subscriptions.forEach(subscription => subscription.remove());
  }, [player]);

  useEffect(() => {
    if (
      catalogLoading ||
      catalogError !== null ||
      !selectedSong ||
      !player.isAvailable
    ) {
      return;
    }
    const shouldStartPlayback = playAfterPrepare.current;
    playAfterPrepare.current = false;

    player.prepare(
      buildDashManifestUrl(selectedSong.storageLocation),
      metadataFor(selectedSong),
    );

    // The first song is prepared but not started. Selecting another song is an
    // explicit play action, so refreshes do not unexpectedly start playback.
    if (shouldStartPlayback) {
      player.play();
    }
  }, [catalogError, catalogLoading, player, selectedSong]);

  const selectSong = useCallback((song: Song) => {
    setError(null);
    setPlaybackState('buffering');
    playAfterPrepare.current = true;
    setSelectedSongId(song.id);
  }, []);

  const togglePlayback = useCallback(() => {
    setError(null);
    if (playbackState === 'playing') {
      player.pause();
    } else {
      player.play();
    }
  }, [playbackState, player]);

  const seekBy = useCallback(
    (deltaMs: number) => {
      const lastPosition =
        progress.durationMs >= 0 ? progress.durationMs : Infinity;
      player.seekTo(
        Math.max(0, Math.min(lastPosition, progress.positionMs + deltaMs)),
      );
    },
    [player, progress.durationMs, progress.positionMs],
  );

  const controlsDisabled = catalogLoading || selectedSong == null;
  const status = playbackStatus(playbackState, error);

  return (
    <SafeAreaView accessibilityLabel="Adaptizer Player" style={styles.screen}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />
      <View style={styles.header}>
        <Image
          accessibilityLabel="Adaptizer Player"
          resizeMode="contain"
          source={titleLogo}
          style={styles.logo}
        />
        <Text style={styles.tagline}>MUSIC THAT MOVES WITH YOU</Text>
      </View>

      <View style={styles.catalog}>
        <View style={styles.catalogHeading}>
          <Text accessibilityRole="header" style={styles.sectionTitle}>
            SONGS
          </Text>
          <Pressable
            accessibilityLabel="Refresh songs"
            accessibilityRole="button"
            disabled={catalogLoading}
            onPress={loadSongs}
            style={({ pressed }) => [
              styles.refreshButton,
              pressed ? styles.pressed : null,
              catalogLoading ? styles.disabled : null,
            ]}
          >
            <Text style={styles.refreshButtonText}>
              {catalogLoading ? 'Refreshing' : 'Refresh'}
            </Text>
          </Pressable>
        </View>
        <CatalogBody
          error={catalogError}
          loading={catalogLoading}
          songs={songs}
          selectedSongId={selectedSong?.id ?? null}
          onRetry={loadSongs}
          onSelect={selectSong}
        />
      </View>

      <View style={styles.tip}>
        <Text style={styles.tipText}>
          Change volume or shake your phone to increase intensity.
        </Text>
      </View>

      <View accessibilityLabel="Player controls" style={styles.playerPanel}>
        <View style={styles.nowPlayingRow}>
          <Image
            accessibilityLabel={
              selectedSong
                ? `Album artwork for ${selectedSong.name}`
                : 'Album artwork placeholder'
            }
            source={albumArt}
            style={styles.nowPlayingArt}
          />
          <View style={styles.nowPlayingCopy}>
            <Text style={styles.eyebrow}>NOW PLAYING</Text>
            <Text numberOfLines={1} style={styles.nowPlayingTitle}>
              {selectedSong?.name ?? 'Choose a song'}
            </Text>
            <Text numberOfLines={1} style={styles.nowPlayingArtist}>
              {selectedSong?.author ?? 'Your selection will appear here'}
            </Text>
          </View>
          <View
            accessibilityLabel={`Player status: ${status.label}`}
            style={[styles.statusPill, error ? styles.errorPill : null]}
          >
            <Text style={[styles.statusText, error ? styles.errorText : null]}>
              {status.label}
            </Text>
          </View>
        </View>

        {error ? (
          <Text accessibilityRole="alert" style={styles.errorMessage}>
            {error.message}
          </Text>
        ) : null}

        <IntensityMeter value={intensity} />

        <View style={styles.transport}>
          <TransportButton
            accessibilityLabel="Seek back 15 seconds"
            disabled={controlsDisabled}
            label="−15"
            onPress={() => seekBy(-SEEK_STEP_MS)}
          />
          <Pressable
            accessibilityLabel={
              playbackState === 'playing' ? 'Pause playback' : 'Play playback'
            }
            accessibilityRole="button"
            disabled={controlsDisabled}
            onPress={togglePlayback}
            style={({ pressed }) => [
              styles.primaryControl,
              pressed ? styles.pressed : null,
              controlsDisabled ? styles.disabled : null,
            ]}
          >
            <Text style={styles.primaryControlText}>
              {playbackState === 'playing' ? 'Ⅱ' : '▶'}
            </Text>
          </Pressable>
          <TransportButton
            accessibilityLabel="Seek forward 15 seconds"
            disabled={controlsDisabled}
            label="+15"
            onPress={() => seekBy(SEEK_STEP_MS)}
          />
        </View>
        <Text accessibilityLabel="Playback position" style={styles.timeText}>
          {formatTime(progress.positionMs)} / {formatTime(progress.durationMs)}
        </Text>
      </View>
    </SafeAreaView>
  );
}

function CatalogBody({
  error,
  loading,
  songs,
  selectedSongId,
  onRetry,
  onSelect,
}: {
  error: unknown;
  loading: boolean;
  songs: readonly Song[];
  selectedSongId: number | null;
  onRetry: () => void;
  onSelect: (song: Song) => void;
}): React.JSX.Element {
  if (loading) {
    return (
      <View accessibilityLabel="Loading songs" style={styles.centerMessage}>
        <ActivityIndicator color={colors.accent} size="large" />
        <Text style={styles.centerMessageTitle}>Loading songs…</Text>
        <Text style={styles.centerMessageBody}>
          Tuning the catalog for you.
        </Text>
      </View>
    );
  }

  if (error !== null) {
    return (
      <View
        accessibilityLabel="Song catalog error"
        style={styles.centerMessage}
      >
        <Text style={styles.centerMessageTitle}>Could not load songs</Text>
        <Text style={styles.centerMessageBody}>
          {catalogErrorMessage(error)}
        </Text>
        <Pressable
          accessibilityLabel="Retry loading songs"
          accessibilityRole="button"
          onPress={onRetry}
          style={({ pressed }) => [
            styles.retryButton,
            pressed ? styles.pressed : null,
          ]}
        >
          <Text style={styles.retryButtonText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  if (songs.length === 0) {
    return (
      <View
        accessibilityLabel="Empty song catalog"
        style={styles.centerMessage}
      >
        <Text style={styles.emptyGlyph}>♪</Text>
        <Text style={styles.centerMessageTitle}>No songs yet</Text>
        <Text style={styles.centerMessageBody}>
          Check back when the next set drops.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.songList}>
      {songs.map(song => {
        const selected = song.id === selectedSongId;
        return (
          <Pressable
            accessibilityLabel={`${song.name} by ${song.author}`}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            key={song.id}
            onPress={() => onSelect(song)}
            style={({ pressed }) => [
              styles.songRow,
              selected ? styles.selectedSongRow : null,
              pressed ? styles.pressed : null,
            ]}
          >
            <Image
              accessibilityIgnoresInvertColors
              accessibilityLabel={`Album artwork for ${song.name}`}
              source={albumArt}
              style={styles.songArt}
            />
            <View style={styles.songCopy}>
              <Text numberOfLines={1} style={styles.songTitle}>
                {song.name}
              </Text>
              <Text numberOfLines={1} style={styles.songArtist}>
                {song.author} · {song.album}
              </Text>
            </View>
            <Text accessibilityElementsHidden style={styles.songChevron}>
              ›
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function IntensityMeter({ value }: { value: number }): React.JSX.Element {
  const percentage = `${(Math.max(0, Math.min(9, value)) / 9) * 100}%` as const;
  return (
    <View style={styles.intensityRow}>
      <View style={styles.intensityLabelRow}>
        <Text style={styles.intensityLabel}>INTENSITY</Text>
        <Text style={styles.intensityValue}>{value}/9</Text>
      </View>
      <View
        accessibilityLabel="Playback intensity"
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 0, max: 9, now: value }}
        style={styles.intensityTrack}
      >
        <View style={[styles.intensityFill, { width: percentage }]} />
      </View>
    </View>
  );
}

function TransportButton({
  accessibilityLabel,
  disabled,
  label,
  onPress,
}: {
  accessibilityLabel: string;
  disabled: boolean;
  label: string;
  onPress: () => void;
}): React.JSX.Element {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.secondaryControl,
        pressed ? styles.pressed : null,
        disabled ? styles.disabled : null,
      ]}
    >
      <Text style={styles.secondaryControlText}>{label}</Text>
    </Pressable>
  );
}

function metadataFor(song: Song) {
  return { id: String(song.id), title: song.name, artist: song.author };
}

function catalogErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.length > 0) {
    return error.message;
  }
  return 'The catalog is unavailable right now. Try again.';
}

function playbackStatus(
  playbackState: PlaybackState,
  error: PlayerErrorEvent | null,
): { label: string } {
  if (error) {
    return { label: 'Error' };
  }
  const labels: Record<PlaybackState, string> = {
    idle: 'Loading',
    buffering: 'Buffering',
    ready: 'Ready',
    playing: 'Playing',
    paused: 'Paused',
    ended: 'Finished',
  };
  return { label: labels[playbackState] };
}

function formatTime(timeMs: number): string {
  if (timeMs < 0 || !Number.isFinite(timeMs)) {
    return '–:––';
  }
  const totalSeconds = Math.floor(timeMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  return `${minutes}:${String(totalSeconds % 60).padStart(2, '0')}`;
}

const colors = {
  background: '#12100F',
  surface: '#211E1C',
  elevated: '#2B2725',
  line: '#423B37',
  accent: '#FF5722',
  accentSoft: '#3C241C',
  text: '#FFF9F5',
  muted: '#B9AEA8',
  error: '#FFB4AB',
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 14 },
  logo: { width: 232, height: 34 },
  tagline: {
    marginTop: 5,
    color: colors.muted,
    fontSize: 10,
    letterSpacing: 2.1,
  },
  catalog: {
    flex: 1,
    minHeight: 180,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderColor: colors.line,
  },
  catalogHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingRight: 14,
  },
  sectionTitle: {
    paddingHorizontal: 20,
    paddingTop: 15,
    paddingBottom: 8,
    color: colors.muted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
  },
  refreshButton: {
    borderRadius: 15,
    paddingHorizontal: 11,
    paddingVertical: 6,
    backgroundColor: colors.elevated,
  },
  refreshButtonText: {
    color: colors.accent,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  songList: { paddingHorizontal: 12, paddingBottom: 12 },
  songRow: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  selectedSongRow: {
    backgroundColor: colors.accentSoft,
    borderColor: '#75402D',
  },
  songArt: {
    width: 52,
    height: 52,
    borderRadius: 5,
    backgroundColor: '#FFFFFF',
  },
  songCopy: { flex: 1, marginHorizontal: 14 },
  songTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
  songArtist: { marginTop: 4, color: colors.muted, fontSize: 13 },
  songChevron: { color: colors.accent, fontSize: 28, paddingHorizontal: 4 },
  centerMessage: {
    flex: 1,
    minHeight: 190,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  centerMessageTitle: {
    marginTop: 12,
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  centerMessageBody: {
    marginTop: 5,
    color: colors.muted,
    fontSize: 13,
    textAlign: 'center',
  },
  emptyGlyph: { color: colors.accent, fontSize: 38 },
  retryButton: {
    marginTop: 16,
    borderRadius: 18,
    backgroundColor: colors.accent,
    paddingHorizontal: 18,
    paddingVertical: 9,
  },
  retryButtonText: {
    color: '#1A0E09',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  tip: {
    backgroundColor: '#37312E',
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  tipText: { color: colors.muted, fontSize: 11, fontStyle: 'italic' },
  playerPanel: {
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 16,
  },
  nowPlayingRow: { flexDirection: 'row', alignItems: 'center' },
  nowPlayingArt: {
    width: 52,
    height: 52,
    borderRadius: 5,
    backgroundColor: '#FFFFFF',
  },
  nowPlayingCopy: { flex: 1, marginHorizontal: 12 },
  eyebrow: {
    color: colors.accent,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  nowPlayingTitle: {
    marginTop: 3,
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  nowPlayingArtist: { marginTop: 2, color: colors.muted, fontSize: 12 },
  statusPill: {
    minWidth: 62,
    borderRadius: 12,
    backgroundColor: colors.elevated,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  statusText: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  errorPill: { backgroundColor: '#4A1E1D' },
  errorText: { color: colors.error },
  errorMessage: {
    marginTop: 10,
    borderLeftWidth: 2,
    borderLeftColor: colors.error,
    paddingLeft: 9,
    color: colors.error,
    fontSize: 12,
  },
  intensityRow: { marginTop: 14 },
  intensityLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  intensityLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  intensityValue: { color: colors.accent, fontSize: 10, fontWeight: '800' },
  intensityTrack: {
    height: 9,
    overflow: 'hidden',
    borderRadius: 5,
    backgroundColor: colors.elevated,
  },
  intensityFill: {
    height: '100%',
    borderRadius: 5,
    backgroundColor: colors.accent,
  },
  transport: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    columnGap: 24,
  },
  primaryControl: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 26,
    backgroundColor: colors.accent,
  },
  primaryControlText: { color: '#1A0E09', fontSize: 22, fontWeight: '900' },
  secondaryControl: {
    minWidth: 48,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
    backgroundColor: colors.elevated,
  },
  secondaryControlText: { color: colors.text, fontSize: 13, fontWeight: '800' },
  timeText: {
    marginTop: 2,
    color: colors.muted,
    fontSize: 10,
    textAlign: 'center',
  },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.35 },
});
