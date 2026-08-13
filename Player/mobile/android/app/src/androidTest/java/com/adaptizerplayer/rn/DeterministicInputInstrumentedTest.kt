package com.adaptizerplayer.rn

import com.adaptizerplayer.adaptiveaudio.adaptizer.Adaptizer
import com.adaptizerplayer.adaptiveaudio.adaptizer.AdaptizerInput
import com.adaptizerplayer.adaptiveaudio.adaptizer.Dimensions
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

/**
 * Deterministic input coverage.
 *
 * Adaptizer exposes the existing AdaptizerInput interface, so this test uses
 * a test-only input implementation rather than physical sensors or hidden
 * production hooks. It records the same resolved values the native module
 * observes before it forwards dimension and track events.
 */
@RunWith(AndroidJUnit4::class)
class DeterministicInputInstrumentedTest {
  @Test
  fun inputChanges_resolveDeterministicDimensionValues() {
    val volume = FakeInput(0)
    val observed = mutableListOf<String>()
    val adaptizer = Adaptizer(volume)
    adaptizer.onReadingsChange {
      observed +=
          "${it.resolve(Dimensions.INTENSITY)}:${it.resolve(Dimensions.VOLUME)}"
    }

    assertEquals(0, adaptizer.resolve(Dimensions.INTENSITY))

    volume.set(8)
    assertEquals(8, adaptizer.resolve(Dimensions.INTENSITY))
    volume.set(3)
    assertEquals(3, adaptizer.resolve(Dimensions.INTENSITY))
    volume.set(0)
    assertEquals(0, adaptizer.resolve(Dimensions.INTENSITY))

    // Volume is the aggregate's only member today, so intensity tracks it
    // exactly - the renormalized one-member case.
    assertEquals(listOf("8:8", "3:3", "0:0"), observed)
  }

  @Test
  fun unavailableInput_holdsItsDimensionAtTheMiddleOfTheRange() {
    val volume = FakeInput(9)
    val adaptizer = Adaptizer(volume)
    adaptizer.onReadingsChange { /* the flip below must notify, as a reading would */ }

    assertEquals(9, adaptizer.resolve(Dimensions.VOLUME))

    volume.setAvailable(false)

    assertEquals(5, adaptizer.resolve(Dimensions.VOLUME))
  }

  private class FakeInput(initialValue: Int) : AdaptizerInput {
    private var value = initialValue
    private var listener: (() -> Unit)? = null

    override var isAvailable: Boolean = true
      private set

    override fun getCurrentValue(): Int = value

    override fun registerChangeListener(listener: () -> Unit) {
      check(this.listener == null) { "test input listener may only be registered once" }
      this.listener = listener
    }

    override fun initialize() = Unit

    override fun release() = Unit

    fun set(nextValue: Int) {
      value = nextValue
      notifyChange()
    }

    fun setAvailable(available: Boolean) {
      isAvailable = available
      notifyChange()
    }

    private fun notifyChange() {
      assertTrue("test input must have a listener before emitting", listener != null)
      listener!!.invoke()
    }
  }
}
