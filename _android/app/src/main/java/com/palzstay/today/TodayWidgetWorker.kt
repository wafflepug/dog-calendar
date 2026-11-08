package com.palzstay.today

import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.google.firebase.auth.FirebaseAuth
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

class TodayWidgetWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {
    override suspend fun doWork(): Result = withContext(Dispatchers.IO) {
        val id = inputData.getString(BUSINESS_ID) ?: WidgetStorage.businessId(applicationContext) ?: return@withContext Result.failure()
        if (WidgetStorage.businessId(applicationContext) != id) return@withContext Result.success()
        val manager = AppWidgetManager.getInstance(applicationContext)
        val widgetIds = manager.getAppWidgetIds(ComponentName(applicationContext, TodayWidgetProvider::class.java))
        try {
            val auth = PlatformApi.existingAuth() ?: PlatformApi.initializeFirebase()
            if (auth.currentUser == null) {
                WidgetStorage.clear(applicationContext)
                widgetIds.forEach { TodayWidgetProvider.render(applicationContext, manager, it, "Sign in and choose a workspace in Palz Stay.") }
                return@withContext Result.success()
            }
            val summary = PlatformApi.today(auth, id)
            if (WidgetStorage.businessId(applicationContext) == id) widgetIds.forEach { TodayWidgetProvider.render(applicationContext, manager, it, summary = summary) }
            Result.success()
        } catch (error: ApiException) {
            if (error.status == 404) {
                if (WidgetStorage.businessId(applicationContext) == id) WidgetStorage.clear(applicationContext)
                widgetIds.forEach { TodayWidgetProvider.render(applicationContext, manager, it, "Workspace unavailable. Open Palz Stay to set up the widget again.") }
                return@withContext Result.success()
            }
            if (error.status == 401 || error.status == 403) {
                widgetIds.forEach { TodayWidgetProvider.render(applicationContext, manager, it, "Sign in again to restore the Today widget.") }
                Result.success()
            } else {
                widgetIds.forEach { TodayWidgetProvider.render(applicationContext, manager, it, "Couldn’t refresh. Tap ↻ to retry.") }
                if (runAttemptCount < 3) Result.retry() else Result.failure()
            }
        } catch (_: Exception) {
            widgetIds.forEach { TodayWidgetProvider.render(applicationContext, manager, it, "Couldn’t refresh. Tap ↻ to retry.") }
            if (runAttemptCount < 3) Result.retry() else Result.failure()
        }
    }

    companion object { const val BUSINESS_ID = "business_id" }
}
