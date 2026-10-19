package com.mojoedops.multiview.bridge

import com.mojoedops.multiview.twitch.FakeHttp
import com.mojoedops.multiview.twitch.MemoryTokenStore
import com.mojoedops.multiview.twitch.SignInEvent
import com.mojoedops.multiview.twitch.TwitchAccount
import com.mojoedops.multiview.twitch.TwitchAccount.Companion.HELIX_URL
import com.mojoedops.multiview.twitch.directExecutor
import com.mojoedops.multiview.twitch.ok
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class PageBridgeTest {
    private class FakeHost : PageBridge.Host {
        val replies = mutableListOf<Triple<Int, Int, String>>()
        val events = mutableListOf<Pair<String, JSONObject>>()
        var promptAnswer: String? = null
        var menuAnswer = -1
        var lastMenu: Pair<String, List<String>>? = null
        var playerCookie = false
        var exited = false
        var playerSignInOpened = false
        var playerCleared = false

        override fun reply(id: Int, status: Int, body: String) {
            replies += Triple(id, status, body)
        }

        override fun event(name: String, data: JSONObject) {
            events += name to data
        }

        override fun prompt(title: String, initial: String, hint: String, onDone: (String?) -> Unit) = onDone(promptAnswer)

        override fun menu(title: String, items: List<String>, onDone: (Int) -> Unit) {
            lastMenu = title to items
            onDone(menuAnswer)
        }

        override fun playerSignedIn() = playerCookie

        override fun openPlayerSignIn() {
            playerSignInOpened = true
        }

        override fun clearPlayerSignIn() {
            playerCleared = true
        }

        override fun exit() {
            exited = true
        }
    }

    private val http = FakeHttp()
    private val store = MemoryTokenStore()
    private val host = FakeHost()

    private fun bridge(clientId: String = "client") =
        PageBridge(TwitchAccount(clientId, http, store, directExecutor, sleep = {}, clock = { 0L }), host)

    @Test
    fun `account reports who is signed in and what this build can do`() {
        store.login = "viewer"
        store.userId = "42"
        host.playerCookie = true

        assertTrue(bridge().onMessage("""{"id":1,"method":"account","args":[]}"""))

        val (id, status, body) = host.replies.single()
        val json = JSONObject(body)
        assertEquals(1, id)
        assertEquals(200, status)
        assertEquals("viewer", json.getString("login"))
        assertEquals("42", json.getString("userId"))
        assertTrue(json.getBoolean("player"))
        assertTrue(json.getBoolean("signInAvailable"))
        assertFalse(JSONObject(bridge(clientId = "").accountJson().toString()).getBoolean("signInAvailable"))
    }

    @Test
    fun `api passes Twitch's status and body straight back`() {
        store.accessToken = "token"
        http.on("$HELIX_URL/streams/followed", ok("""{"data":[{"user_login":"a"}]}"""))

        bridge().onMessage("""{"id":7,"method":"api","args":["streams/followed?user_id=42"]}""")

        assertEquals(Triple(7, 200, """{"data":[{"user_login":"a"}]}"""), host.replies.single())
    }

    @Test
    fun `menu replies with the chosen index`() {
        host.menuAnswer = 2

        bridge().onMessage("""{"id":3,"method":"menu","args":["xqc",["Listen","Hide chat","Remove"]]}""")

        assertEquals("xqc" to listOf("Listen", "Hide chat", "Remove"), host.lastMenu)
        assertEquals(Triple(3, 200, "2"), host.replies.single())
    }

    @Test
    fun `prompt replies with the text, or status 0 when cancelled`() {
        host.promptAnswer = "dota"
        bridge().onMessage("""{"id":4,"method":"prompt","args":["Search","",""]}""")
        host.promptAnswer = null
        bridge().onMessage("""{"id":5,"method":"prompt","args":["Search","dota","hint"]}""")

        assertEquals(listOf(Triple(4, 200, "dota"), Triple(5, 0, "")), host.replies)
    }

    @Test
    fun `sign out clears the account and the players' sign-in`() {
        store.accessToken = "token"
        store.login = "viewer"

        bridge(clientId = "").onMessage("""{"id":9,"method":"signOut"}""")

        assertEquals(null, store.login)
        assertTrue(host.playerCleared)
        assertEquals(9, host.replies.single().first)
    }

    @Test
    fun `sign-in progress goes to the page as events`() {
        bridge(clientId = "").onMessage("""{"id":0,"method":"signIn"}""")

        val (name, data) = host.events.single()
        assertEquals("signin", name)
        assertEquals("error", data.getString("state"))
    }

    @Test
    fun `sign-in events become the JSON the page expects`() {
        val code = SignInEvent.Code("ABCD", "https://www.twitch.tv/activate", 1800).toJson()
        assertEquals("code", code.getString("state"))
        assertEquals("ABCD", code.getString("userCode"))
        assertEquals(1800, code.getInt("expiresIn"))
        assertEquals("viewer", SignInEvent.Done("viewer").toJson().getString("login"))
        assertEquals("expired", SignInEvent.Expired.toJson().getString("state"))
    }

    @Test
    fun `navigation requests reach the host`() {
        bridge().onMessage("""{"method":"playerSignIn"}""")
        bridge().onMessage("""{"method":"exit"}""")

        assertTrue(host.playerSignInOpened)
        assertTrue(host.exited)
    }

    @Test
    fun `unknown or malformed messages are refused`() {
        assertFalse(bridge().onMessage("not json"))
        assertFalse(bridge().onMessage("""{"id":1,"method":"deleteEverything"}"""))
        assertTrue(host.replies.isEmpty())
    }
}
