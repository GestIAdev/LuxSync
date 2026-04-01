# WAVE 2428 — THE OMNI-LIQUID BLUEPRINT

> **Clasificación**: Documento Arquitectónico Pre-Demolición  
> **Estado**: Pendiente de Autorización del Cónclave  
> **Motor Objetivo**: Omni-Liquid Engine (4.1 + 7.1 hot-swap, multi-género)  
> **Fecha**: 31 Marzo 2026  

---

## 1. MAPA DEL SISTEMA ACTUAL

### 1.1 Motores Existentes

```
hal/physics/
├── LiquidStereoPhysics.ts       ← WAVE 2427 | 7.1 | Perfil-driven | TECHNO ONLY
├── TechnoStereoPhysics.ts       ← WAVE 770  | 4.1 | Hardcoded líquido
├── LatinoStereoPhysics.ts       ← WAVE 1004 | 4.1 | Hardcoded (Galán/Dama)
├── RockStereoPhysics2.ts        ← WAVE 1018 | 4.1 | Memoria 30s + Subgéneros
├── ChillStereoPhysics.ts        ← inline    | 4.1 | Calculado en SeleneLux
├── LiquidEnvelope.ts            ← Pipeline 9 etapas (compartido)
├── profiles/
│   ├── ILiquidProfile.ts        ← 35 campos, puro dato
│   ├── techno.ts                ← TECHNO_PROFILE (el único que existe)
│   └── index.ts                 ← PROFILE_REGISTRY + DEFAULT
```

### 1.2 Cruce de Dependencias Actual

```
                    ┌──────────────┐
                    │  SeleneLux   │ ← Orquestador central
                    │  (dispatch)  │
                    └──────┬───────┘
                           │
              vibeNormalized.includes()
                           │
         ┌─────────────────┼─────────────────┬───────────────────┐
         ▼                 ▼                  ▼                   ▼
  ┌──────────────┐  ┌──────────────┐  ┌───────────────┐  ┌──────────────┐
  │   Techno     │  │   Rock       │  │   Latino      │  │   Chill      │
  │              │  │              │  │               │  │   (inline)   │
  │  useLiquid?  │  │  Siempre     │  │  Siempre      │  │  Siempre     │
  │  ┌───┴───┐   │  │  Legacy      │  │  Legacy       │  │  Legacy      │
  │  │Yes│No │   │  │              │  │               │  │              │
  │  ▼   ▼   │  │  └──────────────┘  └───────────────┘  └──────────────┘
  │ Liq  Tch │  │
  │ 7.1  4.1 │  │
  └──────────────┘
         │
    ┌────▼────────────┐
    │ ILiquidProfile  │
    │ TECHNO_PROFILE  │ ← Único perfil existente
    └─────────────────┘
```

### 1.3 Diagnóstico

| Aspecto | Estado |
|---------|--------|
| **Techno 7.1** (LiquidStereoPhysics) | ✅ WAVE 2427 — operativo, perfil-driven |
| **Techno 4.1** (TechnoStereoPhysics) | ⚠️ Hardcodeado pero con dinámicas líquidas propias (morphology, avgPunch, Tidal Gate). 26 variables de estado internas |
| **Latino 4.1** (LatinoStereoPhysics) | ⚠️ Hardcodeado. Zona Galán/Dama con Solar Flare + Machine Gun Blackout + White Puncture |
| **Rock 4.1** (RockStereoPhysics2) | 🔴 Arquitectura radicalmente distinta: Memoria Histórica 30s, Spectral Centroid, detección de subgéneros (Prog/Hard/Classic) al vuelo |
| **Chill** | ⚠️ Inline en SeleneLux, sin clase propia |
| **Toggle UI 4.1↔7.1** | Solo existe para Techno (`setLiquidStereo`) |
| **Perfiles Latino/Rock/Chill** | ❌ No existen |

**Deuda técnica crítica**: 4 motores con lógica duplicada (kick detection, envelope processing, silence handling), 3 de ellos con constantes hardcodeadas.

---

## 2. EVALUACIÓN DE RUTAS: MOTOR UNIFICADO vs CLASES SEPARADAS

### 2.1 Opción A — Un Solo Motor Unificado

Un solo `OmniLiquidEngine` que soporte 4.1 y 7.1 con flags internos.

