package com.mojoedops.multiview

import android.content.Context
import android.webkit.CookieManager
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings

/** The page is served from the app's assets on this https origin; Twitch embeds need a real parent domain. */
const val APP_HOST = "appassets.androidplatform.net"
const val APP_ORIGIN = "https://$APP_HOST"
const val PAGE_URL = "$APP_ORIGIN/index.html"

private val MIME_TYPES = mapOf("html" to "text/html", "js" to "text/javascript", "css" to "text/css", "svg" to "image/svg+xml")

/** The asset behind a request to [APP_HOST], or null for anything else (which then loads normally). */
fun appAsset(context: Context, request: WebResourceRequest): WebResourceResponse? {
    if (request.url.host != APP_HOST) return null
    val path = request.url.path?.removePrefix("/") ?: return null
    val mime = MIME_TYPES[path.substringAfterLast('.')] ?: "application/octet-stream"
    return runCatching { WebResourceResponse(mime, "utf-8", context.assets.open(path)) }.getOrNull()
}

/** Desktop Chrome on Windows, at the same Chrome version as this WebView, so Twitch serves its full pages. */
fun desktopUserAgent(context: Context): String {
    val version = Regex("Chrome/(\\d+)").find(WebSettings.getDefaultUserAgent(context))?.groupValues?.get(1) ?: "153"
    return "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/$version.0.0.0 Safari/537.36"
}

/** True once the person has signed in on twitch.tv inside the app, which the embedded players and chat use. */
fun playerSignedIn(): Boolean = CookieManager.getInstance().getCookie("https://www.twitch.tv")?.contains("auth-token=") == true

/** Signs the players out: the app only keeps Twitch's cookies, so clearing them all is enough. */
fun clearPlayerSignIn() {
    CookieManager.getInstance().removeAllCookies(null)
    CookieManager.getInstance().flush()
}
