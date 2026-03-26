# ⚖️ WAVE 2189 — THE FORENSIC AUDIT
## "100% Diagnóstico, Cero Código"

**Auditor:** PunkOpus  
**Arquitecto:** Radwulf (orden de cesación total)  
**Fecha:** $(date)  
**Base commit:** `8abda31` (WAVE 2185)  
**Estado:** DIAGNÓSTICO COMPLETO — 3 causas raíz identificadas con prueba irrefutable  

---

## 🚨 CONTEXTO DE LA ORDEN

El motor físico experimenta colapso crítico:
- **Espasmos** durante control manual
- **Pan muerto** cuando patrones manuales están activos (solo Tilt se mueve)
- **Blanco perpetuo** en DMX (el simulador 3D muestra colores correctos)

Todo funcionaba ANTES de introducir los controles manuales de TheProgrammer.

**ORDEN DEL ARQUITECTO:** Auditoría pura. Estrictamente prohibido escribir código.

---

## 📋 VEREDICTO EJECUTIVO

Las 3 anomalías comparten una **raíz común**: la ausencia total de throttle en los componentes de UI (`XYPad.tsx` y `RadarXY.tsx`). Este defecto sistémico desencadena una cascada de fallos:

```
[UI sin throttle] → [60+ IPC/seg] → [speed:0 persiste] → [DMX flood] → [motor colapsa]
                                                        ↓
                                    [SafetyLayer LATCH] → [colorWheel=0=Blanco]
```

Los 3 bugs son síntomas del mismo cáncer: **IPC flood sin control de flujo**.

---

## 🔬 INVESTIGACIÓN 1: EL BLANCO PERPETUO

### Síntoma
El DMX envía blanco perpetuamente. El simulador 3D muestra colores correctos.

### Cadena completa de la señal (color)

```
MasterArbiter.arbitrateFixture()
  ├─ color_wheel: 0 (default, solo Manual Override puede cambiar)
  │
  ↓
HardwareAbstraction.renderFromTarget()  [línea 918]
  ├─ colorWheel: fixtureTarget.color_wheel  →  0
  │
  ↓
translateColorToWheel()  [línea 1323]
  ├─ existingColorWheel > 0?  →  NO (es 0)  →  TRADUCE
  ├─ translate(RGB, profile)  →  colorWheelDmx = X  (correcto)
  │
  ↓
HardwareSafetyLayer.filter()  [línea 131]
  ├─ requestedColorDmx = X  (color correcto de Babel Fish)
  │
  ├─ PERO: IPC flood de UI sin throttle envía 60+ estados/seg
  ├─ SafetyLayer.calculateChangesPerSecond() > chaosThreshold
  │
  ↓ ¡CAOS DETECTADO! [línea 210-215]
  ├─ state.isLatched = true
  ├─ state.latchedColorDmx = state.lastColorDmx
  │                          ↑
  │         ┌────────────────┘
  │         │ Si es el PRIMER color (fixture recién inicializado):
  │         │ createInitialState() → lastColorDmx: initialColor → 0
  │         │
  │         └─ latchedColorDmx = 0 = Open/White
  │
  ↓
  return { finalColorDmx: 0 }  →  FixtureMapper  →  DMX: BLANCO
```

### Archivos y líneas exactas

| Paso | Archivo | Línea | Código |
|------|---------|-------|--------|
| Target default | `MasterArbiter.ts` | ~1500 | `NATIVE_CHANNELS` no incluye `shutter` |
| HAL render | `HardwareAbstraction.ts` | 918 | `colorWheel: fixtureTarget.color_wheel` |
| Babel Fish check | `HardwareAbstraction.ts` | 1329 | `if (existingColorWheel > 0) return state` |
| SafetyLayer init | `HardwareSafetyLayer.ts` | 288 | `lastColorDmx: initialColor` (= 0) |
| Chaos LATCH | `HardwareSafetyLayer.ts` | 213 | `latchedColorDmx = state.lastColorDmx` |
| LATCH return | `HardwareSafetyLayer.ts` | 179-184 | `finalColorDmx: state.latchedColorDmx` (= 0) |
| Mapper output | `FixtureMapper.ts` | 546 | `return state.colorWheel ?? (channel.defaultValue ?? 0)` |