| | |
|---|---|
| **Pro** | Un solo lugar para corregir bugs. Una sola interfaz de input/output. |
| **Pro** | Hot-swap trivial — solo cambia el perfil, el número de zonas es un dato más. |
| **Contra** | **El método `applyBands()` se convierte en un monstruo de 500+ líneas** con bifurcaciones `if (mode === '7.1')` por todas partes. |
| **Contra** | **El Rock tiene Memoria Histórica de 30s** — la ventana deslizante, el centroid acumulado, la tabla de subgéneros. Inyectar eso en el motor base lo ensucia para TODOS los géneros. |
| **Contra** | **El Latino tiene efectos exclusivos** (Solar Flare, Machine Gun Blackout, White Puncture) que no tienen sentido en Techno ni Rock. |
| **Contra** | **Testeo abisal**: cada cambio puede romper 3 géneros a la vez. |
| **Contra** | **Viola el principio de responsabilidad única** — un motor que tiene que saber de congas, guitarras, sintes y hi-hats simultáneamente. |

**Veredicto**: ❌ La divergencia entre Rock (stateful con memoria) y Techno/Latino (stateless reactivo) es demasiado radical. Un motor unificado acumularía complejidad accidental.

### 2.2 Opción B — Clases Separadas con Base Común (RECOMENDADA)

Dos motores (`LiquidEngine41` y `LiquidEngine71`) que heredan de una clase abstracta `LiquidEngineBase`, compartiendo:
- El pipeline de `LiquidEnvelope`
- Silence/AGC handling
- Kick detection
- Strobe logic
- MorphFactor calculation

Cada motor implementa su propio `routeZones()` con el mapping banda→zona correcto para su topología.

| | |
|---|---|
| **Pro** | **Separación limpia**: 4.1 tiene su lógica de 4 zonas, 7.1 tiene sus 7. Sin bifurcaciones. |
| **Pro** | **El Rock puede tener su módulo de memoria** como composición exclusiva dentro de `LiquidEngine41`, sin contaminar el 7.1. |
| **Pro** | **Testeo quirúrgico**: tocar el 7.1 no puede romper el 4.1. |
| **Pro** | **Alineado con la preferencia del Arquitecto** (Radwulf). |
| **Pro** | **El ILiquidProfile no necesita cambiar su estructura core** — cada motor lee los campos que necesita. |
| **Contra** | Dos clases que mantener en paralelo. |
| **Contra** | Los cambios en la base requieren verificar ambos motores. |

**Veredicto**: ✅ La ruta correcta. Separación + herencia.

### 2.3 Mapa de Herencia Propuesto

```
                         ┌─────────────────────────┐
                         │    LiquidEngineBase      │ ← abstract
                         │                          │
                         │  - profile: ILiquidProfile
                         │  - 6× LiquidEnvelope     │
                         │  - morphFactor calc       │
                         │  - silence/AGC handling   │
                         │  - kick edge detection    │
                         │  - strobe logic           │
                         │                          │
                         │  abstract routeZones()    │
                         └────────┬────────┬────────┘
                                  │        │
                    ┌─────────────┘        └─────────────┐
                    ▼                                     ▼
          ┌──────────────────┐                  ┌──────────────────┐
          │  LiquidEngine41  │                  │  LiquidEngine71  │
          │                  │                  │                  │
          │  4 zonas:        │                  │  7 zonas:        │
          │  Front, Back,    │                  │  FL, FR, BL, BR, │
          │  MoverL, MoverR  │                  │  ML, MR, Strobe  │
          │                  │                  │                  │
          │  + RockMemory?   │                  │  routeZones()    │
          │    (composición) │                  │  = WAVE 2427     │
          │                  │                  │                  │
          │  routeZones()    │                  └──────────────────┘
          └──────────────────┘
```

---

## 3. EL RETO DE LOS 3 PERFILES

### 3.1 Techno & Latino: Perfiles Instantáneos (Puro Dato)

`ILiquidProfile` ya cubre el 100% de lo que Techno y Latino necesitan. Los 35 campos son puros coeficientes numéricos — la diferencia entre un snare techno y una conga latina es solo una fila de números distinta.

**Techno** (ya existe):
```
percMidSubtract: 1.0     ← Aislamiento espectral agresivo
percBoost: 5.0           ← Schwarzenegger: snare amplificado
envelopeSnare.gateOn: 0.15  ← Gate limpio (WAVE 2427)
moverLTonalThreshold: 0.4   ← Selectivo en melodías
```

