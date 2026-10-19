package com.mojoedops.multiview

import android.view.KeyEvent

/**
 * The page's names for remote keys. OK is not here: MainActivity handles it itself, to tell a
 * press ("ok") from a hold ("hold").
 */
fun remoteKeyName(keyCode: Int): String? = when (keyCode) {
    KeyEvent.KEYCODE_DPAD_LEFT -> "left"
    KeyEvent.KEYCODE_DPAD_RIGHT -> "right"
    KeyEvent.KEYCODE_DPAD_UP -> "up"
    KeyEvent.KEYCODE_DPAD_DOWN -> "down"
    KeyEvent.KEYCODE_BACK -> "back"
    KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE, KeyEvent.KEYCODE_MEDIA_PLAY -> "play"
    else -> null
}

fun isOkKey(keyCode: Int): Boolean = keyCode == KeyEvent.KEYCODE_DPAD_CENTER || keyCode == KeyEvent.KEYCODE_ENTER

/** Arrows act on press (and repeat while held); Back and Play act on release. */
fun actsOnPress(name: String): Boolean = name in setOf("left", "right", "up", "down")
