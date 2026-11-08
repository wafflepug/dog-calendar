package com.palzstay.today

import android.net.Uri
import com.google.firebase.FirebaseApp
import com.google.firebase.FirebaseOptions
import com.google.firebase.auth.FirebaseAuth
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONTokener
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

data class Business(val id: String, val name: String)
data class TodaySummary(
    val date: String,
    val staying: Int,
    val arriving: Int,
    val leaving: Int,
    val nextHandover: String?
)

object PlatformApi {
    private fun connection(path: String, token: String? = null): HttpURLConnection {
        val url = URL(BuildConfig.API_BASE_URL + path)
        require(url.protocol == "https" || (BuildConfig.DEBUG && url.host in setOf("10.0.2.2", "127.0.0.1", "localhost"))) {
            "The API must use HTTPS."
        }
        return (url.openConnection() as HttpURLConnection).apply {
            requestMethod = "GET"
            connectTimeout = 12_000
            readTimeout = 15_000
            setRequestProperty("Accept", "application/json")
            setRequestProperty("Cache-Control", "no-store")
            if (token != null) setRequestProperty("Authorization", "Bearer $token")
        }
    }

    private fun readJson(path: String, token: String? = null): JSONObject {
        return JSONObject(readBody(path, token))
    }

    private fun readBody(path: String, token: String? = null): String {
        val conn = connection(path, token)
        try {
            val status = conn.responseCode
            val stream = if (status in 200..299) conn.inputStream else conn.errorStream
            val body = stream?.bufferedReader(Charsets.UTF_8)?.use { it.readText() }.orEmpty()
            if (status !in 200..299) {
                val message = runCatching { JSONObject(body).getJSONObject("error").optString("message") }.getOrNull()
                throw ApiException(status, message?.takeIf { it.isNotBlank() } ?: "Request failed ($status).")
            }
            return body
        } finally {
            conn.disconnect()
        }
    }

    suspend fun initializeFirebase(): FirebaseAuth {
        val config = withContext(Dispatchers.IO) { readJson("/api/config") }
        val firebase = config.getJSONObject("firebase")
        val options = FirebaseOptions.Builder()
            .setApiKey(firebase.getString("apiKey"))
            .setApplicationId(firebase.getString("appId"))
            .setProjectId(firebase.getString("projectId"))
            .build()
        val existing = FirebaseApp.getApps(App.context).firstOrNull { it.name == "palz-platform" }
        val app = existing ?: FirebaseApp.initializeApp(App.context, options, "palz-platform")
        if (existing == null) {
            config.optString("emulatorUrl").takeIf { it.startsWith("http://") }?.let { emulator ->
                val uri = Uri.parse(emulator)
                val host = if (BuildConfig.DEBUG && (uri.host == "127.0.0.1" || uri.host == "localhost")) "10.0.2.2" else uri.host
                FirebaseAuth.getInstance(app).useEmulator(host!!, uri.port)
            }
        }
        return FirebaseAuth.getInstance(app)
    }

    suspend fun listBusinesses(auth: FirebaseAuth): List<Business> {
        val token = auth.currentUser?.getIdToken(false)?.await()?.token ?: throw ApiException(401, "Sign in to continue.")
        val payload = withContext(Dispatchers.IO) { JSONTokener(readBody("/api/businesses", token)).nextValue() }
        val rows: JSONArray = when (payload) {
            is JSONArray -> payload
            is JSONObject -> payload.optJSONArray("businesses") ?: payload.optJSONArray("items") ?: JSONArray()
            else -> JSONArray()
        }
        return (0 until rows.length()).mapNotNull { i ->
            val row = rows.optJSONObject(i) ?: return@mapNotNull null
            val id = row.optString("id")
            if (id.isBlank()) null else Business(id, row.optString("name", "Workspace"))
        }
    }

    suspend fun today(auth: FirebaseAuth, businessId: String): TodaySummary {
        val token = auth.currentUser?.getIdToken(false)?.await()?.token ?: throw ApiException(401, "Sign in to continue.")
        val safeId = Uri.encode(businessId)
        val result = withContext(Dispatchers.IO) { readJson("/api/businesses/$safeId/widget/today", token) }
        return TodaySummary(
            date = result.optString("date"),
            staying = result.optInt("staying", 0).coerceAtLeast(0),
            arriving = result.optInt("arriving", 0).coerceAtLeast(0),
            leaving = result.optInt("leaving", 0).coerceAtLeast(0),
            nextHandover = result.optString("nextHandover").takeIf { it.isNotBlank() && it != "null" }
        )
    }

    fun existingAuth(): FirebaseAuth? = FirebaseApp.getApps(App.context).firstOrNull { it.name == "palz-platform" }?.let { FirebaseAuth.getInstance(it) }
}

class ApiException(val status: Int, message: String) : Exception(message)

class App : android.app.Application() {
    override fun onCreate() { super.onCreate(); context = this }
    companion object { lateinit var context: android.content.Context; private set }
}