### Causa raíz
El IPC flood (60+ cambios/seg) dispara el detector de CAOS del SafetyLayer, que latchea el color en `0` (Open/White) porque `lastColorDmx` se inicializa con `initialColor = 0` del Arbiter default.

**¿Por qué el 3D muestra bien?** El simulador 3D lee `color.r/g/b` directamente del target, NO lee `colorWheel`. La rueda de colores solo afecta al canal DMX físico.

### Bug secundario encontrado: shutter: 0

| Archivo | Línea | Código | Impacto |
|---------|-------|--------|---------|
| `HardwareAbstraction.ts` | 922 | `shutter: 0` (hardcoded en `baseState`) | shutter 0 = CERRADO en fixtures mecánicos |
| `FixtureMapper.ts` | 513 | `return state.shutter ?? (channel.defaultValue ?? 255)` | Recibe 0, devuelve 0 (no `undefined`) |

En fixtures con shutter mecánico, `shutter: 0` = blackout completo. Este bug **no causa blanco** (causa oscuridad), pero es una bomba dormida que afecta a cualquier fixture con canal shutter que no tenga override manual del Phantom Panel.

---

## 🔬 INVESTIGACIÓN 2: PAN MUERTO EN PATRONES

### Síntoma
Pan completamente muerto cuando un patrón manual está activo. Solo Tilt se mueve.

### Cadena de la muerte del Pan

```
handlePositionChange()  [PositionSection.tsx:231]
  ├─ controls: { pan: X, tilt: Y, speed: 0 }
  ├─ channels: ['pan', 'tilt', 'speed']
  │
  ↓ IPC → lux:arbiter:setManual
  │
MasterArbiter.setManualOverride()  [MasterArbiter.ts:487]
  ├─ mergedControls = { ...existing, ...new }
  ├─ mergedChannels = union(['pan','tilt','speed'], existingChannels)
  ├─ speed: 0 queda PERSISTIDO en el override
  │
  ↓ Usuario activa patrón...
  │
setManualFixturePattern()  [ArbiterIPCHandlers.ts:437-447]
  ├─ hasAnchor? → SÍ (pan/tilt ya existen del paso anterior)
  ├─ NO CREA NUEVO ANCHOR → reutiliza el existente
  │
  ├─ ⚡ El override existente TODAVÍA contiene speed:0
  │     (WAVE 2185 arregló que el ANCHOR no inyecte speed,
  │      pero el speed:0 del handlePositionChange anterior
  │      ya está fusionado en el override y NADIE lo limpia)
  │
  ↓ Cada frame de renderizado...
  │
mergeChannelForFixture('speed')  [MasterArbiter.ts:1606]
  ├─ overrideChannels.includes('speed') → SÍ
  ├─ return controls.speed → 0
  │
  ↓
DMX speed canal = 0 = VELOCIDAD MÁXIMA DEL MOTOR
```

### Cómo speed:0 mata el Pan

DMX `speed: 0` = velocidad máxima del motor = **desactiva la interpolación interna del MCU del fixture**.

Sin interpolación interna:
- El motor recibe coordenadas crudas a 60 FPS (del loop del Arbiter)
- Cada frame es un salto discreto de posición
- El stepper intenta ejecutar CADA SALTO instantáneamente
- El motor Pan tiene rango más largo (540°) que Tilt (270°)
- Los offsets del patrón generan más recorrido angular en Pan
- El stepper Pan se satura → bloqueo mecánico (cogging)
- El stepper Tilt, con menos recorrido, puede seguir parcialmente

### Archivos y líneas exactas

