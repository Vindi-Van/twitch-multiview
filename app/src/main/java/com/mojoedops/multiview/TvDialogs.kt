package com.mojoedops.multiview

import android.app.Activity
import android.app.AlertDialog
import android.text.InputType
import android.view.WindowManager
import android.view.inputmethod.EditorInfo
import android.widget.EditText

/** Native dialogs the page asks for: a page inside a TV WebView can't do these well. */
object TvDialogs {
    /** A list of choices; [onDone] gets the chosen index, or -1 if the person backs out. */
    fun menu(activity: Activity, title: String, items: List<String>, onDone: (Int) -> Unit) {
        var chosen = -1
        AlertDialog.Builder(activity, android.R.style.Theme_DeviceDefault_Dialog_Alert)
            .setTitle(title)
            .setItems(items.toTypedArray()) { _, which -> chosen = which }
            .setOnDismissListener { onDone(chosen) }
            .show()
    }

    /** A one-line text prompt on the TV keyboard (which has a mic key); [onDone] gets the text, or null if cancelled. */
    fun prompt(activity: Activity, title: String, initial: String, hint: String, onDone: (String?) -> Unit) {
        val input = EditText(activity).apply {
            setText(initial)
            setSelection(initial.length)
            this.hint = hint
            isSingleLine = true
            inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_FLAG_NO_SUGGESTIONS
            imeOptions = EditorInfo.IME_ACTION_SEARCH
        }
        var result: String? = null
        val dialog = AlertDialog.Builder(activity, android.R.style.Theme_DeviceDefault_Dialog_Alert)
            .setTitle(title)
            .setView(input)
            .setPositiveButton(android.R.string.ok) { _, _ -> result = input.text.toString() }
            .setNegativeButton(android.R.string.cancel, null)
            .setOnDismissListener { onDone(result) }
            .create()
        input.setOnEditorActionListener { _, _, _ ->
            result = input.text.toString()
            dialog.dismiss()
            true
        }
        dialog.window?.setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_STATE_ALWAYS_VISIBLE)
        dialog.show()
        input.requestFocus()
    }
}
