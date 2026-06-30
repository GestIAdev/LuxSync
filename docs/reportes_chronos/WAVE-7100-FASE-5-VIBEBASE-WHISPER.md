# WAVE 7100 — FASE 5: VibeBase (Whisper)

> **Fecha:** 29 Jun 2026
> **Premisa:** El modo whisper usa la capa L0 (automática) para reacción fotónica, movimiento y color, como complemento al timeline de Chronos.
> **Estado:** ✅ Plomería de datos completada. UI (ArsenalDock) pendiente.

---

## 1. Objetivos

1. `TimelineEngine`: cuando no hay VibeClip activo, caer al `vibeBase.vibeId` del proyecto (whisper)
2. `ChronosStore`: métodos `setVibeBase()` / `getVibeBase()` para gestionar el whisper
3. UI: selector de vibe cards en ArsenalDock (pendiente — se hará cuando toque la UI)

---

## 2. Cambios

### 2.1 — TimelineEngine.ts (Whisper Fallback)

**Antes:** Cuando no había VibeClip activo, el engine limpiaba `currentPlaybackVibeId = null` → TitanEngine quedaba en estado ambiguo.

**Ahora (FASE 5):**
```typescript
if (!hasActiveVibe) {
  const whisperVibeId = this.project?.vibeBase?.vibeId ?? 'idle'
  if (whisperVibeId !== this.currentPlaybackVibeId) {
    this.currentPlaybackVibeId = whisperVibeId
    orchestrator.setVibe(whisperVibeId)
    console.log(`[TimelineEngine] 🌫️ Whisper fallback → Titan "${whisperVibeId}"`)
  }
}
```

**Flujo resultante:**
1. VibeClip activo → `processVibeClip()` hace handoff del vibe al Titan
2. No hay VibeClip → whisper fallback a `project.vibeBase.vibeId`
3. No hay `vibeBase` → fallback a `'idle'` (blackout)
4. `stop()` → limpia `currentPlaybackVibeId = null`

El whisper usa L0 (capa automática) para reacción fotónica, movimiento y color. No compite con VibeClips (L1/L2) ni FX clips (L3/Hephaestus).

### 2.2 — ChronosStore.ts (setVibeBase / getVibeBase)

```typescript
setVibeBase(vibeId: string, displayName?: string): void
getVibeBase(): VibeBaseV3 | null
```

`setVibeBase` preserva `intensity`, `color` e `icon` del vibeBase existente si ya había uno. Solo actualiza `vibeId` y `displayName`. Marca el proyecto como dirty.

### 2.3 — VibeBaseV3 (schema, ya definido en Fase 1)

```typescript
interface VibeBaseV3 {
  vibeId: string         // 'techno-club', 'fiesta-latina', etc.
  displayName: string    // 'Techno Club', 'Fiesta Latina'
  intensity: number      // 0-1
  color: string          // '#a855f7'
  icon: string           // '⚡'
}
```

---

## 3. Vibes Disponibles

| ID | Display | Icono |
|---|---|---|
| `fiesta-latina` | Fiesta Latina | 🎉 |
| `techno-club` | Techno Club | ⚡ |
| `chill-lounge` | Chill Lounge | 🌊 |
| `pop-rock` | Pop Rock | 🎸 |
| `idle` | Idle (Blackout) | 💤 |

Registry: `src/engine/vibe/profiles/index.ts` — `VIBE_REGISTRY`, `VIBE_ALIAS_MAP`

---

## 4. Arquitectura de Capas

```
┌──────────────────────────────────────────────────┐
│ L3 — Hephaestus (FX Clips .lfx)                  │ ← Efectos con curvas
│     ↓ override                                    │
│ L2 — Manual (Programmer/Live Rack)               │ ← Operador humano
│     ↓ override                                    │
│ L1 — VibeClips (Timeline)                        │ ← Clips de vibe en timeline
│     ↓ override                                    │
│ L0 — Whisper (VibeBase) ← FASE 5                 │ ← Reacción automática fotónica
│     ↓                                             │
│ TitanEngine → LiquidEngine → NodeArbiter → DMX   │
└──────────────────────────────────────────────────┘
```

Cuando no hay VibeClip activo en el timeline, el whisper (L0) toma el control. El TitanEngine recibe el `vibeId` y aplica los perfiles de color, movimiento y reacción fotónica automáticamente.

---

## 5. Pendiente

- **UI: Vibe cards en ArsenalDock** — Las vibes se mostrarán como tarjetas junto a los efectos .lfx, con estilo visual diferenciado. Al seleccionar una vibe card, se llama `store.setVibeBase(vibeId, displayName)`. Esto se implementará cuando toque la fase de UI del ArsenalDock.

---

## 6. Verificación

```
tsc --noEmit: 0 errores
vitest LuxFileV3: 22/22 passed
```