**Latino** (por crear):
```
percMidSubtract: 0.3     ← Las congas son mid-heavy, no las destruyas
percBoost: 3.0           ← Conga más suave que snare
envelopeSnare.gateOn: 0.08  ← Congas más sutiles que snares
envelopeVocal.boost: 3.0    ← Voces al máximo (salsa/reggaetón)
moverLTonalThreshold: 0.6   ← Más permisivo con melodías
```

**Cobertura de efectos Latino** (Solar Flare, Machine Gun Blackout, White Puncture):
- Solar Flare = Kick accent → ya cubierto por `envelopeKick.boost` + perfil.
- Machine Gun Blackout y White Puncture = Efectos de TRANSICIÓN (drop detection). No pertenecen al perfil de audio — pertenecen al sistema de **secciones** (`sectionType`). Propuesta: mover a un `TransitionEffects` módulo paralelo, consultable por ambos motores.

### 3.2 Rock: El Problema del Módulo de Memoria

Rock es radicalmente distinto porque necesita **estado acumulado**:

```
RockStereoPhysics2 internals:
├── spectralHistory[30s]    ← Ventana deslizante de 30 segundos
├── centroidAvg             ← Media del spectral centroid
├── flatnessAvg             ← Media del flatness
├── clarityAvg              ← Media del clarity
├── detectedSubgenre        ← 'prog' | 'hard' | 'classic'
└── subgenreConfidence      ← 0.0 - 1.0 (threshold 70%)
```

Esto **NO puede ir** en `ILiquidProfile` porque no es dato estático — es **lógica de runtime con memoria**. 

**Solución: Composición, no Herencia**

```typescript
// Nuevo archivo: hal/physics/modules/RockMemoryModule.ts

export interface IRockMemoryConfig {
  readonly windowSeconds: number          // 30
  readonly subgenreThreshold: number      // 0.70
  readonly centroidRanges: {
    prog:  [number, number]               // [500, 1500]
    hard:  [number, number]               // [1000, 3000]
    classic: [number, number]             // [800, 2000]
  }
  readonly flatnessProgMax: number        // 0.05
  readonly harshnessHardMin: number       // 0.20
}

export class RockMemoryModule {
  private history: SpectralFrame[] = []
  private detectedSubgenre: RockSubgenre = 'classic'
  
  /** Alimentar un frame y recalcular subgénero */
  update(centroid: number, flatness: number, harshness: number, clarity: number): void
  
  /** Devuelve el subgénero detectado + confianza */
  getSubgenre(): { genre: RockSubgenre, confidence: number }
  
  /** Devuelve coeficientes adaptativos según subgénero */
  getAdaptiveCoefficients(): RockAdaptiveParams
}
```

Y en `ILiquidProfile` añadimos UN campo opcional:

```typescript
export interface ILiquidProfile {
  // ... 35 campos existentes ...
  
  /** Configuración del módulo de memoria Rock (solo usado por Rock profiles) */
  readonly rockMemory?: IRockMemoryConfig
}
```

Cuando `LiquidEngine41` (o `71`) recibe un perfil con `rockMemory` definido, instancia el módulo. Si no tiene `rockMemory`, ignora — cero overhead para Techno/Latino.

### 3.3 Extensión del ILiquidProfile

```typescript
// ILiquidProfile.ts — CAMPOS NUEVOS (backward-compatible, todos opcionales)

export interface ILiquidProfile {
  // ═══════ EXISTENTES (35 campos) — SIN CAMBIOS ═══════
  // ...

  // ═══════ NUEVOS — WAVE 2428 ═══════
  
  /** Módulo de memoria Rock — detección de subgéneros */
  readonly rockMemory?: IRockMemoryConfig
  
  /** Efectos de transición (Machine Gun, White Puncture, Solar Flare) */
  readonly transitionEffects?: ITransitionEffectsConfig
  
  /** Voice Rejection Filter — Rock usa 3-stage, Latino no lo necesita */
  readonly voiceRejection?: IVoiceRejectionConfig

  /** Back R routing override — WAVE 2427: trebleDelta (transient shaper) */
  readonly backRMode?: 'spectral-subtract' | 'transient-shaper' | 'raw-treble'
  readonly backRMultiplier?: number   // ×4.0 para transient, ×1.5 para raw
}
```

Cada perfil activa SOLO lo que necesita. Techno no paga por la memoria de Rock. Rock no paga por el Solar Flare de Latino.

