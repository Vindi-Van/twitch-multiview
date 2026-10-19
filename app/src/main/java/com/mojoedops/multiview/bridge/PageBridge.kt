package com.mojoedops.multiview.bridge

import com.mojoedops.multiview.twitch.SignInEvent
import com.mojoedops.multiview.twitch.TwitchAccount
import org.json.JSONArray
import org.json.JSONObject

/**
 * The page's requests to the app. The page sends `{id, method, args}` with `Native.postMessage`
 * (only the app's own origin can); answers go back through [Host.reply], which the page receives as
 * `mv.native.reply(id, status, body)`, and sign-in progress through [Host.event].
 *
 * | method         | args                  | reply body                                   |
 * |----------------|-----------------------|----------------------------------------------|
 * | account        |                       | {login, userId, player, signInAvailable}     |
 * | signIn         |                       | none; events "signin" {state: code/done/...} |
 * | cancelSignIn   |                       | none                                         |
 * | signOut        |                       | {}                                           |
 * | api            | helix path            | Twitch's JSON, with Twitch's status          |
 * | prompt         | title, initial, hint  | the text (status 200) or cancelled (0)       |
 * | menu           | title, [labels]       | the chosen index, or -1                      |
 * | playerSignIn   |                       | none; the page reloads when it's done        |
 * | exit           |                       | none                                         |
 */
class PageBridge(private val account: TwitchAccount, private val host: Host) {
    interface Host {
        fun reply(id: Int, status: Int, body: String)
        fun event(name: String, data: JSONObject)
        fun prompt(title: String, initial: String, hint: String, onDone: (String?) -> Unit)
        fun menu(title: String, items: List<String>, onDone: (Int) -> Unit)
        fun playerSignedIn(): Boolean
        fun openPlayerSignIn()
        fun clearPlayerSignIn()
        fun exit()
    }

    /** Handles one message; false if it wasn't a message the bridge understands. */
    fun onMessage(message: String): Boolean {
        val msg = runCatching { JSONObject(message) }.getOrNull() ?: return false
        val id = msg.optInt("id")
        val args = msg.optJSONArray("args") ?: JSONArray()
        when (msg.optString("method")) {
            "account" -> host.reply(id, 200, accountJson().toString())
            "signIn" -> account.signIn { host.event("signin", it.toJson()) }
            "cancelSignIn" -> account.cancelSignIn()
            "signOut" -> {
                account.signOut()
                host.clearPlayerSignIn()
                host.reply(id, 200, "{}")
            }
            "api" -> account.get(args.getString(0)) { host.reply(id, it.status, it.body) }
            "prompt" -> host.prompt(args.getString(0), args.optString(1), args.optString(2)) { host.reply(id, if (it == null) 0 else 200, it.orEmpty()) }
            "menu" -> {
                val labels = args.getJSONArray(1)
                host.menu(args.getString(0), List(labels.length()) { labels.getString(it) }) { host.reply(id, 200, it.toString()) }
            }
            "playerSignIn" -> host.openPlayerSignIn()
            "exit" -> host.exit()
            else -> return false
        }
        return true
    }

    fun accountJson(): JSONObject = JSONObject()
        .put("login", account.login ?: JSONObject.NULL)
        .put("userId", account.userId ?: JSONObject.NULL)
        .put("player", host.playerSignedIn())
        .put("signInAvailable", account.isConfigured)
}

fun SignInEvent.toJson(): JSONObject = when (this) {
    is SignInEvent.Code -> JSONObject().put("state", "code").put("userCode", userCode).put("uri", uri).put("expiresIn", expiresInSeconds)
    is SignInEvent.Done -> JSONObject().put("state", "done").put("login", login)
    SignInEvent.Expired -> JSONObject().put("state", "expired")
    is SignInEvent.Failed -> JSONObject().put("state", "error").put("message", message)
}
