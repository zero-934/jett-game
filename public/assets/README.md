# jett.game — Asset Directory

Drop final art files here. Then set `ASSET_MODE = 'sprites'` in `src/shared/assetConfig.ts`.

## Structure
```
assets/
  jett/        — Jett game (player, jetpack, asteroids, space bg)
  shatter/     — Shatter Step (glass tiles, player, shards, bg)
  flap/        — Flap Fortune (wizard, broom, gates, castle bg)
  ui/          — Shared UI elements (buttons, coins, icons)
```

## Swapping an asset
1. Add your PNG to the correct folder
2. Update the path in `src/shared/assetConfig.ts`
3. Set `ASSET_MODE = 'sprites'`
4. Done — no game logic changes needed

## Recommended formats
- Characters/sprites: PNG with transparency, 2x resolution
- Backgrounds: PNG or WEBP, 390×844px (portrait mobile)
- Particles/FX: PNG spritesheet
