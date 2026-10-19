package com.mojoedops.multiview.twitch

import java.io.IOException
import java.util.concurrent.Executor

/** Runs work on the calling thread, so tests see results immediately. */
val directExecutor = Executor { it.run() }

class MemoryTokenStore : TokenStore {
    override var accessToken: String? = null
    override var refreshToken: String? = null
    override var login: String? = null
    override var userId: String? = null

    override fun clear() {
        accessToken = null
        refreshToken = null
        login = null
        userId = null
    }
}

/** Answers each URL with scripted responses in order, and records every request. */
class FakeHttp : Http {
    data class Call(val method: String, val url: String, val body: String?, val headers: Map<String, String>)

    val calls = mutableListOf<Call>()
    private val scripts = mutableMapOf<String, ArrayDeque<(Call) -> HttpResponse>>()

    fun on(urlPrefix: String, vararg responses: HttpResponse) = apply {
        responses.forEach { response -> script(urlPrefix) { response } }
    }

    fun script(urlPrefix: String, handler: (Call) -> HttpResponse) = apply {
        scripts.getOrPut(urlPrefix) { ArrayDeque() }.addLast(handler)
    }

    fun failWith(urlPrefix: String) = script(urlPrefix) { throw IOException("offline") }

    fun callsTo(urlPrefix: String) = calls.filter { it.url.startsWith(urlPrefix) }

    override fun request(method: String, url: String, body: String?, headers: Map<String, String>): HttpResponse {
        val call = Call(method, url, body, headers)
        calls += call
        val queue = scripts.entries.firstOrNull { url.startsWith(it.key) }?.value
        val handler = queue?.removeFirstOrNull() ?: error("unexpected request: $method $url")
        return handler(call)
    }
}

fun ok(json: String) = HttpResponse(200, json)
fun status(code: Int, json: String = "{}") = HttpResponse(code, json)
