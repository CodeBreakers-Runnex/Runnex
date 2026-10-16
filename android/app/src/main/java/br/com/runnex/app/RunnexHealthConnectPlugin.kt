package br.com.runnex.app

import android.content.Intent
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.PermissionController
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.DistanceRecord
import androidx.health.connect.client.records.ExerciseSessionRecord
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.time.TimeRangeFilter
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.ActivityCallback
import com.getcapacitor.annotation.CapacitorPlugin
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import org.json.JSONObject
import java.time.Instant

@CapacitorPlugin(name = "RunnexHealthConnect")
class RunnexHealthConnectPlugin : Plugin() {
    private val scope = CoroutineScope(Dispatchers.IO)
    private val required = setOf(HealthPermission.getReadPermission(ExerciseSessionRecord::class), HealthPermission.getReadPermission(DistanceRecord::class))

    private fun client(): HealthConnectClient = HealthConnectClient.getOrCreate(context)

    @PluginMethod
    fun availability(call: PluginCall) {
        val status = HealthConnectClient.getSdkStatus(context)
        val result = JSObject()
        result.put("available", status == HealthConnectClient.SDK_AVAILABLE)
        if (status != HealthConnectClient.SDK_AVAILABLE) {
            result.put("reason", if (status == HealthConnectClient.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED)
                "Instale ou atualize o Health Connect." else "Health Connect indisponível neste dispositivo.")
        }
        call.resolve(result)
    }

    @PluginMethod
    fun openPermissions(call: PluginCall) {
        if (HealthConnectClient.getSdkStatus(context) != HealthConnectClient.SDK_AVAILABLE) {
            call.reject("Health Connect não está disponível.")
            return
        }
        try {
            val intent = PermissionController.createRequestPermissionResultContract().createIntent(context, required)
            startActivityForResult(call, intent, "onPermissionResult")
        } catch (e: Exception) {
            call.reject("Não foi possível abrir o Health Connect.", e)
        }
    }

    @ActivityCallback
    private fun onPermissionResult(call: PluginCall, result: androidx.activity.result.ActivityResult) {
        permissions(call)
    }

    @PluginMethod
    fun permissions(call: PluginCall) {
        scope.launch {
            try {
                val granted = client().permissionController.getGrantedPermissions()
                call.resolve(JSObject().put("granted", granted.containsAll(required)))
            } catch (e: Exception) {
                call.reject("Falha ao consultar permissões.", e)
            }
        }
    }

    @PluginMethod
    fun readRuns(call: PluginCall) {
        val since = call.getString("since")
        if (since.isNullOrBlank()) {
            call.reject("Parâmetro since obrigatório.")
            return
        }
        scope.launch {
            try {
                val start = Instant.parse(since)
                val granted = client().permissionController.getGrantedPermissions()
                if (!granted.containsAll(required)) {
                    call.reject("Autorize leitura de exercícios no Health Connect.")
                    return@launch
                }
                val result = JSArray()
                var pageToken: String? = null
                do {
                    val page = client().readRecords(
                        ReadRecordsRequest(
                            recordType = ExerciseSessionRecord::class,
                            timeRangeFilter = TimeRangeFilter.after(start),
                            pageSize = 100,
                            pageToken = pageToken
                        )
                    )
                    page.records.forEach { record ->
                        // Only running sessions. Match distance records to the same source.
                        if (record.exerciseType == ExerciseSessionRecord.EXERCISE_TYPE_RUNNING) {
                            var meters = 0.0
                            var distancePageToken: String? = null
                            do {
                                val distancePage = client().readRecords(ReadRecordsRequest(
                                    recordType = DistanceRecord::class,
                                    timeRangeFilter = TimeRangeFilter.between(record.startTime, record.endTime),
                                    pageSize = 100,
                                    pageToken = distancePageToken
                                ))
                                meters += distancePage.records.filter {
                                    it.metadata.dataOrigin.packageName == record.metadata.dataOrigin.packageName
                                }.sumOf { it.distance.inMeters }
                                distancePageToken = distancePage.pageToken
                            } while (distancePageToken != null)
                            result.put(JSONObject().apply {
                                put("id", record.metadata.id)
                                put("source", record.metadata.dataOrigin.packageName)
                                put("startedAt", record.startTime.toString())
                                put("endedAt", record.endTime.toString())
                                put("distanceMeters", meters)
                            })
                        }
                    }
                    pageToken = page.pageToken
                } while (pageToken != null)
                call.resolve(JSObject().put("runs", result))
            } catch (e: Exception) {
                call.reject("Falha ao ler corridas do Health Connect.", e)
            }
        }
    }
}
