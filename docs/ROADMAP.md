# Roadmap

Where Multiview is heading. Nothing here has a date. To discuss any item, or to suggest a new one, open an issue.

## Now: 0.2.0

- **Twitch only:** up to four streams, focus and grid layouts, sign-in with a code, Following, Search, Top live, and chat.
- **Next step:** the first signed release on GitHub (see [RELEASING.md](RELEASING.md)), so the README's install steps work.

## Planned: YouTube

**Goal:** YouTube videos and live streams as tiles next to Twitch ones, in the same layouts, with OK still picking which one you hear.

### What has to change

1. **Each tile gets a source.** A tile becomes `{ source, id }` instead of a Twitch login, for example `{ source: 'youtube', id: '<video id>' }`. Lineups saved by 0.2 must keep working; `state.normalizeSaved` migrates them.
2. **Every source goes through one player interface.** `watch.js` should only need these calls: create a player, mute and unmute it, play it, and listen for playing, paused and ended or offline. `Twitch.Player` and the [YouTube IFrame Player API](https://developers.google.com/youtube/iframe_api_reference) each get a small adapter.
3. **The rules need re-checking.** The rules in [ARCHITECTURE.md](ARCHITECTURE.md#rules-learned-on-real-hardware) were learned with Twitch. Each one has to be re-checked for YouTube (YouTube's minimum player size is 200×200, for example), and each adapter documents its own quirks.
4. **Picking YouTube streams.** Start simple: type or paste a video link or a channel handle.
5. **A YouTube account, later.** Google's [sign-in for TVs](https://developers.google.com/youtube/v3/guides/auth/devices) works like Twitch's code sign-in, and the `youtube.readonly` scope gives Subscriptions.

### Questions to answer first, on a real TV

- **Does the YouTube player play in our WebView?** YouTube refuses embeds that send no referrer ("Error 153"). Our page is served from a real https origin, which should avoid that. Test four tiles mixing YouTube and Twitch.
- **How do we play a channel's live stream?** `youtube.com/embed/live_stream?channel=<channel id>` plays whatever a channel has live without an API call, but reports disagree on whether it still works.
- **Can the API quota cover everyone?** The YouTube Data API gives a project 10,000 units a day, shared by everyone using a release, and one search costs 100 units. That's about 100 searches a day for all users together. Search and "who's live" need a cheaper approach before a public release.
- **What does Google's app review require?** Find out what verification a public app needs for `youtube.readonly`.
- **How will ads and Premium work?** Google blocks signing in to a Google account inside an embedded WebView, so the YouTube players probably won't know about YouTube Premium, and ads would play as usual.
- **What happens when a video can't be embedded?** Some videos turn off embedding. The tile should say so instead of staying black.
- **What should the app be called?** "Multiview for Twitch", and the repository's name, stop fitting once there's a second source.

## Exploring: YouTube TV

YouTube TV is much harder, and may not fit how this app works.

- **Copy protection.** YouTube TV's channels are DRM-protected. A WebView only gets software-level Widevine (L3), which is what stopped Peacock and Paramount+ on-demand on the Shield. Whether tv.youtube.com plays at L3 in a WebView is untested.
- **Sign-in.** YouTube TV needs a Google sign-in in the page, which Google blocks in embedded WebViews. There's also no embeddable YouTube TV player or API.
- **The real app in a window.** On a Shield, the real apps can run side by side in freeform windows (a developer setting changed with adb), and protected video plays there. But one app can't mute another, so picking what you hear doesn't work, and the setup is too fiddly for most people.
- **YouTube TV's own Multiview.** The YouTube TV app already shows [up to four streams at once](https://support.google.com/youtubetv/answer/13418774), mostly for sports. It's worth checking whether that covers the need first.

**Next step:** test tv.youtube.com in a WebView on the Shield: does it sign in, and does it play? If either fails, YouTube TV stays out of scope, and the README points to YouTube TV's own Multiview instead.
