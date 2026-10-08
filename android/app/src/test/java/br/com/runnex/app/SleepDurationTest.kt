package br.com.runnex.app

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class SleepDurationTest {
    @Test fun subtractsKnownAwakeTime() {
        val stages = listOf(SleepDuration.Stage(0, 10000, true), SleepDuration.Stage(10000, 20000, false), SleepDuration.Stage(20000, 30000, true))
        assertEquals(20L, SleepDuration.estimateSeconds(0, 30000, stages))
    }

    @Test fun missingStagesAreNotInterpretedAsSleep() {
        assertNull(SleepDuration.estimateSeconds(0, 30000, emptyList()))
        assertNull(SleepDuration.estimateSeconds(0, 30000, listOf(SleepDuration.Stage(0, 10000, true))))
    }

    @Test fun unknownStagesGapsAndOverlapsAreRejected() {
        assertNull(SleepDuration.estimateSeconds(0, 30000, listOf(SleepDuration.Stage(0, 30000, null))))
        assertNull(SleepDuration.estimateSeconds(0, 30000, listOf(SleepDuration.Stage(0, 10000, true), SleepDuration.Stage(11000, 30000, true))))
        assertNull(SleepDuration.estimateSeconds(0, 30000, listOf(SleepDuration.Stage(0, 20000, true), SleepDuration.Stage(10000, 30000, true))))
    }

    @Test fun zeroSleepIsDifferentFromMissingData() {
        assertEquals(0L, SleepDuration.estimateSeconds(0, 30000, listOf(SleepDuration.Stage(0, 30000, false))))
    }
}
