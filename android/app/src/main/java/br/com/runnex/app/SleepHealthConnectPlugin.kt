package br.com.runnex.app

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import androidx.activity.result.ActivityResult
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.PermissionController
import androidx.health.connect.client.changes.DeletionChange
import androidx.health.connect.client.changes.UpsertionChange
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.SleepSessionRecord
import androidx.health.connect.client.request.ChangesTokenRequest
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
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import java.time.Duration
import java.time.Instant

@CapacitorPlugin(name = "SleepHealthConnect")
class SleepHealthConnectPlugin : Plugin() {
    private val jobs = CoroutineScope(SupervisorJob() + Dispatchers.Main)
    private val mutex = Mutex()
    private val pending = mutableMapOf<String, String>()
    private val readPermission get() = HealthPermission.getReadPermission(SleepSessionRecord::class)
    private val permissions get() = setOf(readPermission)
    private val tokens get() = context.getSharedPreferences("runnex_sleep_tokens", Context.MODE_PRIVATE)

    private fun availability(): Int = if (Build.VERSION.SDK_INT < 28) HealthConnectClient.SDK_UNAVAILABLE else HealthConnectClient.getSdkStatus(context)
    private fun client(): HealthConnectClient {
        check(availability() == HealthConnectClient.SDK_AVAILABLE)
        return HealthConnectClient.getOrCreate(context)
    }

    private suspend fun status(): JSObject {
        val value = availability()
        return JSObject().apply {
            put("status", when (value) {
                HealthConnectClient.SDK_AVAILABLE -> "available"
                HealthConnectClient.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED -> "update_required"
                else -> "unavailable"
            })
            put("granted", value == HealthConnectClient.SDK_AVAILABLE && client().permissionController.getGrantedPermissions().contains(readPermission))
        }
    }

    @PluginMethod
    fun getStatus(call: PluginCall) {
        jobs.launch {
            try { call.resolve(status()) } catch (_: Exception) { call.reject("Não foi possível verificar o Health Connect.", "HEALTH_STATUS") }
        }
    }

    @PluginMethod
    fun requestSleepPermission(call: PluginCall) {
        if (availability() != HealthConnectClient.SDK_AVAILABLE) {
            call.reject("Health Connect indisponível. Use o registro manual.", "HEALTH_UNAVAILABLE")
            return
        }
        val contract = PermissionController.createRequestPermissionResultContract()
        startActivityForResult(call, contract.createIntent(context, permissions), "sleepPermissionResult")
    }

    @ActivityCallback
    private fun sleepPermissionResult(call: PluginCall?, result: ActivityResult) {
        if (call == null) return
        jobs.launch {
            try { call.resolve(status()) } catch (_: Exception) { call.reject("Não foi possível confirmar a permissão de sono.", "HEALTH_PERMISSION") }
        }
    }

    @PluginMethod
    fun openSettings(call: PluginCall) {
        try {
            val intent = if (availability() == HealthConnectClient.SDK_AVAILABLE) {
                Intent(HealthConnectClient.ACTION_HEALTH_CONNECT_SETTINGS)
            } else {
                Intent(Intent.ACTION_VIEW, Uri.parse("market://details?id=com.google.android.apps.healthdata"))
            }
            activity.startActivity(intent)
            call.resolve()
        } catch (_: Exception) { call.reject("Não foi possível abrir o Health Connect.", "HEALTH_SETTINGS") }
    }

    private fun scopeId(call: PluginCall): String {
        val value = call.getString("scopeId") ?: error("Missing scope")
        require(value.length in 1..240 && value.contains(":"))
        return value
    }

    private fun recordJson(record: SleepSessionRecord): JSObject {
        val stages = record.stages.map { stage ->
            val sleeping = when (stage.stage) {
                SleepSessionRecord.STAGE_TYPE_SLEEPING, SleepSessionRecord.STAGE_TYPE_LIGHT,
                SleepSessionRecord.STAGE_TYPE_DEEP, SleepSessionRecord.STAGE_TYPE_REM -> true
                SleepSessionRecord.STAGE_TYPE_AWAKE, SleepSessionRecord.STAGE_TYPE_OUT_OF_BED,
                SleepSessionRecord.STAGE_TYPE_AWAKE_IN_BED -> false
                else -> null
            }
            SleepDuration.Stage(stage.startTime.toEpochMilli(), stage.endTime.toEpochMilli(), sleeping)
        }
        val duration = SleepDuration.estimateSeconds(record.startTime.toEpochMilli(), record.endTime.toEpochMilli(), stages)
        val origin = record.metadata.dataOrigin.packageName
        val label = try {
            @Suppress("DEPRECATION")
            context.packageManager.getApplicationLabel(context.packageManager.getApplicationInfo(origin, 0)).toString().take(120)
        } catch (_: Exception) { "Health Connect" }
        return JSObject().apply {
            put("externalId", record.metadata.id)
            put("origin", origin)
            put("originLabel", label)
            put("sourceModifiedAt", record.metadata.lastModifiedTime.toString())
            put("startTime", record.startTime.toString())
            put("endTime", record.endTime.toString())
            put("endOffsetMinutes", record.endZoneOffset?.totalSeconds?.div(60) ?: org.json.JSONObject.NULL)
            put("sleepSeconds", duration ?: org.json.JSONObject.NULL)
            put("kind", "main")
        }
    }

