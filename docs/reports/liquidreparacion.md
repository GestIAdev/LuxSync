Summary of all changes
F1 — Split-brain (liquidEngine71 hardcode) ✅
SeleneLux.ts: Added _lastActiveLiquidEngine field (tracks the engine selected each frame including chill override) + getLastActiveLiquidEngine() public getter
TitanEngine.ts: Added getActiveLiquidEngine() delegator → nervousSystem.getLastActiveLiquidEngine()
TitanOrchestrator.ts: Removed hardcoded import { liquidEngine71 }. Frame loop now calls this.engine?.getActiveLiquidEngine() to get lastFrame/lastResult from the true active engine (4.1 or 7.1)
F2 — Unified dimmer source ✅
LiquidAetherAdapter.ts: Removed _routeImpactNodes method (and all supporting _impactValues/_impactScratch scaffolding). ImpactAdapter is now the sole writer of dimmer — no more HTP race
TitanOrchestrator.ts: Pre-computed _liqResult passed as 4th arg to impactAdapter.process()
F3 — Spatial falloff + bandMix elimination ✅
ImpactAdapter.ts: Removed all falloff math (dx/dy/dz/dist/falloff), removed computeBandMix. Zone routing changed from positional selectZoneIntensityXZ(px,pz) → semantic selectZoneFromResult(result, node.zoneId). Formula: dimmer = clamp01(zoneIntensity × globalVibe). All fixtures in the same zone receive identical values
LiquidAetherAdapter.ts: Removed computeEpicenterFalloff from _routeMoodToColorIntensity. Brightness now clamp01(moodIntensity × zoneIntensity)
F4 — Purge residual averages ✅
zoneUtils.ts (selectZoneFromResult): Added compound zones (front, back, left, right), unassigned/center/mid → ambientIntensity, default → 0 (no invented energy)
LiquidAetherAdapter.ts: Deleted average9Zones() helper and _selectReactiveZoneIntensity() method. Now uses selectZoneFromResult directly (single source of truth)
F5 — UI switch 4.1/7.1 ✅
Backend now correctly responds to the switch. The button at HyperionView.tsx was already wired; F1 makes it functionally meaningful.