package com.mojoedops.multiview.twitch

import android.content.Context
import kotlin.properties.ReadWriteProperty
import kotlin.reflect.KProperty

/** Where the signed-in account lives between launches. */
interface TokenStore {
    var accessToken: String?
    var refreshToken: String?
    var login: String?
    var userId: String?
    fun clear()
}

/** The app's private SharedPreferences (only this app can read them). */
class PrefsTokenStore(context: Context) : TokenStore {
    private val prefs = context.getSharedPreferences("twitch", Context.MODE_PRIVATE)

    override var accessToken by pref("access")
    override var refreshToken by pref("refresh")
    override var login by pref("login")
    override var userId by pref("userId")

    override fun clear() {
        prefs.edit().clear().apply()
    }

    private fun pref(key: String) = object : ReadWriteProperty<Any?, String?> {
        override fun getValue(thisRef: Any?, property: KProperty<*>): String? = prefs.getString(key, null)
        override fun setValue(thisRef: Any?, property: KProperty<*>, value: String?) {
            prefs.edit().putString(key, value).apply()
        }
    }
}
