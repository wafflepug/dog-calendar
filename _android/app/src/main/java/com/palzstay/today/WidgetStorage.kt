package com.palzstay.today

import android.content.Context

object WidgetStorage {
    private const val PREFS = "widget_setup"
    private const val BUSINESS_ID = "business_id"
    fun businessId(context: Context): String? = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(BUSINESS_ID, null)
    fun setBusinessId(context: Context, id: String) { context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(BUSINESS_ID, id).apply() }
    fun clear(context: Context) { context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().remove(BUSINESS_ID).apply() }
}
