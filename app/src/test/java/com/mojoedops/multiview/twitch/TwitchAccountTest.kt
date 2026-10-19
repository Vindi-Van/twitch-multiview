package com.mojoedops.multiview.twitch

import com.mojoedops.multiview.twitch.TwitchAccount.Companion.DEVICE_URL
import com.mojoedops.multiview.twitch.TwitchAccount.Companion.HELIX_URL
import com.mojoedops.multiview.twitch.TwitchAccount.Companion.TOKEN_URL
import com.mojoedops.multiview.twitch.TwitchAccount.Companion.VALIDATE_URL
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class TwitchAccountTest {
    private val http = FakeHttp()
    private val store = MemoryTokenStore()
    private var now = 0L
    private val sleeps = mutableListOf<Long>()
    private val events = mutableListOf<SignInEvent>()

    private fun account(clientId: String = "client", sleep: (Long) -> Unit = {}) = TwitchAccount(
        clientId = clientId,
        http = http,
        store = store,
        executor = directExecutor,
        sleep = { ms -> sleeps += ms; now += ms; sleep(ms) },
        clock = { now },
    )

    private fun device(expiresIn: Int = 1800) = ok(
        """{"device_code":"dev","expires_in":$expiresIn,"interval":5,"user_code":"ABCDEFGH","verification_uri":"https://www.twitch.tv/activate?device-code=ABCDEFGH"}""",
    )

    private val pending = status(400, """{"status":400,"message":"authorization_pending"}""")
    private val tokens = ok("""{"access_token":"access","refresh_token":"refresh","expires_in":14000}""")
    private val user = ok("""{"login":"viewer","user_id":"42","scopes":["user:read:follows"]}""")

    @Test
    fun `sign-in shows the code, waits while pending, then signs in`() {
        http.on(DEVICE_URL, device()).on(TOKEN_URL, pending, tokens).on(VALIDATE_URL, user)

        account().signIn { events += it }

        assertEquals(
            listOf(SignInEvent.Code("ABCDEFGH", "https://www.twitch.tv/activate?device-code=ABCDEFGH", 1800), SignInEvent.Done("viewer")),
            events,
        )
        assertEquals(listOf(5000L, 5000L), sleeps)
        assertEquals("access", store.accessToken)
        assertEquals("refresh", store.refreshToken)
        assertEquals("42", store.userId)
        assertTrue(http.callsTo(TOKEN_URL).all { "device_code=dev" in it.body.orEmpty() })
    }

    @Test
    fun `slow_down makes it poll five seconds slower`() {
        http.on(DEVICE_URL, device())
            .on(TOKEN_URL, status(400, """{"message":"slow_down"}"""), tokens)
            .on(VALIDATE_URL, user)

        account().signIn { events += it }

        assertEquals(listOf(5000L, 10000L), sleeps)
        assertEquals(SignInEvent.Done("viewer"), events.last())
    }

    @Test
    fun `a declined code ends with Expired and saves nothing`() {
        http.on(DEVICE_URL, device()).on(TOKEN_URL, status(400, """{"message":"invalid device code"}"""))

        account().signIn { events += it }

        assertEquals(SignInEvent.Expired, events.last())
        assertNull(store.accessToken)
    }

    @Test
    fun `a code that runs out of time ends with Expired`() {
        http.on(DEVICE_URL, device(expiresIn = 10)).on(TOKEN_URL, pending, pending)

        account().signIn { events += it }

        assertEquals(SignInEvent.Expired, events.last())
        assertEquals(2, http.callsTo(TOKEN_URL).size)
    }

    @Test
    fun `cancelling stops the waiting`() {
        http.on(DEVICE_URL, device())
        lateinit var account: TwitchAccount
        account = account(sleep = { account.cancelSignIn() })

        account.signIn { events += it }

        assertEquals(1, events.size)
        assertTrue(http.callsTo(TOKEN_URL).isEmpty())
    }

    @Test
    fun `without a Client ID sign-in fails at once, offline`() {
        val account = account(clientId = "")

        account.signIn { events += it }

        assertEquals(false, account.isConfigured)
        assertTrue(events.single() is SignInEvent.Failed)
        assertTrue(http.calls.isEmpty())
    }

    @Test
    fun `an expired token is refreshed once and the call retried`() {
        store.accessToken = "old"
        store.refreshToken = "refresh-1"
        http.on("$HELIX_URL/streams", status(401), ok("""{"data":[]}"""))
            .on(TOKEN_URL, ok("""{"access_token":"new","refresh_token":"refresh-2"}"""))
        var result: HttpResponse? = null

        account().get("streams?user_login=a") { result = it }

        assertEquals(200, result?.status)
        assertEquals("new", store.accessToken)
        assertEquals("refresh-2", store.refreshToken)
        assertEquals("Bearer new", http.callsTo(HELIX_URL).last().headers["Authorization"])
    }

    @Test
    fun `a refused refresh signs the account out`() {
        store.accessToken = "old"
        store.refreshToken = "spent"
        store.login = "viewer"
        http.on("$HELIX_URL/streams", status(401)).on(TOKEN_URL, status(400, """{"message":"Invalid refresh token"}"""))
        var result: HttpResponse? = null

        account().get("streams") { result = it }

        assertEquals(401, result?.status)
        assertNull(store.accessToken)
        assertNull(store.login)
    }

    @Test
    fun `a token another call already refreshed is not refreshed again`() {
        // The refresh token works once, so spending it twice would sign the account out.
        store.accessToken = "old"
        store.refreshToken = "refresh"
        http.script("$HELIX_URL/streams") {
            store.accessToken = "fresh"  // another request refreshed meanwhile
            status(401)
        }.on("$HELIX_URL/streams", ok("""{"data":[]}"""))
        var result: HttpResponse? = null

        account().get("streams") { result = it }

        assertEquals(200, result?.status)
        assertTrue(http.callsTo(TOKEN_URL).isEmpty())
        assertEquals("Bearer fresh", http.callsTo(HELIX_URL).last().headers["Authorization"])
    }

    @Test
    fun `being offline is reported as status 0`() {
        store.accessToken = "token"
        http.failWith("$HELIX_URL/streams")
        var result: HttpResponse? = null

        account().get("streams") { result = it }

        assertEquals(0, result?.status)
    }

    @Test
    fun `not signed in answers 401 without a request`() {
        var result: HttpResponse? = null

        account().get("streams") { result = it }

        assertEquals(401, result?.status)
        assertTrue(http.calls.isEmpty())
    }
}
