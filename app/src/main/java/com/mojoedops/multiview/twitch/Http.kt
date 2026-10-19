package com.mojoedops.multiview.twitch

import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder

data class HttpResponse(val status: Int, val body: String)

/** The little HTTP the Twitch endpoints need, behind an interface so tests can fake it. Throws IOException when offline. */
fun interface Http {
    fun request(method: String, url: String, body: String?, headers: Map<String, String>): HttpResponse
}

fun Http.postForm(url: String, form: Map<String, String>): HttpResponse {
    val body = form.entries.joinToString("&") { (k, v) -> "$k=${URLEncoder.encode(v, "UTF-8")}" }
    return request("POST", url, body, mapOf("Content-Type" to "application/x-www-form-urlencoded"))
}

class UrlConnectionHttp(private val timeoutMs: Int = 10_000) : Http {
    override fun request(method: String, url: String, body: String?, headers: Map<String, String>): HttpResponse {
        val connection = URL(url).openConnection() as HttpURLConnection
        try {
            connection.requestMethod = method
            connection.connectTimeout = timeoutMs
            connection.readTimeout = timeoutMs
            headers.forEach { (k, v) -> connection.setRequestProperty(k, v) }
            if (body != null) {
                connection.doOutput = true
                connection.outputStream.use { it.write(body.toByteArray()) }
            }
            val status = connection.responseCode
            val stream = if (status in 200..299) connection.inputStream else connection.errorStream
            return HttpResponse(status, stream?.bufferedReader()?.use { it.readText() } ?: "")
        } finally {
            connection.disconnect()
        }
    }
}
