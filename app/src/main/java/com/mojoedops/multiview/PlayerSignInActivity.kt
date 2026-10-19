package com.mojoedops.multiview

import android.annotation.SuppressLint
import android.app.Activity
import android.graphics.Color
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.KeyEvent
import android.view.inputmethod.InputMethodManager
import android.webkit.CookieManager
import android.webkit.RenderProcessGoneDetail
import android.webkit.WebView
import android.webkit.WebViewClient

/**
 * Twitch's own sign-in page, so the embedded players and chat know who you are (no ads with Turbo or
 * on channels you subscribe to). The app never sees the password; it only watches for Twitch's sign-in
 * cookie and closes once it appears.
 *
 * The page is built for a mouse, so the remote is translated: up/down move between fields and buttons
 * (Shift+Tab/Tab), and OK opens the keyboard on a text field or presses Enter on anything else.
 */
class PlayerSignInActivity : Activity() {
    private lateinit var web: WebView
    private val handler = Handler(Looper.getMainLooper())
    private val checkSignedIn = object : Runnable {
        override fun run() {
            if (playerSignedIn()) {
                CookieManager.getInstance().flush()
                setResult(RESULT_OK)
                finish()
            } else {
                handler.postDelayed(this, CHECK_MS)
            }
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        web = WebView(this).apply {
            setBackgroundColor(Color.BLACK)
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.userAgentString = desktopUserAgent(this@PlayerSignInActivity)
            webViewClient = object : WebViewClient() {
                // If the page's renderer dies, close: the main screen reloads and the person can try again.
                override fun onRenderProcessGone(view: WebView, detail: RenderProcessGoneDetail): Boolean {
                    finish()
                    return true
                }
            }
        }
        CookieManager.getInstance().setAcceptThirdPartyCookies(web, true)
        setContentView(web)
        web.loadUrl(LOGIN_URL)
        web.requestFocus()
        handler.post(checkSignedIn)
    }

    override fun onDestroy() {
        handler.removeCallbacks(checkSignedIn)
        web.destroy()
        super.onDestroy()
    }

    override fun dispatchKeyEvent(event: KeyEvent): Boolean {
        val tab = when (event.keyCode) {
            KeyEvent.KEYCODE_DPAD_DOWN -> 0
            KeyEvent.KEYCODE_DPAD_UP -> KeyEvent.META_SHIFT_ON
            KeyEvent.KEYCODE_DPAD_CENTER -> {
                if (event.action == KeyEvent.ACTION_UP) pressOk()
                return true
            }
            else -> return super.dispatchKeyEvent(event)
        }
        web.dispatchKeyEvent(KeyEvent(event.downTime, event.eventTime, event.action, KeyEvent.KEYCODE_TAB, event.repeatCount, tab))
        return true
    }

    private fun pressOk() {
        web.evaluateJavascript("(document.activeElement || {}).tagName") { tag ->
            if (tag.contains("INPUT") || tag.contains("TEXTAREA")) {
                getSystemService(InputMethodManager::class.java).showSoftInput(web, 0)
            } else {
                web.dispatchKeyEvent(KeyEvent(KeyEvent.ACTION_DOWN, KeyEvent.KEYCODE_ENTER))
                web.dispatchKeyEvent(KeyEvent(KeyEvent.ACTION_UP, KeyEvent.KEYCODE_ENTER))
            }
        }
    }

    companion object {
        private const val LOGIN_URL = "https://www.twitch.tv/login"
        private const val CHECK_MS = 1000L
    }
}
