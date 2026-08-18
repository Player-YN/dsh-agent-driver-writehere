# Contributing

This repository is a **copy** of the WriteHERE driver carved out of a DeepSeek Harness checkout. Behavior changes belong in the source checkout first, then recopy.

## What this repo is

A DSH **bundle**: `cordis.patch.yml` plus four packages (agent-drivers, article-tree, writehere, ui-article-tree) and the `article-editor` preset.

## What this repo is not

- A fork of DeepSeek Harness
- A WeChat / typesetting / cover-image product
- A file-for-file clone of [principia-ai/WriteHERE](https://github.com/principia-ai/WriteHERE)

## Tests

Run them inside the harness workspace that this copy was taken from:

```sh
pnpm exec vitest run packages/extensions/writehere packages/extensions/article-tree packages/client/ui-article-tree
```

Standalone `vitest` in this folder will not resolve the harness testkit.

## Pull requests

Keep the editor loop free of model-facing tools. Retrieval and shell work stay on `preset: standard` workers.

## GitHub page (after the repo is public)

High-star DSH plugins are easy to scan: banner, one-line pitch, official `dsh plugin add` first, honest limits, real or labeled screenshots.

1. **Topics** (Settings → General → Topics): `dsh-plugin`, `dsh`, `deepseek-harness`, `writehere`, `agent-driver`, `long-form-writing`, `cordis`.
2. **Social preview** (Settings → General → Social preview): upload [`docs/og.png`](docs/og.png) (1280×640).
3. **Shields**: live `github/stars` and `last-commit` badges already point at `Player-YN/dsh-agent-driver-writehere`. Do not invent star counts.
4. **Marketplace**: this repo is a cordis bundle (`package.json` `dsh.bundle`). Root `install.ps1` / `install.sh` wrappers are convenience only; the official install is `dsh plugin add`.

Regenerate README images from the HTML sources:

```powershell
.\docs\render.ps1
```
