# How Multiview works

Multiview is a small Android TV app that hosts one fullscreen WebView. The WebView shows a page bundled in the app, and that page shows up to four of Twitch's official embedded players.

```
┌─────────────────────────── Android app (Kotlin) ───────────────────────────┐
│ MainActivity       remote → mv.key(name); hosts the WebView                 │
│ PageBridge         the page's requests: account, API calls, menus, prompts  │
│ TwitchAccount      sign-in with a code, tokens, Helix GETs                  │
│ TvDialogs          native menu and text prompt                              │
│ PlayerSignInActivity  Twitch's own sign-in page, for the players' cookies   │
└───────────────▲───────────────────────────────────────────┬────────────────┘
   Native.postMessage (this page's origin only)    mv.native.reply / event
┌───────────────┴──────────── Page (assets/, ES modules) ───▼────────────────┐
│ main.js     start-up, routing        screens.js   screen switching, toast   │
│ watch.js    players, layout, chat    picker.js    Following/Search/Top/Acct │
│ signin.js   code + QR, player step    state.js     lineup, saved choices     │
│ layout.js   where things go (pure)   spatial.js   D-pad moves (pure)        │
│ format.js   names, numbers (pure)    bridge.js    the line to the app       │
└────────────────────────────────────────────────────────────────────────────┘
```

## The app

- **`MainActivity`** creates the WebView and serves the page from `assets/` on `https://appassets.androidplatform.net`. Twitch embeds need a real https parent domain.
- **The remote:** every remote key is turned into a name and forwarded as `mv.key('left' | 'right' | 'up' | 'down' | 'ok' | 'hold' | 'back' | 'play')`. The page never gets key focus itself, so a Twitch iframe can never trap the remote.
- **The OK key:** a short press sends `ok` and holding it sends `hold`.
- **Coming back to the app:** the page reloads each time the app returns from the background, so nothing keeps playing behind the launcher.
- **If the WebView's renderer process dies** (the Shield's renderer is 32-bit, and four players are heavy), the WebView is replaced and the page reloaded.

### The page ↔ app protocol

The page sends `{id, method, args}` with `Native.postMessage`. This is registered with `WebViewCompat.addWebMessageListener` for the app's own origin only, so Twitch's iframes and the ads inside them can't reach the app. Answers come back as `mv.native.reply(id, status, body)`, and sign-in progress arrives as `mv.native.event('signin', …)`. The full table is in [`PageBridge.kt`](../app/src/main/java/com/mojoedops/multiview/bridge/PageBridge.kt).

### The Twitch account

`TwitchAccount` signs in with the [device code flow](https://dev.twitch.tv/docs/authentication/getting-tokens-oauth/#device-code-grant-flow):
1. The TV shows a code and a QR.
2. The person approves it at twitch.tv/activate.
3. The app polls until Twitch answers.

The app is a **public client**, so it has no client secret. Its only scope is `user:read:follows`. Tokens are saved in the app's private SharedPreferences and never reach the page, which only sees API responses.

Refresh tokens from a device sign-in work **once**. The refresh is therefore serialized, and a call that finds the token already replaced by another call just retries with the new one.

The **player sign-in** is separate. The embedded players and chat only know you through twitch.tv's own cookie, so `PlayerSignInActivity` shows Twitch's sign-in page and closes once that cookie appears.

## The page

Each screen is a module that registers `{ enter, key, leave }` with `screens.js`:

- **watch:** the players, the info panel and chat.
- **picker:** a menu on the left (Following, Search, Top live, Account), cards in the middle, and the lineup tray at the bottom.
- **signin:** step 1 (code and QR) and step 2 (the player sign-in).

`layout.js`, `spatial.js`, `format.js` and `state.normalizeSaved` are pure, so they're unit tested in Node (`npm test`).

## Rules learned on real hardware

These come from testing on an NVIDIA Shield (Android 11, WebView 155). Breaking one usually breaks playback in a way that's hard to notice on a desktop.

1. **Nothing may be drawn over a player,** not even an invisible element. Twitch pauses an embed it thinks is covered ("Autoplay disabled… style visibility").
   - That's why the highlight is the tile's own 7px frame, and the info panel and chat only go in free space.
   - Native dialogs are fine, because the page can't see them.
2. **Players must stay at least 400×300.** That's Twitch's minimum embed size, and `layout.test.js` checks it for every layout.
3. **Tiles are positioned absolutely.** A layout change only moves and resizes them, because moving an iframe in the DOM reloads it (and replays the pre-roll ad).
4. **Players start muted.** Twitch won't autoplay with sound until someone clicks, but it does allow unmuting a stream that's already playing. The stream you hear is unmuted on `PLAYING`.
5. **Never call `setQuality`.** Doing it while an ad plays freezes that player on the ad screen for good ("Preparing your stream… Ad · 0:00"). This was reproduced on desktop Chrome too.
   - Twitch's `auto` quality already sizes each stream to its tile: about 480p small, 720p big, 1080p fullscreen.
6. **Players start 4 seconds apart.** Starting four at once crashed the Shield's renderer.
7. **A watchdog** resumes a player Twitch paused, and reloads one whose clock hasn't moved for three minutes.

## Layouts

| Streams | Without chat | With chat |
|---|---|---|
| 1 | full screen | stream top-left, chat on the right, info below |
| 2 | side by side, info along the bottom | 2×2: streams on top, chat under its stream, info under the other |
| 3 | 2×2, the fourth square shows info | the fourth square shows chat |
| 4 | focus (the one you hear big, three down the side, info below it) or a 2×2 grid | focus, with chat below the big stream |
