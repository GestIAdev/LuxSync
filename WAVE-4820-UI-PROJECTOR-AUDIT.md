# WAVE 4820 — UI PROJECTOR AUDIT
## AetherUIProjector.ts: El Simulador a Oscuras & La Aduana Invertida

**Auditor:** Kimi (Cascade)  
**Fecha:** 2026-05-15  
**Archivo auditado:** `src/core/aether/resolver/AetherUIProjector.ts`  
**Líneas de interés:** 64–191 (método `project()`)  
**Archivos relacionados:** `src/core/aether/types.ts`, `src/hal/mapping/FixtureMapper.ts`, `src/core/orchestrator/TitanOrchestrator.ts`, `src/hal/HardwareAbstraction.ts`

---

## 👁️ 1. DIAGNÓSTICO DEL SIMULADOR A OSCURAS

### 1.1 El switch ciego

El método `project()` itera cada `nodeId` de un fixture y clasifica por `node.family` mediante un `switch`:

```typescript
switch (node.family) {
  case NodeFamily.KINETIC:   { ... break }
  case NodeFamily.COLOR:     { ... break }
  case NodeFamily.IMPACT:    { ... break }
  case NodeFamily.BEAM:      { break }          // ← no-op intencional
  default:                   { break }          // ← 🪦 TUMBA DE FAMILIAS
}
```

El enum `NodeFamily` (en `types.ts:74–85`) declara **cinco** familias:

| Constante     | Valor string  | Cubierto en switch |
|---------------|---------------|--------------------|
| `COLOR`       | `'COLOR'`     | ✅ Sí              |
| `IMPACT`      | `'IMPACT'`    | ✅ Sí              |
| `KINETIC`     | `'KINETIC'`   | ✅ Sí              |
| `BEAM`        | `'BEAM'`      | ✅ Sí (no-op)      |
| `ATMOSPHERE`  | `'ATMOSPHERE'`| ❌ **NO** → default |

**Cualquier fixture cuyos nodos sean 100 % `ATMOSPHERE` (ej. máquina de humo, ventilador de efectos) o cuyo único nodo emisor de luz no caiga en COLOR/IMPACT quedará completamente invisible en el Canvas 2D/3D.**

### 1.2 El caso Tungsten: nodos mixtos no proyectados

Fixtures multicelulares modernos (Tungsten, LED bars con segmentos, hybrids) a menudo se descomponen en **múltiples nodos del mismo `deviceId`**:

- `tungsten-01:impact` → dimmer master  
- `tungsten-01:color`  → r/g/b del wash  
- `tungsten-01:beam`   → zoom/focus  
- `tungsten-01:atmo`   → ventilador/haze integrado

El proyector maneja bien IMPACT + COLOR + BEAM, **pero si el fixture posee un nodo ATMOSPHERE con canales de dimmer/brightness o color auxiliar** (ej. algunos hazers tienen LED de status con canal `dimmer`), ese aporte lumínico **nunca se traduce** a `fixture.dimmer`, `fixture.r`, `fixture.g`, `fixture.b`.

El `default: break` del switch es una trampa silenciosa: no hay warning, no hay fallback, el fixture simplemente no emite luz en la preview.

### 1.3 Duck-typing vs. familia faltante

El nodo `ATMOSPHERE` puede portar canales arbitrarios según su tipo (`fog`, `haze`, `spark`, `fan`, `pyro`, `custom`). En la práctica, muchos fixtures "de efecto" declaran:

- `dimmer` / `brightness` → intensidad del efecto  
- `red` / `green` / `blue` → coloración del efecto (ej. chispas rojas, humo LED)
- `speed` / `control` → velocidad del ventilador

**Solución propuesta:**

1. **Añadir caso `ATMOSPHERE`** al switch con la misma lógica de proyección que IMPACT/COLOR (duck-typing sobre canales presentes en `arbitrated.get(nodeId)`).

2. **O, más robusto:** reemplazar el switch monolítico por un **mapa de proyección por tipo de canal** (`dimmer` → `fixture.dimmer`, `red`/`green`/`blue` → `fixture.r/g/b`, etc.), sin importar la familia del nodo. Esto elimina el riesgo de que futuras familias (ej. `PIXEL`, `LASER`) sufran el mismo destino.

   ```typescript
   // Pseudo-código de la refactorización
   const CHANNEL_PROJECTION_MAP: Record<string, (fs: FixtureState, v: number) => void> = {
     dimmer:     (fs, v) => fs.dimmer = Math.max(fs.dimmer, toDmx(v)),
     brightness: (fs, v) => fs.dimmer = Math.max(fs.dimmer, toDmx(v)),
     red:        (fs, v) => fs.r = Math.max(fs.r, toDmx(v)),
     green:      (fs, v) => fs.g = Math.max(fs.g, toDmx(v)),
     blue:       (fs, v) => fs.b = Math.max(fs.b, toDmx(v)),
     pan:        (fs, v) => fs.pan = toDmx(v),
     tilt:       (fs, v) => fs.tilt = toDmx(v),
     rotation:   (fs, v) => fs.rotation = toDmx(v),
     zoom:       (fs, v) => fs.zoom = toDmx(v),
     focus:      (fs, v) => fs.focus = toDmx(v),
     // ...
   }
   ```

