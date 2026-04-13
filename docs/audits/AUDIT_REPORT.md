# AUDIT_REPORT.md — OPERACIÓN DISCOTECA
## Auditoría de Flujo: Critical Trace

**Auditor**: PunkOpus  
**Fecha**: Wave actual  
**Scope**: Señal completa Selene IA → HAL render output  
**Status**: DIAGNÓSTICO COMPLETO — SIN CAMBIOS DE CÓDIGO

---

## RESUMEN EJECUTIVO

Se han trazado los 3 síntomas reportados hasta su raíz. Los tres comparten un patrón común: **colisiones temporales y redundancia arquitectónica** que hacen que subsistemas correctos individualmente produzcan resultados rotos al combinarse.

---

## SÍNTOMA 1: DIMMER KILL

### Descripción
> "Los efectos parpadean una vez y luego la rig se va a negro total."

### Root Cause: El update() consume la bala ANTES de que getOutput() la lea

**Cadena causal completa:**

```
TitanOrchestrator.processFrame()
  ├── 1. TitanEngine.update()
  │     └── EffectManager.update()
  │           └── GatlingRaid.update(deltaMs=40ms)  ← BALA MUERE AQUÍ
  │                 bulletTimer(40) >= bulletDurationMs(30)
  │                 → isFlashOn = false
  │                 → bulletTimer = 0  (excedente PERDIDO)
  │
  ├── 2. HAL.renderFromTarget() → fixtureStates base
  │
  └── 3. EffectManager.getCombinedOutput()
        └── GatlingRaid.getOutput() ← LEE isFlashOn=false → NEGRO
```

**Punto exacto del fallo:**

