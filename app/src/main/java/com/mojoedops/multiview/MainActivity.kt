package com.mojoedops.multiview

import android.annotation.SuppressLint
import android.app.Activity
import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.os.Bundle
import android.util.Log
import android.view.KeyEvent
import android.view.WindowManager
import android.webkit.ConsoleMessage
import android.webkit.CookieManager
import android.webkit.RenderProcessGoneDetail
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature
import com.mojoedops.multiview.bridge.PageBridge
import com.mojoedops.multiview.twitch.PrefsTokenStore
import com.mojoedops.multiview.twitch.TwitchAccount
import com.mojoedops.multiview.twitch.UrlConnectionHttp
import org.json.JSONObject

/**
 * Hosts the Multiview page (assets/index.html and assets/js) in one fullscreen WebView. The page owns
 * the screens and the Twitch players; this activity owns the remote, and through [PageBridge] the
 * Twitch account and the native dialogs.
 *
 *   adb shell am start -n com.mojoedops.multiview/.MainActivity --es channels 'a,b,c'
 */
class MainActivity : Activity(), PageBridge.Host {
    private lateinit var web: WebView
    private lateinit var account: TwitchAccount
    private lateinit var bridge: PageBridge
    private var okLongPressed = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG)
        account = TwitchAccount(BuildConfig.TWITCH_CLIENT_ID, UrlConnectionHttp(), PrefsTokenStore(this))
        bridge = PageBridge(account, this)
        web = createWebView()
        setContentView(web)
    }

    // The page is reloaded every time the app comes back, so nothing keeps playing behind the launcher.
    override fun onStart() {
        super.onStart()
        web.onResume()
        web.loadUrl(pageUrl())
    }

    override fun onStop() {
        web.loadUrl("about:blank")
        web.onPause()
        super.onStop()
    }

    override fun onDestroy() {
        account.cancelSignIn()
        web.destroy()
        super.onDestroy()
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        if (intent.hasExtra(EXTRA_CHANNELS)) web.loadUrl(pageUrl())
    }

    /** The `channels` extra (a debugging aid) replaces the saved lineup once; after that the page's own state wins. */
    private fun pageUrl(): String {
        val channels = intent.getStringExtra(EXTRA_CHANNELS)
        intent.removeExtra(EXTRA_CHANNELS)
        return if (channels.isNullOrBlank()) PAGE_URL else "$PAGE_URL?channels=${Uri.encode(channels)}"
    }

    // The page never gets key focus itself, so a Twitch iframe can't trap the remote.
    @SuppressLint("GestureBackNavigation")
    override fun dispatchKeyEvent(event: KeyEvent): Boolean {
        if (isOkKey(event.keyCode)) return handleOk(event)
        val name = remoteKeyName(event.keyCode) ?: return super.dispatchKeyEvent(event)
        val wanted = if (actsOnPress(name)) KeyEvent.ACTION_DOWN else KeyEvent.ACTION_UP
        if (event.action == wanted) sendKey(name)
        return true
    }

    /** OK: a short press goes to the page on release; holding it sends "hold" (the stream menu). */
    private fun handleOk(event: KeyEvent): Boolean {
        when (event.action) {
            KeyEvent.ACTION_DOWN -> if (event.repeatCount == 0) {
                okLongPressed = false
            } else if (!okLongPressed) {
                okLongPressed = true
                sendKey("hold")
            }
            KeyEvent.ACTION_UP -> if (!okLongPressed) sendKey("ok")
        }
        return true
    }

    private fun sendKey(name: String) = web.evaluateJavascript("window.mv && mv.key('$name')", null)

    // ---- PageBridge.Host ----

    override fun reply(id: Int, status: Int, body: String) = runOnUiThread {
        web.evaluateJavascript("mv.native.reply($id, $status, ${JSONObject.quote(body)})", null)
    }

    override fun event(name: String, data: JSONObject) = runOnUiThread {
        web.evaluateJavascript("mv.native.event(${JSONObject.quote(name)}, $data)", null)
    }

    override fun prompt(title: String, initial: String, hint: String, onDone: (String?) -> Unit) =
        TvDialogs.prompt(this, title, initial, hint, onDone)

    override fun menu(title: String, items: List<String>, onDone: (Int) -> Unit) = TvDialogs.menu(this, title, items, onDone)

    override fun playerSignedIn(): Boolean = com.mojoedops.multiview.playerSignedIn()

    override fun openPlayerSignIn() = startActivity(Intent(this, PlayerSignInActivity::class.java))

    override fun clearPlayerSignIn() = com.mojoedops.multiview.clearPlayerSignIn()

    override fun exit() = finish()

    // ---- WebView ----

    private fun replaceWebView() {
        val old = web
        web = createWebView()
        setContentView(web)
        old.destroy()
        web.loadUrl(PAGE_URL)
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun createWebView(): WebView = WebView(this).apply {
        setBackgroundColor(Color.BLACK)
        settings.javaScriptEnabled = true
        settings.domStorageEnabled = true
        settings.mediaPlaybackRequiresUserGesture = false
        // The page sets a 1920px-wide viewport, so CSS pixels match the screen and every tile stays
        // above Twitch's 400x300 minimum embed size.
        settings.useWideViewPort = true
        settings.loadWithOverviewMode = true
        settings.userAgentString = desktopUserAgent(this@MainActivity)
        CookieManager.getInstance().setAcceptThirdPartyCookies(this, true)
        if (WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) {
            // Only the app's own page can message the app: not Twitch's iframes, nor the ads inside them.
            WebViewCompat.addWebMessageListener(this, "Native", setOf(APP_ORIGIN)) { _, message, _, isMainFrame, _ ->
                val data = message.data
                if (isMainFrame && data != null && !bridge.onMessage(data)) Log.w(TAG, "unknown page message: ${data.take(200)}")
            }
        } else {
            Log.e(TAG, "WebView too old for addWebMessageListener; sign-in and search won't work")
        }
        webChromeClient = object : WebChromeClient() {
            override fun onConsoleMessage(message: ConsoleMessage): Boolean {
                Log.i(TAG, "${message.messageLevel()} ${message.message()}")
                return true
            }
        }
        webViewClient = object : WebViewClient() {
            // The Shield's renderer is 32-bit and Twitch's player is heavy; if it dies, start a fresh WebView.
            override fun onRenderProcessGone(view: WebView, detail: RenderProcessGoneDetail): Boolean {
                Log.w(TAG, "renderer gone, crashed=${detail.didCrash()}")
                if (view == web) replaceWebView()
                return true
            }

            override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? =
                appAsset(this@MainActivity, request)
        }
    }

    companion object {
        private const val TAG = "Multiview"
        private const val EXTRA_CHANNELS = "channels"
    }
}
