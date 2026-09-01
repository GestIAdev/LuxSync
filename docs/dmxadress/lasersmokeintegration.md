

---

# NATIVE LASER & ATMOSPHERE TAXONOMY AUDIT — WAVE 7735

**Status:** READ-ONLY audit. No code modified.
**Scope:** Channel type enums, Fixture Forge UI sidebar, Aether Cell admittance, HAL/NodeResolver atmosphere handling, AtmosphereSystem/Adapter semantic gap.

---

## SECTION 1 — Channel Type Enum Audit

### 1.1 The Three Parallel Type Definitions

The codebase has **three separate but aligned** channel type definitions that must all be expanded in lockstep:

| File | Type Name | Role | Lines |
|------|-----------|------|-------|
| `types/FixtureDefinition.ts` | `ChannelType` | **Source of truth** — fixture library JSON contract | <ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\types\FixtureDefinition.ts" lines="8-47" /> |
| `core/arbiter/types.ts` | `ChannelType` (legacy) | MasterArbiter merge strategies + category map | <ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\arbiter\types.ts" lines="49-86" /> |
| `core/aether/types.ts` | `AetherChannelType` | Aether Matrix node channel types | <ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\aether\types.ts" lines="133-173" /> |

### 1.2 Current Supported Primitives (exhaustive)

| Domain | Primitives |
|--------|-----------|
| **INTENSITY** | `dimmer`, `dimmer_fine`, `strobe`, `shutter` |
| **COLOR** | `red`, `green`, `blue`, `white`, `amber`, `uv`, `cyan`, `magenta`, `yellow`, `color_wheel` |
| **POSITION** | `pan`, `pan_fine`, `tilt`, `tilt_fine` |
| **SPATIAL (Aether only)** | `targetX`, `targetY`, `targetZ` |
| **BEAM** | `gobo`, `gobo_rotation`, `prism`, `prism_rotation`, `focus`, `zoom`, `frost`, `iris` |
| **CONTROL** | `speed`, `macro`, `control` |
| **INGENIOS** | `rotation`, `custom` |
| **FALLBACK** | `unknown` |

### 1.3 The Semantic Gap

Lasers and Special FX currently have **no first-class primitives**. They are forced into the `custom` catch-all:

- A laser's pattern selector, X/Y galvo position, rotation, and color are all typed as `custom` with a `customName` string ("Laser Pattern", "Laser X", etc.).
- A smoke machine's pump output is `custom` with `customName: "Fog Output"`.
- A fire FX valve is `custom` with `customName: "Fire Valve"`.

This means the **Omniliquid Engine and Selene cannot semantically drive them** — the `AtmosphereSystem` and `AtmosphereAdapter` emit intents with keys `'output'`, `'fan_speed'`, `'density'` (see <ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\aether\systems\AtmosphereSystem.ts" lines="400-404" />), but the HAL's `FixtureMapper.buildDynamicChannels` routes `custom` channels via `phantomChannels[customName]` (<ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\hal\mapping\FixtureMapper.ts" lines="626-631" />) — **there is no bridge between the AtmosphereSystem's `'output'`/`'fan_speed'`/`'density'` intent keys and the HAL's `phantomChannels[customName]` lookup**. The semantic intent is generated but never reaches the DMX output for custom-typed channels.

### 1.4 Proposed New ChannelType Literals

**LASER primitives** (new domain: LASER):

| Literal | DMX Semantics | Default | Merge |
|---------|--------------|---------|-------|
| `laser_pattern` | Pattern/bank selector (discrete positions) | 0 | LTP |
| `laser_x` | X-axis galvo position (0-255, continuous) | 128 | LTP |
| `laser_y` | Y-axis galvo position (0-255, continuous) | 128 | LTP |
| `laser_rotation` | Pattern rotation angle (0-255, continuous) | 0 | LTP |
| `laser_color` | Color selector (discrete or RGB index) | 0 | LTP |
| `laser_speed` | Pattern scan speed (0-255) | 128 | LTP |
| `laser_strobe` | Laser strobe/shutter (0=off, 255=continuous) | 0 | LTP |
| `laser_power` | Laser output power/dimmer (0-255) | 255 | HTP |

