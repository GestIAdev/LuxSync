Chronos Integration Analysis — Complete Data Flow
Architecture Overview
Chronos is the timeline editor and playback system in LuxSync. It has two distinct runtime paths:

Frontend (Renderer) Path: ChronosEngine → ChronosInjector → ChronosIPCBridge → IPC → Backend
Backend (Main) Path: useScenePlayer → IPC lux:playback:tick → TimelineEngine → ChronosAetherAdapter → Aether Arbiter → DMX
Path 1: Frontend — ChronosEngine → Injector → IPC Bridge
ChronosEngine (ChronosEngine.ts)
The in-memory runtime model for the Chronos editor (Zustand store-driven).
Runs a requestAnimationFrame tick loop, generates ChronosContext on each frame.
ChronosContext contains: vibeOverride, intensityOverride, zoneOverrides, colorOverride, activeEffects, automationValues, overrideMode.
Supports external clock sources (MIDI, LTC, MTC, ArtNet timecode) via ClockSourceManager.
Emits playback:tick events that downstream components subscribe to.
ChronosInjector (ChronosInjector.ts)
Translates ChronosContext → ChronosOverrides for Titan.
Processes: forced vibes, modulators, effect triggers, zone overrides, color overrides.
Override modes:
'whisper' — Chronos suggests, Titan refines (soft merge)
'full' — Chronos dictates (hard override)
applyToMusicalContext() merges overrides into Titan's MusicalContext.
Manages effect instance lifecycle: registerEffectInstance() / unregisterEffectInstance().
Emits StageCommand events (vibe changes, FX triggers/stops, intensity changes).
ChronosIPCBridge (ChronosIPCBridge.ts)
Subscribes to ChronosInjector stage commands.
Routes commands via IPC to backend:
'vibe-change' → window.lux.stage.changeVibe()
'fx-trigger' → window.lux.stage.triggerFX() (with Hephaestus custom FX support)
'fx-stop' → window.lux.stage.stopFX()
'intensity-change' → window.lux.stage.setIntensity()
Handles heph-custom clips with inline diamond data for Hephaestus automation.
FXMapper (FXMapper.ts)
Maps timeline FX types (strobe, flash, drop, sweep, etc.) to BaseEffect IDs from EffectRegistry.
Passthrough mode: If the FX type is already a valid BaseEffect ID, returns as-is.
Vibe-specific variants: e.g., strobe maps to industrial_strobe under techno-club vibe, but strobe_storm under fiesta-latina.
Path 2: Backend — ScenePlayer → TimelineEngine → Aether
useScenePlayer (useScenePlayer.ts)
Dumb frontend remote — no lighting physics, no effect classes, no color conversion.
Manages <audio> element (load, play, pause, seek) with silent mode fallback via performance.now().
Runs requestAnimationFrame clock, sends lux:playback:tick(timeMs) to backend every frame.
On scene load: calls window.lux.playback.load(project) to send LuxProject to backend TimelineEngine.
Also syncs fixtures from stageStore to backend Arbiter via window.lux.stage.syncFixtures().
Used by SceneBrowser.tsx in the Hyperion view for scene import and playback.
TimelineEngine (TimelineEngine.ts)
Backend playback engine running in Electron Main process.
Receives tick(timeMs) calls from the frontend useScenePlayer.
Processes FX clips and vibe clips against the loaded LuxProject.
Builds a sparse frame accumulator — only fixtures touched by active effects are overridden; untouched fixtures remain under Titan/Selene control.
Each PlaybackTarget includes: dimmer, color (RGB/CMY), pan/tilt/speed, zoom, shutter, blendMode.
Color latch: Caches last positive color per fixture to prevent flicker on mechanical color wheels.
Supports HephAutomationClipV3 custom clips with diamond data for Hephaestus integration.
Produces PlaybackFrame containing: targets, hasActiveVibe, vibeId, tickMs.
ChronosAetherAdapter (ChronosAetherAdapter.ts)
Converts TimelineEngine playback frames into Aether node intents for arbitration.
Indexes nodes by family: IMPACT, COLOR, KINETIC, BEAM, ATMOSPHERE.
Normalizes DMX values (0-255 → 0-1) for Aether's normalized coordinate space.
Intent metadata: priority=200, source='chronos', confidence=1.0.
Emits intents for: dimmer, shutter, color channels, pan/tilt/speed, zoom.
Calls arbiter.setPlaybackIntents() to inject into the arbitration pipeline.
Clears intents when playback stops or no snapshot is available.
TickEngine Integration (src/core/orchestrator/tick/TickEngine.ts:1003-1008)
Step 4.5 in the main tick loop: ChronosAetherAdapter.ingest(timelineEngine, deltaMs, aetherArbiter).
Runs after Selene adapter (Step 4) and before Hephaestus adapter (Step 5).
The arbiter then unifies all intent sources: system intents, effect intents, playback intents, Hephaestus intents.
aetherArbiter.arbitrate() produces the final ArbitratedNodeMap → DMX output.
Data Serialization
LuxProject (ChronosProject.ts)
The serializable .lux file format (version 2.0).
Contains: ProjectMeta, ProjectAudio, ProjectTimeline (clips, playhead, viewport), ProjectLibrary.
Distinct from the runtime ChronosProject type in types.ts (which is the in-memory editing model).
TimelineClip (TimelineClip.ts)
Two clip types: VibeClip (mood regions) and FXClip (effects with keyframes).
VibeType: fiesta-latina, techno-club, chill-lounge, pop-rock, idle.
FXType: strobe, sweep, pulse, chase, fade, blackout, color-wash, intensity-ramp, heph-custom.
Supports HephAutomationClipV3 for Hephaestus custom automation clips.
EffectRegistry (EffectRegistry.ts)
Central registry of all real lighting effects.
Defines: effect ID, display name, icon, color, category, mixBus (global, htp, ambient, accent), tags, zones.
Used by FXMapper for FX type → BaseEffect ID mapping.
Used by UI for the Arsenal Dock effect grid.
Complete Data Flow Diagram


