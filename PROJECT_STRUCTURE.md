# Multi-App Structure

## Shared (cross-app)
- `shared/skills/`
  - Reusable thinking frameworks (TikTok strategy, hooks, momentum, analytics).
- `shared/memory/learnings.md`
  - Platform-level lessons and first-principles that should transfer across apps.
- `shared/memory/posting-times.md`
  - Shared distribution timing guidance.

## App-specific
- `apps/<app-name>/config.json`
  - App/runtime secrets and model settings.
- `apps/<app-name>/scripts/`
  - App execution scripts and rendering pipelines.
- `apps/<app-name>/memory/app-profile.md`
  - App identity, target user, positioning.
- `apps/<app-name>/memory/hook-log.md`
  - Per-app experiment history and outcomes.
- `apps/<app-name>/posts/`
  - Generated assets and app-specific output history.

## Why this split
- Keep app context isolated (profile, logs, assets) so each app can evolve independently.
- Keep strategy intelligence shared (skills + learnings) so every app benefits from the same mistakes/wins.
- Add a new app by cloning `apps/ai-fantasy-chat/` into a new app folder, then reusing `shared/` as-is.