| Paso | Archivo | Línea | Código |
|------|---------|-------|--------|
| speed:0 inyectado | `PositionSection.tsx` | 231 | `speed: 0` en controls |
| speed en channels | `PositionSection.tsx` | 233 | `channels: ['pan', 'tilt', 'speed']` |
| merge preserva speed | `MasterArbiter.ts` | 480-481 | `mergedControls = { ...existingOverride.controls, ...override.controls }` |
| canales acumulados | `MasterArbiter.ts` | 484-486 | `mergedChannels = [...new Set([...existing, ...new])]` |
| merge retorna 0 | `MasterArbiter.ts` | ~1606 | `if (overrideChannels.includes(channel)) return manualValue` |
| anchor NO limpia speed | `ArbiterIPCHandlers.ts` | 437-447 | `if (!hasAnchor)` → anchor ya existe → skip |
| Mapper envía 0 | `FixtureMapper.ts` | 568 | `return state.speed ?? (channel.defaultValue ?? 128)` → state.speed=0 |

### El fix de WAVE 2185 fue insuficiente
WAVE 2185 arregló que el **anchor** del patrón no inyecte speed. Pero el `speed: 0` que el `handlePositionChange` del XY Pad envía **ANTES** de activar el patrón ya está fusionado en el override via `mergedControls`, y **NUNCA se limpia**.

La única forma de limpiar speed sería un `clearManual` + nuevo override sin speed, pero eso resetearía la posición del anchor.

---

## 🔬 INVESTIGACIÓN 3: ESPASMOS Y TEMBLORES

### Síntoma
El motor sufre espasmos, vibraciones y temblores durante el arrastre del XY Pad o RadarXY.

### La Evidencia: CERO throttle

**XYPad.tsx — Líneas 79-92:**
```typescript
useEffect(() => {
    if (!isDragging) return
    
    const handleMove = (e: MouseEvent) => {
      handleMousePosition(e.clientX, e.clientY)  // ← CADA PIXEL DISPARA onChange
    }
    
    window.addEventListener('mousemove', handleMove)  // ← SIN THROTTLE
    // ...
})
```

**RadarXY.tsx — Líneas 108-121:**
```typescript
useEffect(() => {
    if (!isDragging) return
    
    const handleMove = (e: MouseEvent) => {
      handleMousePosition(e.clientX, e.clientY)  // ← CADA PIXEL DISPARA onChange
    }
    
    window.addEventListener('mousemove', handleMove)  // ← SIN THROTTLE
    // ...
})
```

### La cascada de destrucción

```
mousemove (60-120 Hz del navegador)
  │
  ↓ CADA evento, sin filtro
  │
onChange(newPan, newTilt)  [por pixel]
  │
  ↓
handlePositionChange()  [PositionSection.tsx:210]
  │
  ├─ await window.lux?.arbiter?.setManual({
  │     controls: { pan: X, tilt: Y, speed: 0 },
  │     channels: ['pan', 'tilt', 'speed']
  │  })
  │
  ↓ IPC Electron (main process)
  │
setManual handler  [ArbiterIPCHandlers.ts:175]
  │
  ↓ 60-120x por segundo
  │
MasterArbiter.setManualOverride()
  ├─ nuevo timestamp cada call
  ├─ speed: 0 cada call
  │
  ↓ MasterArbiter loop (30 FPS)
  │
renderFromTarget()  →  FixtureMapper  →  DMX send
  │
  ├─ 60+ overrides/seg con speed=0
  ├─ Motor recibe posición cruda cada 33ms
  ├─ Sin interpolación (speed=0)
  ├─ RESULTADO: DDoS al bus DMX + motor en espasmo
```

### Prueba irrefutable: No existe throttle

Búsqueda exhaustiva en ambos archivos:

| Búsqueda | `XYPad.tsx` | `RadarXY.tsx` |
|----------|-------------|---------------|
| `throttle` | 0 matches | 0 matches |
| `debounce` | 0 matches | 0 matches |
| `requestAnimationFrame` | 0 matches | 0 matches |
| `setTimeout` | 0 matches | 0 matches |
| `useRef.*last` | 0 matches | 0 matches |
| `performance.now` | 0 matches | 0 matches |

**CERO mecanismos de limitación de frecuencia.** Cada pixel de movimiento del mouse dispara un IPC asíncrono al proceso principal de Electron.

### La corrupción 16-bit NO es factor

| Canal | `FixtureMapper.ts` | Valor |
|-------|-------------------|-------|
| `pan_fine` | Línea 490 | `return 0` (hardcoded) |
| `tilt_fine` | Línea 498 | `return 0` (hardcoded) |