┌─── FRONTEND (Renderer) ───────────────────────────────────────────┐
│                                                                    │
│  ChronosEditor (ChronosLayout.tsx)                                 │
│       │                                                            │
│       ▼                                                            │
│  ChronosEngine.ts  ──rAF──▶  ChronosContext                        │
│       │                            │                               │
│       │                            ▼                               │
│       │              ChronosInjector.ts                            │
│       │                 │  (ChronosContext → ChronosOverrides)     │
│       │                 │  (whisper / full override modes)         │
│       │                 ├──▶ applyToMusicalContext() ──▶ Titan     │
│       │                 └──▶ StageCommand events                   │
│       │                            │                               │
│       │                            ▼                               │
│       │              ChronosIPCBridge.ts                           │
│       │                 │  (vibe-change, fx-trigger, fx-stop,      │
│       │                 │   intensity-change)                      │
│       │                 ▼                                          │
│       │              IPC → window.lux.stage.*                      │
│       │                                                            │
│  useScenePlayer.ts (dumb remote)                                   │
│       │  lux:playback:load(project)                                │
│       │  lux:playback:tick(timeMs)  ──rAF──▶ every frame           │
│       │  lux:playback:stop()                                       │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
                         │ IPC (Electron)
                         ▼
┌─── BACKEND (Main Process) ─────────────────────────────────────────┐
│                                                                    │
│  TimelineEngine.ts                                                 │
│       │  tick(timeMs)                                              │
│       │  Processes FX clips + vibe clips                           │
│       │  Builds sparse frame accumulator                           │
│       │  Color latch for mechanical wheels                         │
│       │  Supports HephAutomationClipV3                             │
│       │                                                            │
│       ▼  PlaybackFrame (targets, vibeId, tickMs)                  │
│  ChronosAetherAdapter.ts                                           │
│       │  Converts frame → Aether node intents                      │
│       │  priority=200, source='chronos', confidence=1.0            │
│       │  Normalizes DMX 0-255 → 0-1                               │
│       │                                                            │
│       ▼  arbiter.setPlaybackIntents()                              │
│  TickEngine.ts (Step 4.5)                                          │
│       │  Also: SeleneAdapter (Step 4)                              │
│       │  Also: HephaestusAdapter (Step 5)                          │
│       │                                                            │
│       ▼  aetherArbiter.arbitrate()                                 │
│  ArbitratedNodeMap → PhysicsPostProcessor → Safety → DMX          │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
Key Design Patterns
Sparse Frame Accumulator: Only fixtures touched by active Chronos effects are overridden. Untouched fixtures remain under Titan/Selene control. This allows Chronos and live AI control to coexist.
Layered Override Modes: 'whisper' lets Chronos suggest while Titan refines; 'full' gives Chronos dictatorial control.
Dumb Frontend / Smart Backend: useScenePlayer is intentionally minimal — all lighting physics, effect processing, and DMX math live in the backend TimelineEngine.
Dual Runtime Paths: The frontend ChronosEngine path (for live stage simulation during editing) and the backend TimelineEngine path (for actual DMX output during scene playback) coexist but serve different purposes.
FX Mapping with Vibe Awareness: FXMapper resolves timeline FX types to concrete BaseEffect IDs, with vibe-specific variants for aesthetic matching.
Effect MixBus Routing: Effects are categorized by mixBus (global, htp, ambient, accent) for routing in the audio mixing metaphor.