package com.palzstay.today

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.widget.RemoteViews
import androidx.work.Constraints
import androidx.work.ExistingWorkPolicy
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.workDataOf
import java.text.DateFormat
import java.util.Date
import java.util.concurrent.TimeUnit

class TodayWidgetProvider : AppWidgetProvider() {
    override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
        ids.forEach { render(context, manager, it, if (WidgetStorage.businessId(context) == null) "Sign in and choose a workspace in Palz Stay." else "Updating today’s schedule…") }
        enqueueRefresh(context)
    }

    override fun onReceive(context: Context, intent: Intent) {
        super.onReceive(context, intent)
        if (intent.action == ACTION_REFRESH) enqueueRefresh(context)
    }

    companion object {
        const val ACTION_REFRESH = "com.palzstay.today.REFRESH"
        private const val UNIQUE_REFRESH = "today-widget-refresh"

        fun refresh(context: Context, status: String? = null) {
            val manager = AppWidgetManager.getInstance(context)
            val ids = manager.getAppWidgetIds(ComponentName(context, TodayWidgetProvider::class.java))
            ids.forEach { render(context, manager, it, status) }
            enqueueRefresh(context)
        }

        fun enqueueRefresh(context: Context) {
            val id = WidgetStorage.businessId(context)
            if (id == null) {
                val manager = AppWidgetManager.getInstance(context)
                manager.getAppWidgetIds(ComponentName(context, TodayWidgetProvider::class.java)).forEach {
                    render(context, manager, it, "Sign in and choose a workspace in Palz Stay.")
                }
                return
            }
            val work = OneTimeWorkRequestBuilder<TodayWidgetWorker>()
                .setInputData(workDataOf(TodayWidgetWorker.BUSINESS_ID to id))
                .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
                .build()
            val periodic = PeriodicWorkRequestBuilder<TodayWidgetWorker>(30, TimeUnit.MINUTES)
                .setInputData(workDataOf(TodayWidgetWorker.BUSINESS_ID to id))
                .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
                .build()
            WorkManager.getInstance(context).enqueueUniquePeriodicWork("today-widget-periodic", ExistingPeriodicWorkPolicy.UPDATE, periodic)
            WorkManager.getInstance(context).enqueueUniqueWork(UNIQUE_REFRESH, ExistingWorkPolicy.REPLACE, work)
        }

        fun render(context: Context, manager: AppWidgetManager, widgetId: Int, status: String? = null, summary: TodaySummary? = null) {
            val views = RemoteViews(context.packageName, R.layout.widget_today)
            val auth = PlatformApi.existingAuth()
            val signedIn = auth?.currentUser != null
            if (!signedIn) {
                views.setTextViewText(R.id.status, "Sign in to see today’s schedule.")
                views.setViewVisibility(R.id.counts, android.view.View.GONE)
                views.setViewVisibility(R.id.handover, android.view.View.GONE)
                views.setViewVisibility(R.id.updated, android.view.View.GONE)
            } else if (summary != null) {
                views.setTextViewText(R.id.status, summary.date.takeIf { it.isNotBlank() }?.let { "${it} · scheduled today" } ?: "Scheduled today")
                views.setTextViewText(R.id.staying, "${summary.staying}\nBooked today")
                views.setTextViewText(R.id.arriving, "${summary.arriving}\nDue to arrive")
                views.setTextViewText(R.id.leaving, "${summary.leaving}\nDue to leave")
                views.setViewVisibility(R.id.counts, android.view.View.VISIBLE)
                views.setTextViewText(R.id.handover, summary.nextHandover.orEmpty())
                views.setViewVisibility(R.id.handover, if (summary.nextHandover == null) android.view.View.GONE else android.view.View.VISIBLE)
                views.setTextViewText(R.id.updated, "Updated ${DateFormat.getTimeInstance(DateFormat.SHORT).format(Date())}")
                views.setViewVisibility(R.id.updated, android.view.View.VISIBLE)
            } else {
                views.setTextViewText(R.id.status, status ?: "Today’s schedule is unavailable. Tap refresh to try again.")
                views.setViewVisibility(R.id.counts, android.view.View.GONE)
                views.setViewVisibility(R.id.handover, android.view.View.GONE)
                views.setViewVisibility(R.id.updated, android.view.View.GONE)
            }

            val refresh = Intent(context, TodayWidgetProvider::class.java).setAction(ACTION_REFRESH)
            val refreshPending = PendingIntent.getBroadcast(context, widgetId, refresh, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
            views.setOnClickPendingIntent(R.id.refresh, refreshPending)
            val openToday = Intent(Intent.ACTION_VIEW, Uri.parse(BuildConfig.TODAY_URL)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            val todayPending = PendingIntent.getActivity(context, widgetId + 50_000, openToday, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
            views.setOnClickPendingIntent(R.id.widget_root, todayPending)
            manager.updateAppWidget(widgetId, views)
        }
    }
}
