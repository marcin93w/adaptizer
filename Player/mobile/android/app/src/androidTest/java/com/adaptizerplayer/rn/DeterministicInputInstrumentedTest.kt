package com.adaptizerplayer.rn

import com.adaptizerplayer.adaptiveaudio.adaptizer.Adaptizer
import com.adaptizerplayer.adaptiveaudio.adaptizer.AdaptizerInput
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

/**
 * Deterministic debug-input coverage.
 *
 * Adaptizer exposes the existing AdaptizerInput interface, so this test uses
 * a test-only input implementation rather than physical sensors or hidden
 * production hooks. It records the same state/debug output that the native
 * module observes before it forwards intensity and track events.
 */
@RunWith(AndroidJUnit4::class)
class DeterministicInputInstrumentedTest {
  @Test
  fun inputChanges_emitDeterministicIntensityAndDebugOutput() {
    val volume = FakeInput(0)
    val acceleration = FakeInput(0)
    val observed = mutableListOf<String>()
    val adaptizer = Adaptizer(volume, acceleration)
    adaptizer.onStateChange {
      observed +=
          "${it.intensity}:${it.volume}:${it.acceleration}"
    }

    assertEquals("Intensity: 0 (Vol: 0, Acc: 0)", adaptizer.getDebugOutput())

    volume.set(8)
    assertEquals("Intensity: 6 (Vol: 8, Acc: 0)", adaptizer.getDebugOutput())
    acceleration.set(8)
    assertEquals("Intensity: 8 (Vol: 8, Acc: 8)", adaptizer.getDebugOutput())
    volume.set(0)
    assertEquals("Intensity: 2 (Vol: 0, Acc: 8)", adaptizer.getDebugOutput())

    assertEquals(listOf("6:8:0", "8:8:8", "2:0:8"), observed)
  }

  private class FakeInput(initialValue: Int) : AdaptizerInput {
    private var value = initialValue
    private var listener: (() -> Unit)? = null

    override fun getCurrentValue(): Int = value

    override fun registerChangeListener(listener: () -> Unit) {
      check(this.listener == null) { "test input listener may only be registered once" }
      this.listener = listener
    }

    override fun initialize() = Unit

    override fun release() = Unit

    fun set(nextValue: Int) {
      value = nextValue
      assertTrue("test input must have a listener before emitting", listener != null)
      listener!!.invoke()
    }
  }
}