**ATMOSPHERE primitives** (new domain: ATMOSPHERE):

| Literal | DMX Semantics | Default | Merge |
|---------|--------------|---------|-------|
| `smoke_pump` | Fog/haze fluid pump output (0-255) | 0 | LTP |
| `smoke_fan` | Fan speed for haze/fog dispersion (0-255) | 0 | LTP |
| `smoke_density` | Fluid density / mixture ratio (0-255) | 0 | LTP |
| `fan_speed` | Standalone fan velocity (0-255) | 0 | LTP |
| `fire_valve` | Fire/pyro valve or solenoid (0-255, safety-critical) | 0 | LTP |
| `fire_ignite` | Ignition trigger (discrete: 0=off, 255=fire) | 0 | LTP |

**Total: 14 new ChannelType literals** (8 LASER + 6 ATMOSPHERE).

---

## SECTION 2 — Fixture Forge UI Sidebar & Mappers

### 2.1 The Drag Functions Palette

The left sidebar in the Fixture Forge Channel Rack is populated by `FUNCTION_PALETTE` in `FixtureForgeEmbedded.tsx`:

<ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\components\views\ForgeView\FixtureForgeEmbedded.tsx" lines="221-267" />

The current categories are: `INTENSITY`, `COLOR`, `POSITION`, `BEAM`, `CONTROL`, `INGENIOS`. The `INGENIOS` category is the catch-all for non-conventional devices, containing `rotation`, `custom`, `frost`, `gobo_rotation`, `prism_rotation`, `cyan`, `magenta`, `yellow`.

**There is no `LASER` or `ATMOSPHERE` category.** All laser/smoke/fire channels must be dragged as `custom` and renamed via `customName`.

### 2.2 The Category Mapper (UI-side)