---

## 4. EL NUEVO MAPA DEL SISTEMA (PROPOSED)

### 4.1 Archivos que Mueren (Post-Migración)

| Archivo | Razón de Muerte | Sucesor |
|---------|-----------------|---------|
| `TechnoStereoPhysics.ts` | Hardcodeado. Toda su lógica migra a `LiquidEngine41` + `TECHNO_PROFILE` | `LiquidEngine41` + `profiles/techno.ts` |
| `LatinoStereoPhysics.ts` | Hardcodeado. Solar Flare y efectos migran a módulo. Galán/Dama son coeficientes de perfil | `LiquidEngine41` + `profiles/latino.ts` |
| `RockStereoPhysics2.ts` | Memoria y subgéneros se extraen a `RockMemoryModule`. Routing se parametriza | `LiquidEngine41` + `profiles/rock.ts` + `RockMemoryModule` |
| `ChillStereoPhysics.ts` (inline en SeleneLux) | Se convierte en perfil | `LiquidEngine41` + `profiles/chill.ts` |

**No muere nadie hasta que su sucesor esté 100% validado.**

### 4.2 Archivos que Nacen

```
hal/physics/
├── LiquidEngineBase.ts          ← NUEVA: Clase abstracta con lógica compartida
├── LiquidEngine41.ts            ← NUEVA: Motor 4.1 (Front, Back, MoverL, MoverR)
├── LiquidEngine71.ts            ← RENOMBRADO de LiquidStereoPhysics.ts
│                                   (contenido actual WAVE 2427, sin cambios)
├── LiquidEnvelope.ts            ← SIN CAMBIOS
├── modules/
│   ├── RockMemoryModule.ts      ← NUEVA: Ventana 30s + subgénero detection
│   ├── TransitionEffects.ts     ← NUEVA: Solar Flare, Machine Gun, White Puncture
│   └── VoiceRejectionFilter.ts  ← NUEVA: Extraída de RockStereoPhysics2
├── profiles/
│   ├── ILiquidProfile.ts        ← EXTENDIDA: +4 campos opcionales
│   ├── index.ts                 ← EXTENDIDA: registry con 4+ perfiles
│   ├── techno.ts                ← SIN CAMBIOS (ya existe, WAVE 2427)
│   ├── latino.ts                ← NUEVA: Galán/Dama en coeficientes
│   ├── rock.ts                  ← NUEVA: + rockMemory config
│   └── chill.ts                 ← NUEVA: Perfil ambient/downtempo
```

### 4.3 Estructura de Directorio Final

```
hal/physics/
│
├── core/
│   ├── LiquidEngineBase.ts          ← Abstract: envelopes, morph, silence, kick, strobe
│   ├── LiquidEngine41.ts            ← 4 zonas: front, back, moverL, moverR  
│   ├── LiquidEngine71.ts            ← 7 zonas: FL, FR, BL, BR, ML, MR, strobe
│   └── LiquidEnvelope.ts            ← Pipeline 9 etapas (intacto)
│
├── modules/
│   ├── RockMemoryModule.ts          ← Spectral history + subgenre detection
│   ├── TransitionEffects.ts         ← Drop/breakdown effects (opt-in)
│   └── VoiceRejectionFilter.ts      ← 3-stage filter (opt-in)
│
├── profiles/
│   ├── ILiquidProfile.ts            ← Contrato universal
│   ├── index.ts                     ← Registry + default
│   ├── techno.ts                    ← ⚡ Instantáneo, transient shaper
│   ├── latino.ts                    ← 💃 Galán/Dama, conga sensitivity
│   ├── rock.ts                      ← 🎸 + IRockMemoryConfig
│   └── chill.ts                     ← 🌊 Océano lento
│
├── __tests__/
│   ├── LiquidEngine41.test.ts
│   ├── LiquidEngine71.test.ts
│   └── RockMemoryModule.test.ts
│
│  ┌──────────────────────────────────────────┐
│  │  ARCHIVO MUERTOS (eliminables tras       │
│  │  validación completa del sucesor):       │
│  │                                          │
│  │  TechnoStereoPhysics.ts     → Engine41   │
│  │  LatinoStereoPhysics.ts     → Engine41   │
│  │  RockStereoPhysics2.ts      → Engine41   │
│  │  ChillStereoPhysics.ts      → Engine41   │
│  │  LiquidStereoPhysics.ts     → Engine71   │
│  └──────────────────────────────────────────┘
```

