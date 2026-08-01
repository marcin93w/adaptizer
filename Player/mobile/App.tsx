/**
 * Adaptizer Player - React Native shell
 *
 * A01: static placeholder screen only. Displays the app title and build
 * metadata so the scaffold can be verified end to end. Real UI arrives
 * in C02 - no player, sensor, networking or navigation code belongs here.
 *
 * @format
 */

import React from 'react';
import { StatusBar, StyleSheet, Text, useColorScheme, View } from 'react-native';

// Keep in sync with mobile/android/app/build.gradle (applicationId / namespace).
// This is a temporary debug-only application ID so the RN shell can be
// installed side by side with the legacy com.adaptizerplayer app.
const APPLICATION_ID = 'com.adaptizerplayer.rn';

const reactNativeVersion = require('react-native/package.json').version as string;
const appVersion = (require('./package.json').version as string) ?? 'unknown';
const buildType = __DEV__ ? 'debug' : 'release';

function App(): React.JSX.Element {
  const isDarkMode = useColorScheme() === 'dark';

  return (
    <View style={[styles.container, isDarkMode ? styles.dark : styles.light]}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <View style={styles.content}>
        <Text style={[styles.title, isDarkMode ? styles.textDark : styles.textLight]}>
          Adaptizer Player
        </Text>
        <View style={styles.metadata}>
          <MetadataRow label="React Native" value={reactNativeVersion} dark={isDarkMode} />
          <MetadataRow label="App version" value={appVersion} dark={isDarkMode} />
          <MetadataRow label="Build type" value={buildType} dark={isDarkMode} />
          <MetadataRow label="Application ID" value={APPLICATION_ID} dark={isDarkMode} />
        </View>
      </View>
    </View>
  );
}

function MetadataRow({
  label,
  value,
  dark,
}: {
  label: string;
  value: string;
  dark: boolean;
}): React.JSX.Element {
  return (
    <View style={styles.row}>
      <Text style={[styles.label, dark ? styles.textDark : styles.textLight]}>{label}</Text>
      <Text style={[styles.value, dark ? styles.textDark : styles.textLight]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  light: {
    backgroundColor: '#ffffff',
  },
  dark: {
    backgroundColor: '#121212',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 32,
  },
  metadata: {
    alignSelf: 'stretch',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  label: {
    fontSize: 14,
    opacity: 0.7,
  },
  value: {
    fontSize: 14,
    fontWeight: '600',
  },
  textLight: {
    color: '#111111',
  },
  textDark: {
    color: '#f2f2f2',
  },
});

export default App;
