# Duo World — Interactive Brand Experience

## Overview

A mobile-first, vertical-orientation 3D mini-game website for Duo Design (digital garments company). Users scan a QR code from guerilla marketing campaigns, select an avatar wearing Duo Design looks, and explore a reactive urban world in third-person view. The experience culminates in a visual climax and personalized shareable content.

Target audience: broad (not necessarily fashion-aware), reached via street QR codes.

## User Flow

1. **QR scan → splash** — Duo Design logo, then straight to avatar selection
2. **Avatar selection** — Swipe between 3 avatars (one at a time, vertical layout). Tap to spin preview, tap again to confirm
3. **Exploration** — Third-person walk through a compact city block (~2-3 minutes). Reactive atmosphere changes per zone
4. **Photo spots** — Opt-in glowing markers. Tap to enter photo mode, cinematic camera angle, share/save
5. **Ending** — Nature reclaims the city, visual climax, brand video plays, personalized shareable generated
6. **Replay** — "Try another look?" loops back to avatar selection

## Controls

- **Floating joystick** — Touch anywhere on screen, that point becomes joystick center. Drag to set direction, release to stop
- **Camera** — Auto-follows behind avatar, no manual camera control needed
- **Photo spots** — Tap button when standing on a glowing marker

## The World

### Orientation & Camera

Fully vertical (portrait). Camera slightly above and behind the avatar, angled down to show the path ahead while keeping the avatar prominent.

### Layout

Linear path with bends and openings. Guided walk with slight lateral freedom. Not open-world.

### Zones

1. **Neon Alley** — Tight walls, neon signs (pink/purple), puddles with reflections. Nighttime mood.
2. **Open Plaza** — Wider space, golden hour lighting, long shadows, floating ember particles. Warm and calm.
3. **Rain Corridor** — Covered street with rain beyond edges. Cool blue tones, wet reflections, mist.
4. **Nature Finale** — Nature reclaims the city. Vines wrap buildings, flowers push through concrete, trees grow from walls. Elegant and lush (not chaotic). Warm ethereal glow, petals, fireflies.

### Transitions

Smooth atmospheric blends between zones — lighting fades, particles dissolve and reform. No hard cuts.

### Photo Spots

One per zone (3-4 total), placed at the most visually striking angles. Marked by subtle ground glow. User-activated only.

## Ending Sequence

1. **Transformation** — As avatar enters the nature zone, vines/flowers bloom in real-time around them. Neon and concrete fade under foliage. Soft greens, golden filtered light, petals and fireflies.
2. **Clearing** — Avatar reaches a tree-wrapped plaza, open sky above, city softened by nature in the background.
3. **Cinematic pull-out** — Camera slowly widens to a beauty shot of the avatar in the transformed world.
4. **Brand video** — Screen transitions (fade/blend) into user-provided brand video, fullscreen vertical.
5. **Reward** — Styled card: avatar composited into a journey beauty shot. Duo Design watermark (subtle). Share (native share sheet) + Save buttons.
6. **Replay hook** — "Try another look?" with a different avatar pre-highlighted.

## Technical Architecture

### Stack

- **React** — App shell, UI overlays (share buttons, avatar selection)
- **React Three Fiber** — 3D scene rendering, camera control
- **drei** — Environment maps, lighting, postprocessing helpers
- **three.js** — Shaders, particles, custom materials
- **zustand** — State management (zone, avatar, captures)

### 3D Assets

- **Avatars** — 3 GLTF models with baked walk animations, low-poly with good textures (mobile-optimized)
- **Environment** — Modular city pieces (wall segments, ground tiles, props) as GLTF, reused across zones
- **Neon/emissive** — Shader-based materials, not heavy geometry

### Mobile Performance Targets

- 30fps on mid-range phones
- LOD (level of detail) to reduce geometry at distance
- Compressed textures (KTX2/Basis)
- Baked lighting where possible, minimal dynamic lights per zone
- Particle counts capped per zone, fade when leaving

### Photo Capture

- Canvas snapshot via `renderer.domElement.toDataURL()`
- Brand watermark composited client-side (canvas overlay)
- Share via Web Share API (native mobile share sheet)

### Shareable Generation (Ending)

- Final beauty shot captured same as photo spots
- Brand video played via HTML5 `<video>` element overlaid on canvas
- Personalized image: avatar screenshot + stylized frame + Duo branding
