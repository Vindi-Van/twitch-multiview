# Contributing

Thanks for helping! Bug reports, device test results and pull requests are all welcome.

## Before you start

- **Bugs and ideas:** open an issue using the templates. For anything bigger than a small fix, open an issue first, so we can agree on the approach before you spend time on it.
- **Security problems:** report them privately (see [SECURITY.md](SECURITY.md)).
- **Read [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) first,** especially "Rules learned on real hardware". Several things that look harmless on a desktop (an overlay on a player, changing quality) break playback on a TV.

## Setting up

You need:

- JDK 21, the Android SDK (platform 36), and Node.js 22+ for the page's tests and lint.
- An Android TV device (or emulator) with Android 11 or newer. Four streams need a strong device; an NVIDIA Shield is the reference.
- A Twitch app Client ID, for sign-in, Following and Search. Register a **Public** client at [dev.twitch.tv/console/apps](https://dev.twitch.tv/console/apps): any name, OAuth redirect `http://localhost`. Then add it to `local.properties`, which git ignores:

  ```properties
  twitch.clientId=your_client_id
  ```

  Without it the app still builds and plays streams; sign-in is just turned off.

## Building and running

```sh
adb connect <tv-ip>:5555          # once per session, with network debugging on
./gradlew installDebug             # installs "Multiview (debug)" next to any release build
adb shell am start -n com.mojoedops.multiview.debug/com.mojoedops.multiview.MainActivity --es channels 'chan1,chan2'
```

The `channels` extra replaces the saved lineup, which is handy while developing. Debug builds can be inspected from `chrome://inspect` on your computer. The page's `console` output also goes to `adb logcat -s Multiview:*`.

## Checks

Run these before opening a pull request. CI runs the same:

```sh
./gradlew lintDebug testDebugUnitTest assembleDebug   # app: lint (warnings fail), unit tests, build
npm ci && npm run lint && npm test                     # page: ESLint and Node tests
```

## Code guidelines

- **Kotlin:** official Kotlin style (`.editorconfig` has the settings).
  - Keep Android out of the logic that can be tested: `TwitchAccount` takes its network, storage, threads and clock as parameters for that reason.
- **The page:** plain ES modules, no framework and no build step. The app serves `assets/` as-is.
  - Put logic that can be pure (no DOM) in its own module, and test it in `app/src/test/js/`.
  - Text from Twitch goes in as text (`h(tag, { text })`), never as HTML.
- **Comments say why, not what:** especially for the TV and Twitch quirks.
- **One concern per pull request,** with a clear description and how you tested it (device, OS, WebView version, number of streams).

## Releasing

Maintainers: see [docs/RELEASING.md](docs/RELEASING.md).
