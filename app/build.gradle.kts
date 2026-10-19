import java.util.Properties

plugins {
    alias(libs.plugins.android.application)
}

val localProperties = Properties().apply {
    val file = rootProject.file("local.properties")
    if (file.exists()) file.reader().use { load(it) }
}

/**
 * The Twitch app's Client ID: TWITCH_CLIENT_ID in the environment (CI), else `twitch.clientId` in
 * local.properties. It's a public client ID, not a secret, but it identifies whoever registered it,
 * so it isn't committed. Without one the app still works; sign-in, Following and Search are off.
 */
val twitchClientId: String = System.getenv("TWITCH_CLIENT_ID")?.takeIf { it.isNotBlank() }
    ?: localProperties.getProperty("twitch.clientId")
    ?: ""

/** Release signing comes from the environment (CI secrets); without all of it, release builds are unsigned. */
val releaseKeystore: String? = System.getenv("KEYSTORE_FILE")?.takeIf { file(it).exists() }
    ?.takeIf { listOf("KEYSTORE_PASSWORD", "KEY_ALIAS", "KEY_PASSWORD").all { !System.getenv(it).isNullOrEmpty() } }

/** Releases take their version from the git tag (APP_VERSION=v1.2.3 in CI); the versionCode is then 10203. */
val appVersion: String = System.getenv("APP_VERSION")?.removePrefix("v")?.takeIf { Regex("""\d+\.\d+\.\d+""").matches(it) } ?: "0.2.0"
val appVersionCode: Int = appVersion.split('.').map(String::toInt).let { (major, minor, patch) -> major * 10000 + minor * 100 + patch }

android {
    namespace = "com.mojoedops.multiview"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.mojoedops.multiview"
        minSdk = 30
        targetSdk = 36
        versionCode = appVersionCode
        versionName = appVersion
        buildConfigField("String", "TWITCH_CLIENT_ID", "\"$twitchClientId\"")
        manifestPlaceholders["appLabel"] = "Multiview"
    }

    signingConfigs {
        if (releaseKeystore != null) {
            create("release") {
                storeFile = file(releaseKeystore)
                storePassword = System.getenv("KEYSTORE_PASSWORD")
                keyAlias = System.getenv("KEY_ALIAS")
                keyPassword = System.getenv("KEY_PASSWORD")
            }
        }
    }

    buildTypes {
        debug {
            // Installs next to a release build instead of replacing it.
            applicationIdSuffix = ".debug"
            manifestPlaceholders["appLabel"] = "Multiview (debug)"
        }
        release {
            isMinifyEnabled = false
            signingConfig = signingConfigs.findByName("release")
        }
    }

    buildFeatures {
        buildConfig = true
    }

    lint {
        warningsAsErrors = true
        abortOnError = true
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

dependencies {
    // addWebMessageListener: only the app's own page can message the app, not Twitch's iframes or their ads.
    implementation(libs.androidx.webkit)

    testImplementation(libs.junit)
    testImplementation(libs.json)
}
