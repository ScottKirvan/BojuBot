# Beta Builds

Beta builds let you try changes before they reach the Obsidian community plugin list. A new beta is published automatically whenever the plugin changes on the main branch, so betas are newer than the latest release and less tested.

Pages and sections marked <Badge type="warning" text="Beta" /> in this guide describe features that are only in beta builds so far.

## Installing a beta

Betas are installed with [BRAT](https://tfthacker.com/BRAT) (Beta Reviewers Auto-update Tool), a community plugin for testing other plugins.

1. In Obsidian, open **Settings** > **Community plugins**, then browse for **BRAT**, install it and enable it.
2. Open the command palette and run **BRAT: Add a beta plugin for testing**.
3. Enter `ScottKirvan/BojuBot` and confirm.

BRAT installs the newest beta and keeps it up to date. To check for a newer one, run **BRAT: Check for updates to all beta plugins and UPDATE**.

::: tip
To stay on one particular build, run **BRAT: Add a beta plugin with frozen version based on a release tag** instead, and enter the beta's version, for example `3.8.0-beta.2`. Betas are listed on the [releases page](https://github.com/ScottKirvan/BojuBot/releases).
:::

## Going back to the stable version

When a release ships, update through BRAT. Obsidian's own updater doesn't move you from a beta to the release with the same version number (from `3.8.0-beta.2` to `3.8.0`, for example).

To leave the beta program, remove BojuBot from BRAT's list in **Settings** > **BRAT**, then reinstall BojuBot from **Community plugins**.

## Reporting problems

[Report a bug](https://github.com/ScottKirvan/BojuBot/issues/new?template=bug_report.md) and include the beta version from **Settings** > **Community plugins**, next to BojuBot's name.
