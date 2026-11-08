package com.palzstay.today

import android.app.Activity
import android.appwidget.AppWidgetManager
import android.content.Intent
import android.os.Bundle
import android.view.View
import android.view.ViewGroup
import android.widget.ArrayAdapter
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.Spinner
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.google.firebase.auth.FirebaseAuth
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await

class SetupActivity : AppCompatActivity() {
    private lateinit var email: EditText
    private lateinit var password: EditText
    private lateinit var workspace: Spinner
    private lateinit var message: TextView
    private lateinit var progress: ProgressBar
    private lateinit var signIn: Button
    private lateinit var save: Button
    private lateinit var signOut: Button
    private var auth: FirebaseAuth? = null
    private var businesses: List<Business> = emptyList()
    private var loaded = false
    private var appWidgetId = AppWidgetManager.INVALID_APPWIDGET_ID

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        appWidgetId = intent?.getIntExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, AppWidgetManager.INVALID_APPWIDGET_ID)
            ?: AppWidgetManager.INVALID_APPWIDGET_ID
        if (appWidgetId != AppWidgetManager.INVALID_APPWIDGET_ID) {
            setResult(Activity.RESULT_CANCELED, Intent().putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, appWidgetId))
        }
        makeUi()
        lifecycleScope.launch {
            setBusy(true, "Connecting securely…")
            runCatching { PlatformApi.initializeFirebase() }
                .onSuccess { firebase ->
                    auth = firebase
                    loaded = true
                    showSignedInState()
                }
                .onFailure { showMessage("Couldn’t load sign-in settings. Check your connection and try again.") }
            setBusy(false)
        }
    }

    private fun makeUi() {
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(24), dp(22), dp(24), dp(24))
            setBackgroundColor(0xFFFFFDF8.toInt())
        }
        setContentView(root)
        root.addView(TextView(this).apply { text = "Palz Stay · Today"; textSize = 24f; setTextColor(0xFF315B49.toInt()); setPadding(0, 0, 0, dp(6)) })
        root.addView(TextView(this).apply { text = "Sign in and choose a workspace for your home screen widget."; textSize = 15f; setTextColor(0xFF494A45.toInt()); setPadding(0, 0, 0, dp(18)) })
        email = EditText(this).apply { hint = "Email"; inputType = android.text.InputType.TYPE_CLASS_TEXT or android.text.InputType.TYPE_TEXT_VARIATION_EMAIL_ADDRESS; setSingleLine() }
        password = EditText(this).apply { hint = "Password"; inputType = android.text.InputType.TYPE_CLASS_TEXT or android.text.InputType.TYPE_TEXT_VARIATION_PASSWORD; setSingleLine() }
        root.addView(email, matchWrap())
        root.addView(password, matchWrap())
        signIn = Button(this).apply { text = "Sign in"; setOnClickListener { signIn() } }
        root.addView(signIn, matchWrap())
        workspace = Spinner(this)
        workspace.visibility = View.GONE
        root.addView(workspace, matchWrap())
        save = Button(this).apply { text = "Use this workspace"; visibility = View.GONE; setOnClickListener { saveSelection() } }
        root.addView(save, matchWrap())
        signOut = Button(this).apply { text = "Sign out"; visibility = View.GONE; setOnClickListener { signOut() } }
        root.addView(signOut, matchWrap())
        progress = ProgressBar(this).apply { visibility = View.GONE; isIndeterminate = true }
        root.addView(progress, LinearLayout.LayoutParams(dp(40), dp(40)).apply { topMargin = dp(10) })
        message = TextView(this).apply { textSize = 14f; setTextColor(0xFF494A45.toInt()); setPadding(0, dp(8), 0, 0) }
        root.addView(message, matchWrap())
    }

    private fun signIn() {
        val firebase = auth ?: return showMessage("Sign-in settings are still loading.")
        val address = email.text.toString().trim()
        val secret = password.text.toString()
        if (address.isBlank() || secret.isBlank()) return showMessage("Enter your email and password.")
        setBusy(true, "Signing in…")
        firebase.signInWithEmailAndPassword(address, secret).addOnCompleteListener(this) { task ->
            if (task.isSuccessful) {
                lifecycleScope.launch { loadBusinesses() }
            } else {
                setBusy(false)
                showMessage("Sign-in failed. Check your email and password, then try again.")
            }
        }
    }

    private suspend fun loadBusinesses() {
        val user = auth?.currentUser
        if (user == null) { setBusy(false); return showMessage("Sign in to continue.") }
        runCatching { user.reload().await() }
        if (auth?.currentUser?.isEmailVerified != true) {
            setBusy(false)
            return showMessage("Verify your email address before connecting a widget.")
        }
        setBusy(true, "Loading your workspaces…")
        runCatching { PlatformApi.listBusinesses(auth!!) }
            .onSuccess { list ->
                businesses = list
                if (list.isEmpty()) {
                    signIn.visibility = View.GONE
                    email.visibility = View.GONE
                    password.visibility = View.GONE
                    signOut.visibility = View.VISIBLE
                    showMessage("No workspaces are available for this account.")
                } else {
                    workspace.adapter = ArrayAdapter(this, android.R.layout.simple_spinner_dropdown_item, list.map { it.name })
                    workspace.visibility = View.VISIBLE
                    save.visibility = View.VISIBLE
                    signOut.visibility = View.VISIBLE
                    signIn.visibility = View.GONE
                    email.visibility = View.GONE
                    password.visibility = View.GONE
                    showMessage("Choose which workspace this widget should show.")
                }
            }
            .onFailure { showMessage(it.message ?: "Couldn’t load workspaces.") }
        setBusy(false)
    }

    private fun showSignedInState() {
        val user = auth?.currentUser
        if (user != null && user.isEmailVerified) {
            lifecycleScope.launch { loadBusinesses() }
        } else if (user != null) {
            showMessage("Verify your email address before connecting a widget.")
            signOut.visibility = View.VISIBLE
        } else {
            showMessage("Sign in with your Palz Stay account.")
        }
    }

    private fun saveSelection() {
        val choice = businesses.getOrNull(workspace.selectedItemPosition) ?: return showMessage("Choose a workspace first.")
        WidgetStorage.setBusinessId(this, choice.id)
        TodayWidgetProvider.refresh(this, "Updating today’s schedule…")
        if (appWidgetId != AppWidgetManager.INVALID_APPWIDGET_ID) {
            setResult(Activity.RESULT_OK, Intent().putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, appWidgetId))
            finish()
        } else showMessage("Widget connected to ${choice.name}.")
    }

    private fun signOut() {
        auth?.signOut()
        WidgetStorage.clear(this)
        TodayWidgetProvider.refresh(this)
        workspace.visibility = View.GONE
        save.visibility = View.GONE
        signOut.visibility = View.GONE
        signIn.visibility = View.VISIBLE
        email.visibility = View.VISIBLE
        password.visibility = View.VISIBLE
        showMessage("Signed out. The widget no longer shows schedule details.")
    }

    private fun setBusy(busy: Boolean, text: String? = null) {
        progress.visibility = if (busy) View.VISIBLE else View.GONE
        signIn.isEnabled = !busy
        save.isEnabled = !busy
        if (text != null) showMessage(text)
    }
    private fun showMessage(text: String) { message.text = text }
    private fun dp(value: Int) = (value * resources.displayMetrics.density).toInt()
    private fun matchWrap() = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT)
}