| Paso | Archivo | Línea | Qué pasa |
|------|---------|-------|----------|
| 1 | [GatlingRaid.ts](electron-app/src/core/effects/library/techno/GatlingRaid.ts#L195) | L195-206 | `update(40ms)`: bulletTimer(0+40=40) >= bulletDurationMs(30) → `isFlashOn = false`, `bulletTimer = 0` |
| 2 | [GatlingRaid.ts](electron-app/src/core/effects/library/techno/GatlingRaid.ts#L244) | L244-256 | `getOutput()`: ve `isFlashOn=false` → retorna `dimmerOverride: 0, globalComposition: fadeOpacity` |
| 3 | [EffectManager.ts](electron-app/src/core/effects/EffectManager.ts#L856) | L856 | `getCombinedOutput()`: `maxDimmer=0` → `dimmerOverride: maxDimmer > 0 ? maxDimmer : undefined` → **undefined** |
| 4 | [TitanOrchestrator.ts](electron-app/src/core/orchestrator/TitanOrchestrator.ts#L1020) | L1020 | Branch legacy: `effectOutput.dimmerOverride !== undefined` → **FALSE** → **no se aplica nada** |

**Resultado**: La bala le da 30ms al flash y 35ms al gap. Un frame dura 40ms. Cuando `update(40ms)` corre, la bala de 30ms ya nació Y murió en el mismo delta. Para cuando `getOutput()` se ejecuta, siempre ve negro.

**Dato letal**: `bulletDurationMs(30) < frameDuration(40)`. Cada bala es **sub-frame** — imposible de renderizar a 25fps. Solo las balas que "empiezan" a mitad de frame (con timer residual <30ms del frame anterior) PODRÍAN verse, pero el `bulletTimer = 0` sin carry-over elimina esa posibilidad.

### Colisión Arquitectónica

El diseño asume que `update()` y `getOutput()` operan en el mismo "instante" temporal. Pero en la pipeline, están separados por:
- Toda la ejecución de TitanEngine (stabilizers, color, nervous system)
- La arbitración del MasterArbiter
- El render del HAL

El `update()` avanza el reloj del efecto ANTES de que nadie lea su estado. Es un **race condition temporal interno al frame**.

---

## SÍNTOMA 2: DILATACIÓN TEMPORAL

### Descripción
> "GatlingRaid dispara 2 balas en 2 segundos cuando debería disparar 18 en 1.17 segundos."

### Root Cause: bulletTimer = 0 descarta el excedente temporal

**Punto exacto del fallo:**

[GatlingRaid.ts L204-205](electron-app/src/core/effects/library/techno/GatlingRaid.ts#L204-L205):
```typescript
this.isFlashOn = false
this.bulletTimer = 0  // ← AQUÍ: EL EXCEDENTE SE PIERDE
```

[GatlingRaid.ts L209-210](electron-app/src/core/effects/library/techno/GatlingRaid.ts#L209-L210):
```typescript
this.isFlashOn = true
this.bulletTimer = 0  // ← AQUÍ TAMBIÉN
```

**Matemática del desastre:**

Con `deltaMs=40ms` (25fps):
```
Frame 1: bulletTimer = 0 + 40 = 40. Flash(30)? SÍ → isFlashOn=false, bulletTimer=0
         PERDIDOS: 40-30 = 10ms
Frame 2: bulletTimer = 0 + 40 = 40. Gap(35)? SÍ → isFlashOn=true, bulletTimer=0, currentBullet++
         PERDIDOS: 40-35 = 5ms  
Frame 3: bulletTimer = 0 + 40 = 40. Flash(30)? SÍ → isFlashOn=false, bulletTimer=0
         PERDIDOS: 10ms
```

**Cada ciclo de 65ms (30+35) toma 2 frames reales (80ms)**. Pérdida por ciclo: 15ms (23% del tiempo).

Efecto acumulado sobre 18 balas:
- **Duración teórica**: 18 × 65ms = 1170ms
- **Duración real**: 18 × 80ms = 1440ms (23% más lento)

Pero eso es el MEJOR caso. Si el Stampede Guard (WAVE 2211) salta frames:

[TitanOrchestrator.ts L476-487](electron-app/src/core/orchestrator/TitanOrchestrator.ts#L476-L487):
```
Stampede Guard: if (isProcessingFrame) return  // SKIP
```

Si un frame tarda >40ms (heavy async en TitanEngine.update()), el siguiente `setInterval` callback se salta. Esto crea un `deltaMs` de ~80ms+ en el frame siguiente. Con deltaMs=80ms:

```
Frame N: bulletTimer = 0 + 80 = 80. Flash(30)? SÍ → isFlashOn=false, bulletTimer=0
         PERDIDOS: 80-30 = 50ms (¡UN CICLO COMPLETO DE GAP+FLASH!)
```

**Un deltaMs de 80ms pierde una bala entera.** Con frames irregulares (heavy brain computation), el efecto puede perder la mitad de sus balas.

### Agravante: El código solo procesa UNA transición por frame

La estructura if/else en [GatlingRaid.ts L202-223](electron-app/src/core/effects/library/techno/GatlingRaid.ts#L202-L223) es lineal: check flash → elif check gap. Pero un deltaMs de 120ms contiene 30ms(flash) + 35ms(gap) + 30ms(flash) + 25ms(restante) = casi 2 transiciones completas. El código solo procesa la primera, descarta el tiempo restante.

---

## SÍNTOMA 3: DREAM TEXTURE ZOMBIE

### Descripción
> "El filtro DREAM_TEXTURE sigue rechazando efectos por `affinity=dirty` a pesar de haberse 'removido'."

### Root Cause: El filtro existe en TRES lugares independientes

**Triple-check redundante:**

| # | Sistema | Archivo | Línea | Tipo | Solo bypassa |
|---|---------|---------|-------|------|-------------|
| 1 | **EffectDreamSimulator** | [EffectDreamSimulator.ts](electron-app/src/core/intelligence/dream/EffectDreamSimulator.ts#L1382) | L1382 | Binario: `relevance=0` si incompatible | `fiesta-latina` (WAVE 2188) |
| 2 | **VisualEthicalValues** | [VisualEthicalValues.ts](electron-app/src/core/intelligence/conscience/VisualEthicalValues.ts#L485) | L485 | Penalty: `0.5` si dirty↔clean | **Ningún bypass** |
| 3 | **ContextualEffectSelector** | [ContextualEffectSelector.ts](electron-app/src/core/effects/ContextualEffectSelector.ts#L506) | L506 | Binario: bloquea si `compatibility` no matchea | `fiesta-latina` (WAVE 2187) |

**Log fantasma**: El log `[DREAM_TEXTURE] 🎨 REJECTED` viene de [EffectDreamSimulator.ts L1558](electron-app/src/core/intelligence/dream/EffectDreamSimulator.ts#L1558).

**Caso concreto — `surgical_strike`:**

[EffectDNA.ts L295-299](electron-app/src/core/intelligence/dna/EffectDNA.ts#L295-L299):
```typescript
'surgical_strike': {
    aggression: 0.88,
    chaos: 0.25,
    organicity: 0.02,
    textureAffinity: 'dirty',  // ← NUNCA SE CAMBIÓ A 'universal'
}
```

WAVE 2104.2 cambió `dirty→universal` para `gatling_raid`, `glitch_matrix` y `earthquake_flash`, pero **NO para `surgical_strike`**. El DNA sigue siendo `'dirty'`.

**Pipeline de triple bloqueo:**

```
surgical_strike (affinity=dirty) + audio texture=clean
     │
     ├─[1]→ EffectDreamSimulator.checkTextureCompatibility()
     │       resultado: compatible=false, relevance=0, textureRejected=true
     │       log: "[DREAM_TEXTURE] 🎨 REJECTED"
     │
     ├─[2]→ VisualEthicalValues.texture_coherence
     │       resultado: passed=false, penalty=0.5
     │       "AESTHETIC INCOHERENCE: surgical_strike (dirty) clashes with clean audio"
     │
     └─[3]→ ContextualEffectSelector.applyTextureFilter()
            resultado: allowed=false
            log: "[EffectRepository 🎨] Arsenal TEXTURE BLOCKED"
```

El efecto tiene que pasar TRES filtros de textura independientes para ejecutarse. Con `textureAffinity: 'dirty'` en música clean, los tres lo bloquean. **No es código zombie — es triple redundancia no documentada.** WAVE 2188 solo creó bypass en 2 de los 3 filtros, y solo para `fiesta-latina`.

### Colisión Arquitectónica

El `deriveSpectralContext()` en [EffectDreamSimulator.ts L1471-1520](electron-app/src/core/intelligence/dream/EffectDreamSimulator.ts#L1471-L1520) tiene un fallback que INVENTA la textura basándose en el vibe:

```typescript
// PRIORIDAD 3 — Fallback: derivar del vibe (legacy)
if (context.vibe.includes('chill') || context.vibe.includes('ambient')) {
    texture = 'clean'     // ← HARDCODED
    harshness = 0.2
    clarity = 0.8
}
```

Si no hay datos espectrales reales del GodEar (micrófono off, Chronos sin análisis), el sistema ASUME textura por vibe. Un vibe `chill-lounge` siempre será `texture=clean`, bloqueando TODOS los efectos `dirty` sin importar lo que suene realmente.

---

## MAPA DE COLISIÓN

```
┌─────────────────────────────────────────────────────────────────┐
│                    PIPE FRAME (~40ms)                            │
│                                                                 │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────┐  │
│  │ update(40ms) │    │ HAL.render() │    │ getOutput()      │  │
│  │              │    │              │    │                  │  │
│  │ BALA MUERE   │───>│ Base states  │───>│ Lee: isFlashOn=  │  │
│  │ timer=0      │    │              │    │   FALSE (siempre)│  │
│  └──────────────┘    └──────────────┘    └──────────────────┘  │
│        │                                        │               │
│        │  bulletTimer=0                         │  dimmer=0     │
│        │  (10ms perdidos)                       │  color=negro  │
│        │                                        │               │
│  ┌─────▼─────────────────────────────────────────▼──────────┐  │
│  │              RESULTADO: NEGRO TOTAL                       │  │
│  │  La bala vivió 30ms dentro de update() pero nadie la vio │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## SEVERIDAD Y PRIORIDAD

| Síntoma | Severidad | Impacto | Complejidad del Fix |
|---------|-----------|---------|---------------------|
| 1. Dimmer Kill | **CRITICAL** | Balas invisibles. Efecto inservible a 25fps. | Media — requiere rediseño del timing: sample-and-hold o double-buffer |
| 2. Dilatación Temporal | **CRITICAL** | Efecto 23-50% más lento que el diseño. Con frame-skip, peor. | Baja — carry-over del excedente: `bulletTimer -= threshold` en vez de `bulletTimer = 0` |
| 3. Dream Texture Zombie | **HIGH** | Efectos `dirty` bloqueados silenciosamente en vibes no-techno | Media — decidir cuál de los 3 filtros sobrevive, unificar, documentar |

---

## RECOMENDACIONES ARQUITECTÓNICAS (SIN CÓDIGO)

### Para Síntoma 1+2 (Dimmer Kill + Dilatación Temporal)

**Opción A — Sample-and-Hold**: El `update()` calcula el estado pero NO lo aplica inmediatamente. Almacena el "frame renderizable" en un buffer interno. `getOutput()` lee ese buffer. Esto desacopla el avance temporal de la lectura de estado.

**Opción B — While-loop con carry-over**: El `update()` procesa TODAS las transiciones que caben en `deltaMs` usando un while-loop con carry-over:
```
while (remainingMs > 0) {
    if (isFlashOn && remainingMs >= bulletDurationMs - bulletTimer) { transición }
    else if (!isFlashOn && remainingMs >= bulletGapMs - bulletTimer) { transición }
    else { bulletTimer += remainingMs; break }
}
```

**Opción C — Timestamp-based**: Almacenar `startTimeMs = Date.now()` y calcular el estado en `getOutput()` a partir del tiempo absoluto, sin timer incremental.

### Para Síntoma 3 (Dream Texture Zombie)

La textura se filtra en 3 capas que no se conocen entre sí:
1. Consolidar en UN SOLO punto (propuesta: VisualEthicalValues como capa canónica)
2. Los otros dos se convierten en pass-through que logean pero no bloquean
3. El bypass por vibe se centraliza en el punto canónico (no solo fiesta-latina)
4. `surgical_strike.textureAffinity` → decidir si debe ser `'universal'` como el resto del arsenal táctico (WAVE 2104.2 lo hizo para gatling_raid, glitch_matrix, earthquake_flash — surgical_strike quedó huérfano)

---

## ARCHIVOS INVOLUCRADOS (REFERENCIA RÁPIDA)

| Archivo | Rol |
|---------|-----|
| [GatlingRaid.ts](electron-app/src/core/effects/library/techno/GatlingRaid.ts) | Efecto: lógica de balas |
| [EffectManager.ts](electron-app/src/core/effects/EffectManager.ts) | Combina outputs de efectos activos |
| [TitanOrchestrator.ts](electron-app/src/core/orchestrator/TitanOrchestrator.ts) | Pipeline frame: update → arbitrate → render → overlay |
| [TitanEngine.ts](electron-app/src/engine/TitanEngine.ts) | Motor reactivo, llama effectManager.update() |
| [EffectDreamSimulator.ts](electron-app/src/core/intelligence/dream/EffectDreamSimulator.ts) | Filtro textura #1 (Dream) |
| [VisualEthicalValues.ts](electron-app/src/core/intelligence/conscience/VisualEthicalValues.ts) | Filtro textura #2 (Ética) |
| [ContextualEffectSelector.ts](electron-app/src/core/effects/ContextualEffectSelector.ts) | Filtro textura #3 (Selector) |
| [EffectDNA.ts](electron-app/src/core/intelligence/dna/EffectDNA.ts) | Registry de afinidades |
| [MasterArbiter.ts](electron-app/src/core/arbiter/MasterArbiter.ts) | Arbitración de capas (NO involucrado directamente en estos bugs — efectos CORE van por otro camino) |

---

**FIN DEL DIAGNÓSTICO. CERO LÍNEAS DE CÓDIGO MODIFICADAS.**  
**Esperando confirmación del Cónclave para proceder con la ejecución.**
