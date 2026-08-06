# EAS Build → TestFlight

How to build the iOS app with EAS and ship it to TestFlight, both locally and from CI.

## Prerequisites (one-time)

1. **Apple Developer Program** membership (paid) and access to App Store Connect.
2. **Create the app in App Store Connect** (bundle id `edu.gvsu.bluenucleus.pu`).
   - Grab its **App Store Connect App ID** (a numeric id, e.g. `6478912345`) — this is `ascAppId`.
   - Grab your **Apple Team ID** from https://developer.apple.com/account → Membership.
3. Fill both into [`eas.json`](../eas.json) under `submit.production.ios`, replacing the
   `REPLACE_WITH_*` placeholders.
4. Log in to EAS locally: `eas login`.
5. Let EAS manage your signing + submit credentials:
   ```bash
   eas credentials            # iOS → set up Distribution cert + provisioning profile
   ```
   For non-interactive submits (CI), also register an **App Store Connect API Key**
   (App Store Connect → Users and Access → Integrations → App Store Connect API).
   EAS stores it and reuses it automatically on `eas submit`.

## Local commands

Added to [`package.json`](../package.json):

| Script | What it does |
|---|---|
| `npm run build:ios` | Build a store-ready IPA with the `production` profile |
| `npm run build:ios:preview` | Build an internal-distribution IPA (`preview` profile) |
| `npm run submit:ios` | Submit the **latest** iOS build to TestFlight |
| `npm run testflight` | Build **and** auto-submit to TestFlight in one step |

Typical flow:

```bash
# one step: build, then submit the resulting binary to TestFlight
npm run testflight

# or two steps
npm run build:ios      # wait for the build to finish
npm run submit:ios     # submits --latest
```

`--auto-submit` uses the submit profile that matches the build profile
(`production` build → `production` submit).

> After a successful submit, the build appears in App Store Connect → TestFlight.
> Apple runs a processing pass (a few minutes) before it's installable, and
> external testing groups still require Beta App Review.

## CI: GitHub Actions

Workflow: [`.github/workflows/eas-testflight.yml`](../.github/workflows/eas-testflight.yml).

It builds iOS with the `production` profile and auto-submits to TestFlight. Triggers:

- **Manual** — Actions tab → *EAS Build & Submit to TestFlight* → *Run workflow*,
  then type `submit` in the confirmation box (guards against accidental runs).
- **On tag push** — pushing a `v*` tag (e.g. `git tag v1.0.1 && git push origin v1.0.1`).
  Because every `v*` tag ships to TestFlight, reserve those tags for real releases.

### Required secret

Add one repo secret (Settings → Secrets and variables → Actions):

- `EXPO_TOKEN` — a personal access token from https://expo.dev/accounts/[account]/settings/access-tokens

That token authorizes the CI runner to trigger EAS builds/submits. All Apple
signing + App Store Connect credentials stay on the EAS servers (set up in the
prerequisites above), so nothing else needs to live in GitHub.

### Notes

- The build itself runs on **EAS servers**, not the GitHub runner — the runner only
  kicks it off and streams logs, so the job is cheap.
- The iOS build number auto-increments because `autoIncrement: true` is set on the
  `production` build profile in [`eas.json`](../eas.json) — without it, two builds
  reuse the same build number and App Store Connect rejects the second upload.
  The marketing `version` in [`app.json`](../app.json) is still yours to manage.
