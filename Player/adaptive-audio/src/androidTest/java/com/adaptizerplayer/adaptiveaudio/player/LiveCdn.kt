package com.adaptizerplayer.adaptiveaudio.player

/**
 * Marks a characterization test that hits the real production CDN
 * (`https://pub-fb297744d1fd4584a256f702d29363a8.r2.dev/Sample/manifest.mpd`) instead of the
 * offline `test-media/` fixture. Purely documentation/discoverability - the actual exclusion from
 * ordinary `connectedAndroidTest` runs is enforced by [LiveCdnSmokeTest]'s `Assume` gate on the
 * `runLiveCdnTests` instrumentation-runner argument (see that file for how to opt in), because a
 * JUnit4 annotation alone cannot skip a test without a runner/rule that understands it.
 */
@Retention(AnnotationRetention.RUNTIME)
@Target(AnnotationTarget.FUNCTION)
annotation class LiveCdn