`getChannelCategory` in `ForgeGeneralTab.tsx` (<ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\components\views\ForgeView\tabs\ForgeGeneralTab.tsx" lines="191-198" />) maps a `ChannelType` to a UI category string. It currently has no branch for laser or atmosphere primitives — they would fall through to `''` (empty string), breaking the category color coding.

### 2.3 The Smart Default Value Mapper

`getSmartDefaultValue` in `FixtureForgeEmbedded.tsx` (<ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\components\views\ForgeView\FixtureForgeEmbedded.tsx" lines="995-1005" />) returns a sensible DMX default per channel type. It currently has no cases for laser/atmosphere primitives — they would fall to `default: return 0`, which is correct for safety-critical channels (smoke/fire) but wrong for `laser_x`/`laser_y` (should be 128 = center) and `laser_power` (should be 255 = full).

### 2.4 The Aether Cells Tab

`ForgeAetherCellsTab.tsx` (<ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\components\views\ForgeView\tabs\ForgeAetherCellsTab.tsx" lines="30-36" />) renders the 5 Aether Cell families (COLOR, IMPACT, KINETIC, BEAM, ATMOSPHERE) with DnD. The `canAdmit` function from `cellTypeAdmittance.ts` is the gatekeeper. The `ATMOSPHERE` cell is gray (`#6b7280`) — it accepts `control`, `custom`, `macro`, `dimmer`, `strobe`, `shutter`, `white`, `amber`.

---

## SECTION 3 — Aether Cells & HAL Integration

### 3.1 Cell Type Admittance (the canonical gatekeeper)

<ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\forge\cellTypeAdmittance.ts" lines="32-92" />

The `CELL_TYPE_ADMITTANCE` table is the **single source of truth** for which channel types can be assigned to which Aether Cell family. Currently:
- `custom` is the **comodín** (wildcard) — admitted to ALL families.
- `control` → `[ATMOSPHERE]` only.
- `macro` → `[ATMOSPHERE, IMPACT]`.

**New laser/atmosphere primitives must be added to this table** with their natural family assignments:
- All `laser_*` → `[ATMOSPHERE]` (lasers are non-conventional effect devices, same family as smoke/fire).
  - Exception: `laser_power` could also be `[IMPACT]` (it's an intensity channel).
  - Exception: `laser_x`/`laser_y` could also be `[KINETIC]` (galvo position is kinematic).
- All `smoke_*`/`fan_speed`/`fire_*` → `[ATMOSPHERE]`.

### 3.2 NodeExtractionPipeline — Channel Classification

<ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\aether\ingestion\NodeExtractionPipeline.ts" lines="106-148" />

The pipeline classifies channels into 5 sets: `COLOR_CHANNEL_TYPES`, `IMPACT_CHANNEL_TYPES`, `KINETIC_CHANNEL_TYPES`, `BEAM_CHANNEL_TYPES`, `ATMOSPHERE_CHANNEL_TYPES`. Everything not in the first four falls into `ATMOSPHERE_CHANNEL_TYPES` (via `control`, `custom`, and the quarantined set `macro`/`effect`/`sound_active`/`auto`).

**The new laser/atmosphere primitives must be added to `ATMOSPHERE_CHANNEL_TYPES`** so they are routed to `:atmosphere` nodes. The `laser_x`/`laser_y`/`laser_rotation` could optionally be added to `KINETIC_CHANNEL_TYPES` if we want them in a `:kinetic` node for galvo-specific physics — but this is a design decision (see Section 4).

### 3.3 The AtmosphereType Mapping

<ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\aether\ingestion\NodeExtractionPipeline.ts" lines="1458-1466" />

`_mapAtmosphereType` maps `FixtureType` → `AtmosphereType`. Currently:
- `fan` → `'fan'`
- `fog` → `'fog'`
- `pyro` → `'pyro'`
- **`laser` → `'spark'`** ← **This is the core semantic mismatch.** Lasers are mapped to the `spark` AtmosphereType, which triggers the Sparkular logic (drop-only, energy > 0.80, transient-gated). A laser is NOT a spark — it needs continuous galvo control, pattern selection, and color — none of which the `spark` type supports.

The `AtmosphereType` enum (<ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\aether\types.ts" lines="291-304" />) currently has: `'fog' | 'haze' | 'spark' | 'fan' | 'pyro' | 'custom'`. **A `'laser'` type must be added.**

### 3.4 The AtmosphereSystem / AtmosphereAdapter — Intent Key Gap

The `AtmosphereSystem._pushIntent` emits three channel keys: `'output'`, `'fan_speed'`, `'density'` (<ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\aether\systems\AtmosphereSystem.ts" lines="400-404" />). The `AtmosphereAdapter` emits `'level'` and `'speed'` (<ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\aether\adapters\AtmosphereAdapter.ts" lines="153-154, 187, 279" />).

**These intent keys do NOT match any `ChannelType` literal.** The NodeResolver, when resolving an `:atmosphere` node, maps the intent's `valuesDict` to the node's channels by **channel type string matching**. Since the node's channels are typed `custom` (the only option today), and the intent keys are `'output'`/`'fan_speed'`/`'density'`/`'level'`/`'speed'`, **there is no match** — the resolver cannot route the semantic intent to the physical DMX channel.

This is the **semantic gap blocking the Omniliquid/Selene engines from driving atmosphere devices automatically**. The intent is generated but silently dropped at resolution time because the channel type strings don't align.

### 3.5 HAL FixtureMapper — The Custom Channel Bridge

<ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\hal\mapping\FixtureMapper.ts" lines="626-635" />

The HAL's `buildDynamicChannels` handles `custom` by looking up `phantomChannels[customName]`. This means the **only way** to control a custom-typed atmosphere channel today is via manual `phantomChannels` injection from the Programmer UI (L2/L3). The L0 AtmosphereSystem cannot reach it.

For the new primitives (`smoke_pump`, `laser_pattern`, etc.), the HAL must add **explicit `case` branches** in `buildDynamicChannels` that map the normalized intent value (0-1) to DMX (0-255), just like `dimmer`/`pan`/`tilt` are handled today.

---

## SECTION 4 — Proposed Expansion Map

### 4.1 Files Requiring Modification (exhaustive, in dependency order)

| # | File | Change | Impact |
|---|------|--------|--------|
| 1 | `types/FixtureDefinition.ts` | Add 14 new `ChannelType` literals (8 LASER + 6 ATMOSPHERE); extend `deriveCapabilities` with `hasLaser`, `hasAtmosphere` flags | Source of truth — all downstream types align |
| 2 | `core/arbiter/types.ts` | Mirror the 14 new literals in the legacy `ChannelType`; extend `DEFAULT_MERGE_STRATEGIES` and `CHANNEL_CATEGORY_MAP` with new entries; add `'laser'` and `'atmosphere'` to `ChannelCategory` | Legacy arbiter compatibility |
| 3 | `core/aether/types.ts` | Add 14 new literals to `AetherChannelType`; add `'laser'` to `AtmosphereType` enum | Aether Matrix type system |
| 4 | `core/forge/cellTypeAdmittance.ts` | Add all 14 new types to `CELL_TYPE_ADMITTANCE` with family assignments | Cell assignment gatekeeper |
| 5 | `core/aether/ingestion/NodeExtractionPipeline.ts` | Add new types to `ATMOSPHERE_CHANNEL_TYPES` (and optionally `laser_x`/`laser_y`/`laser_rotation` to `KINETIC_CHANNEL_TYPES`); fix `_mapAtmosphereType` to map `laser` → `'laser'` (not `'spark'`) | Node extraction routing |
| 6 | `core/aether/capability-node.ts` | Extend `IAtmosphereNodeData` with optional laser-specific fields (`laserPattern?`, `laserColor?`) if needed; or create a new `ILaserNodeData` interface | Node data model |
| 7 | `core/aether/systems/AtmosphereSystem.ts` | Add `_processLaser` handler; emit intent keys matching the new `ChannelType` literals (`laser_pattern`, `laser_x`, `laser_y`, `laser_color`, `laser_speed`, `laser_power`) | L0 automatic laser control |
| 8 | `core/aether/adapters/AtmosphereAdapter.ts` | Add `case 'laser'` to the switch; emit laser-specific intent keys | L0 adapter laser support |
| 9 | `core/aether/resolver/NodeResolver.ts` | Add resolution branches for the new channel types (map normalized 0-1 → DMX 0-255) | DMX output |
| 10 | `hal/mapping/FixtureMapper.ts` | Add `case 'laser_pattern'`, `case 'laser_x'`, ..., `case 'smoke_pump'`, `case 'fire_valve'`, etc. to `buildDynamicChannels` | HAL DMX packet construction |
| 11 | `components/views/ForgeView/FixtureForgeEmbedded.tsx` | Add `LASER` and `ATMOSPHERE` categories to `FUNCTION_PALETTE`; extend `getSmartDefaultValue` with new cases (laser_x/y → 128, laser_power → 255, fire/smoke → 0) | Forge UI sidebar |
| 12 | `components/views/ForgeView/tabs/ForgeGeneralTab.tsx` | Extend `getChannelCategory` with laser/atmosphere branches; add `LASER`/`ATMOSPHERE` to `CATEGORY_COLORS` | Forge UI category colors |
| 13 | `components/views/ForgeView/tabs/ForgeAetherCellsTab.tsx` | Add `LASER` color to `FAMILY_COLORS` if a new family is created (alternative: keep lasers in ATMOSPHERE family) | Aether Cells UI |
| 14 | `core/aether/types.ts` (NodeFamily) | **Design decision**: add `LASER` as a 6th `NodeFamily`, or keep lasers within `ATMOSPHERE`. See 4.2. | Architecture |



