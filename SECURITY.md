# Security

## Reporting a vulnerability

Please report security problems privately through GitHub: go to the repository's **Security** tab, then **Report a vulnerability**. Don't open a public issue.

You'll get a reply as soon as the maintainer can, usually within a week. Please allow time for a fix to be released before you disclose anything.

## What's in scope

- The app's handling of the Twitch account: tokens are kept in the app's private storage and never reach the page.
- The page ↔ app bridge: only the app's own page may message the app (`addWebMessageListener` with a single allowed origin).
- Release integrity: released APKs are signed, and each release includes `SHA256SUMS`.

Problems in Twitch's own players, chat or website are for Twitch: https://hackerone.com/twitch
