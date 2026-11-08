# Palz Stay Android Today widget

This native Android home screen widget shows the selected workspace’s scheduled-today, due-to-arrive, and due-to-leave counts. It omits owner and dog details. The widget opens the configured web Today page when tapped and has a separate refresh control. It makes only the authenticated, read-only `GET /api/businesses/{id}/widget/today` request. The API computes the date in the business timezone and returns `{date, staying, arriving, leaving, nextHandover}`.

## Configure and build

Use Android Studio with JDK 17, Android SDK 35, and Gradle 8.11.1. Set the two Gradle properties in `_android/gradle.properties` or pass them to Gradle:

```powershell
cd _android
.\gradlew.bat assembleDebug `
  -PpalzApiBaseUrl=https://your-commercial-api.example `
  -PpalzTodayUrl=https://your-site.example/today
```

Both URLs are build-time settings. The API URL must use HTTPS for production builds; the Today page URL must always use HTTPS. The public Firebase web configuration is fetched at runtime from `/api/config`, so no Firebase secret or `google-services.json` is bundled. Firebase email/password sessions remain in Firebase Auth’s SDK storage; the app preferences contain only the selected business ID. No widget counts or account tokens are written to app preferences.

For an Android emulator against the local platform, use `http://127.0.0.1:4380` with `adb reverse tcp:4380 tcp:4380`. The debug build permits cleartext only in its debug variant, and the API client accepts only loopback/emulator hosts over HTTP. Point the local app at its emulator Auth endpoint in `/api/config`; the app maps localhost to the host machine’s emulator route where needed. Production builds reject non-HTTPS API URLs.

## Set up

Add the **Palz Stay Today** widget from the Android widget picker. Its configuration screen loads Firebase settings, signs in with email and password, requires a verified email, lists workspaces from `GET /api/businesses`, and saves the selected workspace ID. The widget starts blank while signed out. If the user signs out or the API reports an expired session, schedule counts are cleared from the widget. No booking or operational action is available in the widget.

WorkManager performs an immediate refresh after setup or a tap on ↻, retries transient failures, and schedules a network-constrained refresh every 30 minutes. Android may defer periodic work to preserve battery. A successful widget view shows the local refresh time; the date comes from the API’s business timezone.

The generated debug APK is at `app/build/outputs/apk/debug/app-debug.apk`.