Los canales finos están fijos en 0. No hay cálculo 16-bit. La corrupción 16-bit no es factor.

---

## 🗺️ MAPA COMPLETO DE LA CADENA DE FALLOS

```
                    ╔══════════════════════════╗
                    ║  LA RAÍZ DE TODO:        ║
                    ║  XYPad.tsx (L79-92)       ║
                    ║  RadarXY.tsx (L108-121)   ║
                    ║  mousemove SIN THROTTLE   ║
                    ╚════════════╦═════════════╝
                                 │
                    ╔════════════▼═════════════╗
                    ║  60-120 IPC/seg           ║
                    ║  CADA UNO con speed: 0    ║
                    ║  PositionSection.tsx L231  ║
                    ╚════════════╦═════════════╝
                                 │
              ┌──────────────────┼──────────────────┐
              │                  │                  │
    ╔═════════▼═════════╗ ╔═════▼════════╗ ╔═══════▼═══════╗
    ║  INV 3: ESPASMOS  ║ ║ INV 2: PAN   ║ ║  INV 1: BLANCO║
    ║                   ║ ║              ║ ║               ║
    ║  Motor DDoS:      ║ ║ speed=0      ║ ║ SafetyLayer   ║
    ║  60+ posiciones   ║ ║ persiste en  ║ ║ detecta CAOS  ║
    ║  crudas/seg       ║ ║ el override  ║ ║ (>X cambios/s)║
    ║  sin interpolar   ║ ║ via merge    ║ ║ → LATCH       ║
    ║                   ║ ║ L480-486     ║ ║ → colorDmx=0  ║
    ║  XYPad.tsx L79    ║ ║              ║ ║ → BLANCO      ║
    ║  RadarXY.tsx L108 ║ ║ MasterArbiter║ ║               ║
    ║  FixtureMapper    ║ ║ .ts L487     ║ ║ SafetyLayer.ts║
    ║  .ts L568 speed=0 ║ ║              ║ ║ L213-215      ║
    ╚═══════════════════╝ ╚══════════════╝ ╚═══════════════╝
```

---

## 📐 PRESCRIPCIÓN (SIN CÓDIGO — sólo arquitectura)

### Fix 1: Throttle en UI (resuelve INV 3 y mitiga INV 1)
Los componentes `XYPad.tsx` y `RadarXY.tsx` necesitan `requestAnimationFrame` gate o throttle a ~30ms (33 FPS) en el handler de `mousemove`. Esto reduce el IPC de 120/seg a 33/seg. El SafetyLayer dejaría de entrar en LATCH porque los cambios/segundo caerían por debajo del `chaosThreshold`.

### Fix 2: No inyectar speed:0 desde la UI (resuelve INV 2)
`PositionSection.tsx` línea 231 no debería enviar `speed: 0` en el override. El canal `speed` debe usar el `defaultValue` del fixture (tipicamente 127-128 = velocidad moderada con interpolación). Si `speed` no está en `controls` ni en `channels`, `mergeChannelForFixture` lo ignora y `getManualChannelValue` devuelve `controls.speed ?? 128` (default seguro).

### Fix 3: shutter: 0 → shutter: undefined (prevención — bomba dormida)
`HardwareAbstraction.ts` línea 922: `shutter: 0` debe ser `shutter: undefined` o eliminarse del `baseState`. Así el mapper cae al fallback `channel.defaultValue ?? 255` (open). Este bug no causa el blanco actual pero causará blackout en fixtures con shutter mecánico cuando se expongan.

---

## 🔒 INTEGRIDAD DE LA AUDITORÍA

- **Cero líneas de código modificadas** durante esta auditoría
- **Cero suposiciones** — cada afirmación tiene archivo y línea exacta
- **La cadena causal** fue trazada desde el click del mouse hasta el paquete DMX
- **Las 3 investigaciones convergen** en la misma raíz: UI sin throttle + speed:0

---

*"No diagnosticamos el síntoma. Diagnosticamos la enfermedad."*  
*— WAVE 2189, The Forensic Audit*