---

## 5. EL MECANISMO DE ORQUESTACIÓN

### 5.1 El Flujo Completo

```
┌───────────┐     ┌──────────┐     ┌──────────────────┐     ┌─────────────────┐
│  UI Switch │────▶│ TitanIPC │────▶│    SeleneLux      │────▶│  LiquidEngine   │
│  4.1 / 7.1│     │          │     │  (Orquestador)    │     │  41 o 71        │
└───────────┘     └──────────┘     └──────────────────┘     └─────────────────┘
                                          │                          │
                                   Vibe Detection              Profile Inject
                                   Genre → Profile             hot-swap
                                          │                          │
                                          ▼                          ▼
                                   ┌──────────────┐         ┌──────────────┐
                                   │ PROFILE_REG  │         │ 7 bandas in  │
                                   │ techno/rock/ │         │ 4 o 7 zonas  │
                                   │ latino/chill │         │ out          │
                                   └──────────────┘         └──────────────┘
```

### 5.2 SeleneLux — Refactorización del Dispatch

```typescript
// SeleneLux.ts — WAVE 2428 Architecture

class SeleneLux {
  // Motores pre-instanciados — cero latencia de constructor
  private engine41: LiquidEngine41
  private engine71: LiquidEngine71
  
  // Estado del switch
  private useExtendedLayout: boolean = false  // false = 4.1, true = 7.1
  
  // Perfil activo (cambia con el género detectado)
  private activeProfile: ILiquidProfile = DEFAULT_LIQUID_PROFILE

  /**
   * Llamado por TitanEngine vía IPC cuando el usuario toca el switch en la UI.
   * Latencia: 0ms — solo cambia un booleano + re-inyecta perfil.
   */
  setLayout(mode: '4.1' | '7.1'): void {
    this.useExtendedLayout = mode === '7.1'
    // Re-inyectar perfil en el motor correspondiente
    this.getActiveEngine().setProfile(this.activeProfile)
  }

  /**
   * Llamado cuando cambia el vibe (detección de género automática o manual).
   * Busca el perfil en el registry y lo inyecta en el motor activo.
   */
  setGenre(vibeNormalized: string): void {
    this.activeProfile = PROFILE_REGISTRY[vibeNormalized] ?? DEFAULT_LIQUID_PROFILE
    this.getActiveEngine().setProfile(this.activeProfile)
  }

  /**
   * Frame-by-frame: delega al motor activo según el switch.
   */
  processFrame(input: LiquidStereoInput): StereoResult {
    return this.getActiveEngine().process(input)
  }

  private getActiveEngine(): LiquidEngineBase {
    return this.useExtendedLayout ? this.engine71 : this.engine41
  }
}
```

### 5.3 Latencia Cero — Por qué funciona

1. **Ambos motores están pre-instanciados**. No hay `new` en runtime. El switch es un booleano.
2. **El perfil es puro dato** (objeto literal readonly). Inyectarlo = asignar una referencia. O(1).
3. **Los LiquidEnvelope viven dentro del motor**. Al cambiar de perfil, se les pasa la nueva config en el siguiente frame. Sin re-instanciación.
4. **El RockMemoryModule** (cuando existe) mantiene su historia entre frames. El cambio de perfil no la borra — solo cambia los umbrales de decisión.

### 5.4 Flujo de Datos por Frame

```
GodEarFFT → 7 bandas
                │
                ▼
         ┌─────────────┐
         │  SeleneLux   │
         │              │
         │  mode=4.1?───┼──── ▶ LiquidEngine41.process(bands, profile)
         │    │         │           │
         │  mode=7.1?───┼──── ▶ LiquidEngine71.process(bands, profile)
         │              │           │
         └─────────────┘           ▼
                              ┌──────────────────────┐
                              │  StereoResult         │
                              │                       │
                              │  4.1 → {              │
                              │    front, back,       │
                              │    moverL, moverR,    │
                              │    strobe             │
                              │  }                    │
                              │                       │
                              │  7.1 → {              │
                              │    frontL, frontR,    │
                              │    backL, backR,      │
                              │    moverL, moverR,    │
                              │    strobe             │
                              │  }                    │
                              └──────────────────────┘
```

### 5.5 El Contrato de Salida Unificado

Para que la capa superior (DMX routing) no tenga que saber si recibe 4.1 o 7.1:

