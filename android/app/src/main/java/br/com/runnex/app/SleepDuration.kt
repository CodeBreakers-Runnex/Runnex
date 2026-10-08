package br.com.runnex.app

/** Retorna estimativa apenas quando os estágios cobrem todo o período. */
object SleepDuration {
    data class Stage(val startMillis: Long, val endMillis: Long, val sleeping: Boolean?)

    fun estimateSeconds(startMillis: Long, endMillis: Long, stages: List<Stage>): Long? {
        if (endMillis <= startMillis || stages.isEmpty()) return null
        var cursor = startMillis
        var sleepingMillis = 0L
        for (stage in stages.sortedBy { it.startMillis }) {
            if (stage.sleeping == null || stage.startMillis != cursor || stage.endMillis <= stage.startMillis || stage.endMillis > endMillis) return null
            if (stage.sleeping) sleepingMillis += stage.endMillis - stage.startMillis
            cursor = stage.endMillis
        }
        return if (cursor == endMillis) sleepingMillis / 1000 else null
    }
}
