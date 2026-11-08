plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

val apiBaseUrl = providers.gradleProperty("palzApiBaseUrl").orElse("https://api.example.invalid").get().trimEnd('/')
val todayUrl = providers.gradleProperty("palzTodayUrl").orElse("https://app.example.invalid/today").get()
    require(apiBaseUrl.startsWith("https://") || apiBaseUrl.startsWith("http://10.0.2.2:") || apiBaseUrl.startsWith("http://10.0.2.2/") || apiBaseUrl.startsWith("http://127.0.0.1:") || apiBaseUrl.startsWith("http://localhost:")) {
    "palzApiBaseUrl must be HTTPS (or Android emulator 10.0.2.2 for local development)."
}
require(todayUrl.startsWith("https://")) { "palzTodayUrl must be HTTPS." }

android {
    namespace = "com.palzstay.today"
    compileSdk = 35
    defaultConfig {
        applicationId = "com.palzstay.today"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "1.0"
        buildConfigField("String", "API_BASE_URL", "\"$apiBaseUrl\"")
        buildConfigField("String", "TODAY_URL", "\"$todayUrl\"")
    }
    buildFeatures { buildConfig = true }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
}

dependencies {
    implementation(platform("com.google.firebase:firebase-bom:33.7.0"))
    implementation("com.google.firebase:firebase-auth")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-play-services:1.9.0")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.9.0")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.7")
    implementation("androidx.work:work-runtime-ktx:2.10.0")
    implementation("androidx.core:core-ktx:1.15.0")
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("com.google.android.material:material:1.12.0")
}