3. **Mantener las excepciones semánticas** (ej. `isAtmosphericZone` para blending aditivo en vez de `max`) como capa de post-proceso, no como gate previo.

### 1.4 Impacto cuantificado

| Escenario | Resultado visual actual | Resultado esperado |
|-----------|------------------------|-------------------|
| Fixture 100 % ATMOSPHERE con dimmer | Canvas: negro | Canvas: intensidad proporcional al dimmer |
| Fixture mixto (COLOR + ATMOSPHERE) | Solo aporta COLOR; ATMOS ignorado | Suma aditiva o max de ambos |
| Tungsten con nodo atmosférico integrado | Fan invisible, wash visible | Fan visible si tiene brillo |

---

## 🛂 2. REFACTORIZACIÓN DE LA ADUANA (blackoutActive)

### 2.1 El bloque destructivo

Al final de `project()`, líneas 180–190:

```typescript
// 🚨 WAVE 4634: BLACKOUT UI SYNC
if (blackoutActive) {
  fixture.dimmer = 0
  fixture.r = 0
  fixture.g = 0
  fixture.b = 0
  if (fixture.white !== undefined) fixture.white = 0
  if (fixture.amber !== undefined) fixture.amber = 0
  if (fixture.uv !== undefined) fixture.uv = 0
  if (fixture.shutter !== undefined) fixture.shutter = 0
  if (fixture.strobe !== undefined) fixture.strobe = 0
}
```

Este bloque recorre **todos** los fixtures y anula **in-place** sus valores lumínicos cada vez que `blackoutActive === true`.

### 2.2 La contradicción arquitectónica

En `HardwareAbstraction.ts` (WAVE 3160, líneas 2030–2104), la Aduana **real** opera así:

> "Cuando `!outputEnabled` (ARMED), los bytes DMX se fuerzan a safe values. Los FixtureState originales **NUNCA se tocan** — React/UI los lee intactos."

Es decir: el HAL ya ha resuelto el problema de "no enviar DMX al hardware cuando estamos en modo ARMED" **sin tocar los FixtureState**. La Aduana vive en la capa de bytes, justo antes de `driver.send()`, protegiendo tanto la UI como la física.

**Pero el AetherUIProjector traiciona ese principio.** Al mutar los FixtureState con `blackoutActive`, el Canvas 2D/3D recibe ceros **aunque la intención del motor (L0 + L1 + L2) sea plena**. El LD no puede pre-programar a ciegas porque el simulador está ciego.

### 2.3 Flujo de datos: dónde ocurre cada gate