```typescript
export interface StereoResult {
  // 7.1 — siempre presente
  frontLeft: number
  frontRight: number
  backLeft: number
  backRight: number
  moverLeft: number
  moverRight: number
  strobeActive: boolean
  strobeIntensity: number
  
  // Metadata
  layout: '4.1' | '7.1'
}
```

En modo 4.1, el motor devuelve:
- `frontLeft = frontRight = front` (duplicado)
- `backLeft = backRight = back` (duplicado)

O alternativamente, la capa DMX mapea 4 zonas a los 7 canales aplicando sus propias reglas de merge. Ambos enfoques son válidos — la decisión depende de si queremos que el motor 4.1 "opine" sobre el split L/R o que eso lo haga DMX downstream.

---

## 6. PLAN DE EJECUCIÓN POR FASES

### FASE 0 — Preparación (Pre-Demolición)
Crear la interfaz `StereoResult` unificada y preparar `LiquidEngineBase` abstracta extrayendo lógica compartida de `LiquidStereoPhysics.ts` actual.

### FASE 1 — Extracción Techno 4.1
Migrar la lógica de `TechnoStereoPhysics.ts` a `LiquidEngine41` usando `TECHNO_PROFILE`. El motor original no se borra — coexisten en paralelo hasta validación A/B.

### FASE 2 — Perfil Latino
Crear `profiles/latino.ts` con los coeficientes de Galán/Dama. Extraer `TransitionEffects` como módulo. Migrar `LatinoStereoPhysics.ts` a `LiquidEngine41 + LATINO_PROFILE`.

### FASE 3 — Perfil Rock + RockMemoryModule
Extraer la ventana de 30s y la detección de subgéneros a `RockMemoryModule.ts`. Crear `profiles/rock.ts` con `rockMemory` config. Migrar `RockStereoPhysics2.ts`.

### FASE 4 — Wire a SeleneLux + UI Switch
Refactorizar el dispatch en SeleneLux para usar el esquema `getActiveEngine()`. Conectar el toggle de UI al `setLayout()` vía IPC.

### FASE 5 — Validación Final + Cementerio
Tests A/B: cada motor legacy vs su sucesor perfil-driven. Cuando el sucesor pasa, el legacy se archiva.

---

## 7. RIESGOS Y MITIGACIONES

| Riesgo | Severidad | Mitigación |
|--------|-----------|------------|
| La Memoria Histórica de Rock introduce latencia | Media | `RockMemoryModule` opera sobre un ring buffer de tamaño fijo (30s × frameRate). Sin allocations dinámicas. |
| Perfiles Latino/Rock no son calibrables a la primera | Baja | Monte Carlo contra logs capturados (mismo método WAVE 2419). Los logs de `LatinoStereoPhysics` y `RockStereoPhysics2` existentes sirven como ground truth. |
| El switch 4.1↔7.1 causa un "flash" visual al cambiar de motor | Media | Ambos motores comparten la misma instancia de `LiquidEnvelope`. El estado del envelope (peak memory, decay position) se transfiere, no se reinicia. |
| `ILiquidProfile` crece demasiado con campos opcionales | Baja | Los campos nuevos son `readonly` y opcionales (`?`). TypeScript garantiza dead code elimination. |

---

## 8. DECISIÓN ARQUITECTÓNICA FINAL

```
╔══════════════════════════════════════════════════════════════════════╗
║                                                                      ║
║  RUTA APROBADA: CLASES SEPARADAS (B)                                ║
║                                                                      ║
║  • LiquidEngine41 — Motor 4.1 para instalaciones compactas          ║
║  • LiquidEngine71 — Motor 7.1 para rigs extendidos (actual WAVE)    ║
║  • LiquidEngineBase — Abstract con lógica compartida                 ║
║  • ILiquidProfile — Extendido con campos opcionales                  ║
║  • RockMemoryModule — Composición, no herencia                       ║
║  • PROFILE_REGISTRY — Hot-swap por vibe detection                    ║
║  • SeleneLux — Dispatch dual (layout × genre)                        ║
║                                                                      ║
║  PRINCIPIO RECTOR:                                                   ║
║  "Un perfil es puro dato. Un módulo es pura lógica.                  ║
║   El motor solo conecta cables."                                     ║
║                                                                      ║
╚══════════════════════════════════════════════════════════════════════╝
```

---

*Pendiente de autorización del Cónclave para iniciar Fase 0.*
