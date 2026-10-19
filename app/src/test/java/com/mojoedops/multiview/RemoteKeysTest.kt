package com.mojoedops.multiview

import android.view.KeyEvent
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class RemoteKeysTest {
    @Test
    fun `remote keys get the page's names`() {
        assertEquals("left", remoteKeyName(KeyEvent.KEYCODE_DPAD_LEFT))
        assertEquals("right", remoteKeyName(KeyEvent.KEYCODE_DPAD_RIGHT))
        assertEquals("up", remoteKeyName(KeyEvent.KEYCODE_DPAD_UP))
        assertEquals("down", remoteKeyName(KeyEvent.KEYCODE_DPAD_DOWN))
        assertEquals("back", remoteKeyName(KeyEvent.KEYCODE_BACK))
        assertEquals("play", remoteKeyName(KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE))
        assertEquals("play", remoteKeyName(KeyEvent.KEYCODE_MEDIA_PLAY))
    }

    @Test
    fun `other keys are left to the system`() {
        assertNull(remoteKeyName(KeyEvent.KEYCODE_HOME))
        assertNull(remoteKeyName(KeyEvent.KEYCODE_VOLUME_UP))
    }

    @Test
    fun `OK is handled on its own, to tell a press from a hold`() {
        assertTrue(isOkKey(KeyEvent.KEYCODE_DPAD_CENTER))
        assertTrue(isOkKey(KeyEvent.KEYCODE_ENTER))
        assertNull(remoteKeyName(KeyEvent.KEYCODE_DPAD_CENTER))
    }

    @Test
    fun `arrows act on press, everything else on release`() {
        assertTrue(actsOnPress("left"))
        assertFalse(actsOnPress("back"))
        assertFalse(actsOnPress("play"))
    }
}
