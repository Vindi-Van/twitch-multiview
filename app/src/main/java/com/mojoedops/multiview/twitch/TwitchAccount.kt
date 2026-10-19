package com.mojoedops.multiview.twitch

import org.json.JSONObject
import java.io.IOException
import java.util.concurrent.Executor
import java.util.concurrent.Executors

sealed interface SignInEvent {
    data class Code(val userCode: String, val uri: String, val expiresInSeconds: Int) : SignInEvent
    data class Done(val login: String) : SignInEvent
    data object Expired : SignInEvent
    data class Failed(val message: String) : SignInEvent
}

/**
 * The Twitch account: sign-in with a code shown on the TV (OAuth device flow; the app is a public
 * client, so there is no secret), the saved tokens, and authenticated Helix GETs. Tokens stay on
 * this side; the page only ever sees API responses.
 *
 * Network, storage, threads, sleeping and the clock are injected so the flow can be unit tested.
 */
class TwitchAccount(
    private val clientId: String,
    private val http: Http,
    private val store: TokenStore,
    private val executor: Executor = Executors.newFixedThreadPool(4),
    private val sleep: (Long) -> Unit = Thread::sleep,
    private val clock: () -> Long = System::currentTimeMillis,
) {
    private val tokenLock = Any()

    @Volatile
    private var signInRun = 0

    /** False when the build has no Client ID; then sign-in, Following and Search are unavailable. */
    val isConfigured: Boolean get() = clientId.isNotBlank()
    val login: String? get() = store.login
    val userId: String? get() = store.userId

    /**
     * Gets a code for the TV to show, then waits for the person to approve it at twitch.tv/activate.
     * [onEvent] is called on a background thread: [SignInEvent.Code] first, then exactly one of the others.
     */
    fun signIn(onEvent: (SignInEvent) -> Unit) {
        val run = ++signInRun
        if (!isConfigured) {
            onEvent(SignInEvent.Failed("this build has no Twitch Client ID"))
            return
        }
        executor.execute {
            try {
                val device = JSONObject(http.postForm(DEVICE_URL, mapOf("client_id" to clientId, "scopes" to SCOPES)).bodyOrThrow())
                val expiresIn = device.getInt("expires_in")
                onEvent(SignInEvent.Code(device.getString("user_code"), device.getString("verification_uri"), expiresIn))
                var interval = device.optInt("interval", 5)
                val deadline = clock() + expiresIn * 1000L
                while (clock() < deadline) {
                    sleep(interval * 1000L)
                    if (run != signInRun) return@execute
                    val response = http.postForm(
                        TOKEN_URL,
                        mapOf("client_id" to clientId, "scopes" to SCOPES, "device_code" to device.getString("device_code"), "grant_type" to DEVICE_GRANT),
                    )
                    if (response.status == 200) {
                        saveTokens(JSONObject(response.body))
                        validate()
                        onEvent(SignInEvent.Done(store.login.orEmpty()))
                        return@execute
                    }
                    when (messageOf(response)) {
                        "authorization_pending" -> Unit
                        "slow_down" -> interval += 5
                        // "invalid device code": it expired or the person declined.
                        else -> break
                    }
                }
                if (run == signInRun) onEvent(SignInEvent.Expired)
            } catch (e: Exception) {
                if (run == signInRun) onEvent(SignInEvent.Failed(e.message ?: "network error"))
            }
        }
    }

    fun cancelSignIn() {
        signInRun++
    }

    fun signOut() {
        val token = store.accessToken
        store.clear()
        if (token != null && isConfigured) {
            executor.execute { runCatching { http.postForm(REVOKE_URL, mapOf("client_id" to clientId, "token" to token)) } }
        }
    }

    /** GET https://api.twitch.tv/helix/[path]. An expired token is refreshed once and the call retried. */
    fun get(path: String, onDone: (HttpResponse) -> Unit) {
        executor.execute {
            val response = try {
                val token = store.accessToken
                val first = helix(path, token)
                if (first.status == 401 && token != null && refresh(token)) helix(path, store.accessToken) else first
            } catch (e: IOException) {
                HttpResponse(0, JSONObject().put("message", e.message ?: "network error").toString())
            }
            onDone(response)
        }
    }

    private fun helix(path: String, token: String?): HttpResponse {
        token ?: return HttpResponse(401, """{"message":"not signed in"}""")
        return http.request("GET", "$HELIX_URL/$path", null, mapOf("Client-Id" to clientId, "Authorization" to "Bearer $token"))
    }

    /**
     * Refresh tokens from a device sign-in work only once, so only one thread may spend it. A thread
     * that finds the token already replaced (another call refreshed it meanwhile) just retries.
     */
    private fun refresh(staleToken: String): Boolean = synchronized(tokenLock) {
        if (store.accessToken != staleToken) return store.accessToken != null
        val refreshToken = store.refreshToken ?: return false
        val response = http.postForm(TOKEN_URL, mapOf("client_id" to clientId, "grant_type" to "refresh_token", "refresh_token" to refreshToken))
        if (response.status != 200) {
            // Twitch refused the refresh (revoked, or the 30-day lifetime ran out): the account is signed out.
            if (response.status in 400..499) store.clear()
            return false
        }
        saveTokens(JSONObject(response.body))
        true
    }

    private fun validate() {
        val token = store.accessToken ?: return
        val info = JSONObject(http.request("GET", VALIDATE_URL, null, mapOf("Authorization" to "OAuth $token")).bodyOrThrow())
        store.login = info.getString("login")
        store.userId = info.getString("user_id")
    }

    private fun saveTokens(json: JSONObject) {
        store.accessToken = json.getString("access_token")
        json.optString("refresh_token").takeIf { it.isNotEmpty() }?.let { store.refreshToken = it }
    }

    private fun messageOf(response: HttpResponse): String = runCatching { JSONObject(response.body).optString("message") }.getOrDefault("")

    private fun HttpResponse.bodyOrThrow(): String = if (status in 200..299) body else throw IOException("HTTP $status: ${body.take(200)}")

    companion object {
        private const val SCOPES = "user:read:follows"
        private const val DEVICE_GRANT = "urn:ietf:params:oauth:grant-type:device_code"
        const val DEVICE_URL = "https://id.twitch.tv/oauth2/device"
        const val TOKEN_URL = "https://id.twitch.tv/oauth2/token"
        const val VALIDATE_URL = "https://id.twitch.tv/oauth2/validate"
        const val REVOKE_URL = "https://id.twitch.tv/oauth2/revoke"
        const val HELIX_URL = "https://api.twitch.tv/helix"
    }
}