```
┌─────────────────────────────────────────────────────────────────────────┐
│  FRAME LOOP (TitanOrchestrator.ts:2006–2007)                          │
│                                                                         │
│  const blackoutActive = aetherArbiter.isBlackoutActive()              │
│  this._aetherUIProjector.project(fixtureStates, graph, arbitrated,      │
│                                   blackoutActive)  ← 🔴 MUTA UI         │
│                                                                         │
│  emitHotFrame() → React lee fixtureStates (ya zerificados)             │
│                                                                         │
│  ...                                                                    │
│                                                                         │
│  this.hal.sendToDriver(states)                                          │
│    → statesToDMXPackets(states) → packets[]                             │
│    → if (!outputEnabled) {                                              │
│         packets[i].channels.fill(0)  ← 🟢 SOLO bytes DMX, states intact│
│      }                                                                  │
│    → driver.send(packet)                                                │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.4 Casos de uso destruidos

| Caso de uso | `outputEnabled` | `blackoutActive` | Comportamiento esperado | Comportamiento actual |
|-------------|-----------------|------------------|------------------------|----------------------|
| Pre-programar show (ARMED) | `false` | `true` | UI muestra diseño completo; hardware apagado | UI **negra**; hardware apagado |
| Calibrar movers en silencio | `false` | `true` | Ver pan/tilt en 3D; DMX = 0 | Ver pan/tilt en 3D; DMX = 0 ✅ |
| Blackout momentáneo en show | `true` | `true` | UI negra; hardware negra | UI negra; hardware negra ✅ |
| Editar cue con output off | `false` | `false` | UI muestra cue; hardware apagado | UI muestra cue; hardware apagado ✅ |

**Solo falla el caso 1**, pero es el más crítico para el workflow del LD: diseñar a ciegas.

### 2.5 Solución propuesta

**Opción A (mínima):** Eliminar el bloque `if (blackoutActive)` del AetherUIProjector.  
- Pros: Un cambio de 10 líneas. La Aduana de bytes en HAL ya cubre el hardware.  
- Contras: Si el usuario pulsa "Blackout" durante un show LIVE, la UI seguirá mostrando luz mientras el escenario está oscuro. Esto puede confundir al operador.

**Opción B (elegante):** Separar los conceptos:

- **`blackoutActive`** → afecta **solo** el buffer DMX físico (HAL, ya implementado en WAVE 3160).  
- **`uiBlackoutActive`** → flag independiente, opcional, para oscurecer el Canvas cuando el operador quiere "previsualizar el apagón".

**Opción C (recomendada):** Cambiar el parámetro `blackoutActive` del proyector para que sea **visual** y no destructivo:

```typescript
project(fixtures, graph, arbitrated, blackoutActive = false): void {
  // ...proyección normal de todos los canales...

  // WAVE 4820: Blackout visual opcional — SOLO aplica opacidad/overlay,
  // nunca muta los valores numéricos que React lee.
  if (blackoutActive) {
    // Opción C1: no hacer nada; dejar que la UI aplique CSS opacity
    // Opción C2: añadir flag fixture._visualBlackout = true
    //            y que el renderer decida en base a él
  }
}
```

### 2.6 Verificación de seguridad

Si se elimina el bloque `blackoutActive` del proyector:

1. **El hardware sigue protegido:** `HAL.sendToDriver()` (líneas 2041–2104) zerifica bytes DMX cuando `!outputEnabled` o cuando `blackoutActive` es true en el resolver/egress.
2. **Los movers no se dañan:** El NodeResolver (`getSoftBlackoutUniverseBuffer`, línea 2030) preserva pan/tilt en blackout; solo anula dimmer/color.
3. **React no sufre race conditions:** WAVE 3160 garantiza que `sendToDriver` nunca muta los `FixtureState` originales.

---

## 📋 RESUMEN EJECUTIVO

| Problema | Ubicación | Causa raíz | Fix recomendado |
|----------|-----------|-----------|-----------------|
| Fixtures ATMOSPHERE invisibles | `AetherUIProjector.ts:171–172` (`default: break`) | Falta caso `ATMOSPHERE` en switch | Añadir proyección duck-typed o reemplazar switch por mapa de canales |
| Fixture multicelular a oscuras | Mismo switch | Solo KINETIC/COLOR/IMPACT/BEAM proyectan | Generalizar proyección por tipo de canal, no por familia |
| UI ciega en modo ARMED | `AetherUIProjector.ts:180–190` | `blackoutActive` muta FixtureState in-place | Eliminar bloque; dejar que HAL aduane bytes DMX solamente |
| Doppelgänger de Aduana | `AetherUIProjector.ts:180–190` + `HAL.ts:2030–2104` | Duplicación lógica de blackout | Consolidar en HAL (única fuente de verdad) |

---

## 🔧 PRÓXIMOS PASOS (WAVE 4821 — Ejecución)

1. **F1 — Desbloqueo visual:**
   - Reemplazar el `switch(node.family)` por una función de proyección genérica basada en `arbitrated.get(nodeId)`.
   - Mapear `dimmer`/`brightness` → `fixture.dimmer`, `red`/`green`/`blue` → `fixture.r/g/b`, etc.
   - Preservar `isAtmosphericZone` como selector de estrategia de blend (aditivo vs. max).

2. **F2 — Inversión de la Aduana:**
   - Eliminar el bloque `if (blackoutActive)` de `AetherUIProjector.project()`.
   - Verificar que `HAL.sendToDriver()` y `aetherResolver.getSoftBlackoutUniverseBuffer()` ya cubren el apagón físico.
   - Añadir `fixture._visualBlackout?: boolean` si se desea overlay visual opcional en el Canvas.

3. **Validación:**
   - Fixture ATMOSPHERE con canal `dimmer` debe aparecer brillante en Canvas 2D.
   - Con `outputEnabled=false` + `blackoutActive=true`, el Canvas debe mostrar el show completo; el hardware debe permanecer en negro.

---

*Auditado por Opus — WAVE 4820*  
*Estado: Diagnóstico completo. Listo para ejecución en WAVE 4821.*
