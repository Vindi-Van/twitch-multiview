## What and why

<!-- What does this change, and why? Link the issue: Fixes #123 -->

## How it was tested

<!-- Device and OS (e.g. NVIDIA Shield, Android 11, WebView 155), how many streams, which screens. -->

## Screenshots

<!-- For anything visible on the TV: before and after. `adb exec-out screencap -p > shot.png` works. -->

## Checklist

- [ ] `./gradlew lintDebug testDebugUnitTest assembleDebug` passes
- [ ] `npm run lint && npm test` passes
- [ ] Checked with the remote: D-pad, OK, hold OK and Back all still work
- [ ] Nothing is drawn over a Twitch player, and `setQuality` isn't called (see docs/ARCHITECTURE.md)
- [ ] No secrets, keystores or Client IDs committed