    private fun usable(record: SleepSessionRecord, now: Instant): Boolean {
        val duration = Duration.between(record.startTime, record.endTime)
        return !duration.isNegative && !duration.isZero && duration <= Duration.ofHours(36) &&
            !record.endTime.isAfter(now.plusSeconds(300)) && !record.endTime.isBefore(now.minus(Duration.ofDays(90)))
    }

    private suspend fun snapshot(api: HealthConnectClient): JSObject {
        // Capturar o token ANTES do snapshot evita perder alterações entre leituras.
        val nextToken = api.getChangesToken(ChangesTokenRequest(recordTypes = setOf(SleepSessionRecord::class)))
        val end = Instant.now()
        val start = end.minus(Duration.ofDays(30))
        val records = JSArray()
        var pageToken: String? = null
        do {
            val page = api.readRecords(ReadRecordsRequest(recordType = SleepSessionRecord::class, timeRangeFilter = TimeRangeFilter.between(start, end), pageSize = 200, pageToken = pageToken))
            page.records.filter { usable(it, end) && !it.startTime.isBefore(start) && it.startTime.isBefore(end) }.forEach { records.put(recordJson(it)) }
            check(records.length() <= 1000) { "Too many sleep records" }
            pageToken = page.pageToken
        } while (!pageToken.isNullOrEmpty())
        return JSObject().apply {
            put("records", records)
            put("deletedIds", JSArray())
            put("nextToken", nextToken)
            put("hasMore", true) // Consumir mudanças ocorridas durante o snapshot.
            put("snapshotStart", start.toString())
            put("snapshotEnd", end.toString())
        }
    }

    @PluginMethod
    fun readSleep(call: PluginCall) {
        jobs.launch {
            try {
                mutex.withLock {
                    val key = scopeId(call)
                    val api = client()
                    check(api.permissionController.getGrantedPermissions().contains(readPermission))
                    val token = tokens.getString("token.$key", null)
                    val result = if (token.isNullOrEmpty()) snapshot(api) else {
                        val changes = api.getChanges(token)
                        if (changes.changesTokenExpired) snapshot(api) else {
                            val records = JSArray()
                            val deleted = JSArray()
                            val now = Instant.now()
                            for (change in changes.changes) {
                                when (change) {
                                    is UpsertionChange -> {
                                        val record = change.record as? SleepSessionRecord ?: continue
                                        if (usable(record, now)) records.put(recordJson(record)) else deleted.put(record.metadata.id)
                                    }
                                    is DeletionChange -> deleted.put(change.recordId)
                                }
                            }
                            check(records.length() <= 1000 && deleted.length() <= 1000)
                            JSObject().apply {
                                put("records", records)
                                put("deletedIds", deleted)
                                put("nextToken", changes.nextChangesToken)
                                put("hasMore", changes.hasMore)
                            }
                        }
                    }
                    pending[key] = result.getString("nextToken")
                    call.resolve(result)
                }
            } catch (_: Exception) { call.reject("Não foi possível ler o sono. Confira a permissão e tente sincronizar novamente.", "HEALTH_READ") }
        }
    }

    @PluginMethod
    fun acknowledge(call: PluginCall) {
        jobs.launch {
            try {
                mutex.withLock {
                    val key = scopeId(call)
                    val token = call.getString("nextToken") ?: error("Missing token")
                    check(pending[key] == token)
                    check(tokens.edit().putString("token.$key", token).commit())
                    pending.remove(key)
                    call.resolve()
                }
            } catch (_: Exception) { call.reject("Não foi possível salvar a sincronização. O próximo envio será repetido com segurança.", "HEALTH_ACK") }
        }
    }

    @PluginMethod
    fun disconnect(call: PluginCall) {
        jobs.launch {
            try {
                mutex.withLock {
                    val key = scopeId(call)
                    pending.remove(key)
                    tokens.edit().remove("token.$key").apply()
                    call.resolve()
                }
            } catch (_: Exception) { call.reject("Não foi possível limpar a sincronização local.", "HEALTH_DISCONNECT") }
        }
    }

    @PluginMethod
    fun exportData(call: PluginCall) {
        if (call.getString("json") == null) { call.reject("Nenhum dado para exportar."); return }
        val intent = Intent(Intent.ACTION_CREATE_DOCUMENT).apply {
            addCategory(Intent.CATEGORY_OPENABLE)
            type = "application/json"
            putExtra(Intent.EXTRA_TITLE, "runnex-sono.json")
        }
        startActivityForResult(call, intent, "sleepExportResult")
    }

    @ActivityCallback
    private fun sleepExportResult(call: PluginCall?, result: ActivityResult) {
        if (call == null) return
        val uri = result.data?.data
        if (result.resultCode != Activity.RESULT_OK || uri == null) {
            call.resolve(JSObject().put("saved", false))
            return
        }
        jobs.launch {
            try {
                val json = call.getString("json") ?: error("Missing export")
                withContext(Dispatchers.IO) {
                    val output = context.contentResolver.openOutputStream(uri, "wt") ?: error("Cannot open document")
                    output.use { it.write(json.toByteArray(Charsets.UTF_8)) }
                }
                call.resolve(JSObject().put("saved", true))
            } catch (_: Exception) { call.reject("Não foi possível salvar a exportação.", "HEALTH_EXPORT") }
        }
    }

    override fun handleOnDestroy() {
        jobs.cancel()
        super.handleOnDestroy()
    }
}
