# Releasing

Releases are built by GitHub Actions ([`release.yml`](../.github/workflows/release.yml)) when a version tag is pushed. The workflow:
1. Builds the APK and signs it with the release key.
2. Writes a `SHA256SUMS` file.
3. Publishes a GitHub Release with generated notes.

## One-time setup

1. **Create the release signing key.** Do this once, and keep it forever: every future update must be signed with the same key, or it won't install over the previous version.

   ```sh
   keytool -genkeypair -v -keystore multiview-release.jks -alias multiview \
     -keyalg RSA -keysize 4096 -validity 36500
   ```

   Back up `multiview-release.jks` and its passwords somewhere safe and offline. Never commit it; `.gitignore` already excludes `*.jks`.

2. **Add the repository secrets** (Settings → Secrets and variables → Actions):

   | Secret | Value |
   |---|---|
   | `KEYSTORE_BASE64` | `base64 -i multiview-release.jks` (one line) |
   | `KEYSTORE_PASSWORD` | the keystore password |
   | `KEY_ALIAS` | `multiview` |
   | `KEY_PASSWORD` | the key password |
   | `TWITCH_CLIENT_ID` | the maintainer's Twitch app Client ID (public client), so released APKs can sign in |

   Without the signing secrets, the workflow still runs. It publishes a debug-signed APK as a *prerelease*, which can't update a signed install.

3. **Publish the certificate fingerprint** in the README's "Verify the download" section, so people can check an APK came from this repository:

   ```sh
   keytool -list -v -keystore multiview-release.jks -alias multiview | grep SHA256
   ```

## Each release

1. Update `CHANGELOG.md`: move the "Unreleased" items under the new version and date.
2. Add `fastlane/metadata/android/en-US/changelogs/<versionCode>.txt`. The versionCode for `vMAJOR.MINOR.PATCH` is `MAJOR*10000 + MINOR*100 + PATCH`; v0.2.0 is `200`.
3. Commit, then tag and push:

   ```sh
   git tag v0.2.0
   git push origin v0.2.0
   ```

4. Watch the Release workflow. When it finishes, check the release page has the APK and `SHA256SUMS`, and install the APK on a TV to smoke-test it.

The app's version comes from the tag (`APP_VERSION`); there's nothing to bump in Gradle.
