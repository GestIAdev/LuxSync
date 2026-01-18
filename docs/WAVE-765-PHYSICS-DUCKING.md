# 🎚️ WAVE 765 - PHYSICS DUCKING: Cuando el Efecto Habla, la Física Calla

**Fecha:** 2026-01-18  
**Arquitecto:** Radwulf  
**Ejecutor:** PunkOpus

---

## 📋 DIRECTIVA TÁCTICA

> "Vamos a enseñar a Selene modales: Cuando un efecto habla, la física baja la voz."

---

## 🎯 EL PROBLEMA: MASKING

La reactividad física (Physics Engine - WAVE 760) era tan fuerte y precisa que "enmascaraba" los efectos sutiles como TidalWave.

### Diagnóstico Técnico:

```typescript
// TitanOrchestrator.ts - ANTES (HTP)
dimmer: Math.max(fixtureStates[index].dimmer, effectDimmer)
```

| Componente | Valor | Resultado |
|------------|-------|-----------|
| Physics (bombo) | 0.85 | **GANA** |
| TidalWave (valle) | 0.10 | Ignorado |
| **Final** | **0.85** | ❌ Valle invisible |

**Consecuencia:** Los valles de la ola nunca se veían porque la física siempre ganaba con HTP (Highest Takes Precedence).

---

## ✅ LA SOLUCIÓN: LTP (Latest Takes Precedence)

### Filosofía Arquitectónica:

> "Si un efecto se toma la molestia de especificar un dimmer para una zona, **ESE EFECTO MANDA**. La física queda silenciada."

### Nuevo Paradigma:

```typescript
// TitanOrchestrator.ts - AHORA (LTP)
dimmer: effectDimmer  // El efecto tiene la última palabra
```

| Componente | Valor | Resultado |
|------------|-------|-----------|
| Physics (bombo) | 0.85 | Silenciada |
| TidalWave (valle) | 0.10 | **MANDA** |
| **Final** | **0.10** | ✅ Valle visible |

---

## 🔧 CAMBIOS IMPLEMENTADOS

### 1. TitanOrchestrator.ts - Zone Overrides (Línea ~403)

```typescript
// ═══════════════════════════════════════════════════════════════════════
// 🎚️ WAVE 765: PHYSICS DUCKING - LTP (Latest Takes Precedence)
// ANTES: Math.max() → La física (0.8-1.0) SIEMPRE ganaba, matando valles
// AHORA: effectDimmer → Si el efecto dice 0.1, la luz BAJA a 0.1
// ═══════════════════════════════════════════════════════════════════════
if (zoneData.dimmer !== undefined) {
  const effectDimmer = Math.round(zoneData.dimmer * 255)
  fixtureStates[index] = {
    ...fixtureStates[index],
    dimmer: effectDimmer,  // LTP: El efecto tiene la última palabra
  }
}
```

### 2. TitanOrchestrator.ts - Legacy Zonal Mode (Línea ~506)

```typescript
// 🎚️ WAVE 765: PHYSICS DUCKING - MODO ZONAL (Legacy)
// LTP: Si el efecto especifica intensidad, la física se calla.
const effectDimmer = Math.round(flareIntensity * 255)
const finalDimmer = effectDimmer  // LTP: El efecto manda
```

### 3. TitanOrchestrator.ts - Global Override (Excepciones)

```typescript
// 🎚️ WAVE 765: MODO SOLAR FLARE - Override completo
// NOTA: Aquí MANTENEMOS HTP porque SolarFlare quiere SUMARSE al pico.
// globalOverride=true indica "quiero ser más brillante que todo".
dimmer: Math.max(f.dimmer, Math.round(flareIntensity * 255)),  // HTP: SolarFlare suma
```

### 4. TidalWave.ts - Valley Inclusion (Línea ~186)

```typescript
// ═══════════════════════════════════════════════════════════════════════
// 🎚️ WAVE 765: PHYSICS DUCKING - Incluir TODAS las zonas, incluso valles
// ANTES: Solo incluíamos zonas con intensity > 0.1, dejando valles a la física
// AHORA: Incluimos TODAS las zonas con ANY intensity (threshold 0.02)
// ═══════════════════════════════════════════════════════════════════════
for (const [zone, zoneIntensity] of this.zoneIntensities) {
  if (zoneIntensity > 0.02) {  // Prácticamente apagado pero presente
    // ... zone override con dimmer bajo
  }
}
```

---

## 🌊 ANÁLISIS DE IMPACTO POR EFECTO

| Efecto | Tipo | Impacto WAVE 765 |
|--------|------|------------------|
| **TidalWave** | Espacial con valles | ✅ MAYOR - Valles ahora visibles |
| **GhostBreath** | Respiratorio | ✅ Respiración más definida |
| **CumbiaMoon** | Ondulatorio | ✅ Contraste mejorado |
| **ClaveRhythm** | Flash percusivo | ⚡ Sin cambio (no tiene valles) |
| **TropicalPulse** | Flash colorido | ⚡ Sin cambio (siempre alto) |
| **StrobeBurst** | Strobe | ⚡ Sin cambio (flashes discretos) |
| **SalsaFire** | Fuego parpadeante | ✅ Parpadeo más limpio |
| **SolarFlare** | Global flash | ⚙️ Mantiene HTP (intencional) |
| **CorazonLatino** | Heartbeat épico | ✅ Latido más dramático |

---

## 🎯 REGLAS DE PRIORIDAD POST-WAVE 765

```
┌──────────────────────────────────────────────────────────────────┐
│                    JERARQUÍA DE CONTROL                          │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. zoneOverrides.dimmer    → LTP (El efecto manda)             │
│                                                                  │
│  2. globalOverride=true     → HTP (Se suma al pico)             │
│                                                                  │
│  3. Sin override            → Physics Engine (Base reactiva)    │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### Cómo Elegir el Modo:

| Quiero... | Usar | Ejemplo |
|-----------|------|---------|
| Control total con valles | `zoneOverrides` + `dimmer` | TidalWave, GhostBreath |
| Sumarme al pico | `globalOverride: true` | SolarFlare |
| Dejar que la física decida | No enviar `dimmer` | Efectos de color puro |

---

## 📊 RESULTADO VISUAL ESPERADO

### ANTES (HTP - Masking):
```
Physics:  ▃▃█▃▃█▃▃█▃▃█▃▃█▃▃  (sigue el beat)
TidalWave: ▁▂▃▅█▅▃▂▁▁▂▃▅█▅▃  (ola)
Final:    ▃▃█▅▅█▃▃█▃▃█▃▃█▃▃  (valles enmascarados)
```

### AHORA (LTP - Ducking):
```
Physics:  ▃▃█▃▃█▃▃█▃▃█▃▃█▃▃  (sigue el beat)
TidalWave: ▁▂▃▅█▅▃▂▁▁▂▃▅█▅▃  (ola)
Final:    ▁▂▃▅█▅▃▂▁▁▂▃▅█▅▃  (efecto puro visible)
```

**El escenario se oscurece y solo cruza la ola.** ✨

---

## 🔬 ARCHIVOS MODIFICADOS

```
electron-app/src/core/orchestrator/TitanOrchestrator.ts
  ├── Línea ~403: zoneOverrides dimmer → LTP
  ├── Línea ~501: globalOverride dimmer → HTP (mantenido)
  └── Línea ~506: legacy zonal dimmer → LTP

electron-app/src/core/effects/library/TidalWave.ts
  └── Línea ~186: Threshold 0.1 → 0.02 (incluir valles)
```

---

## 🎭 NOTA FILOSÓFICA

> "La física es el ritmo de la sala. El efecto es el solista que toma el micrófono. Cuando el solista canta, la banda baja el volumen. Eso es *ducking*."

WAVE 765 transforma a Selene de un sistema HTP rígido (el más fuerte gana) a un sistema LTP inteligente (el más intencional gana). Los efectos ahora pueden expresar **sutileza** y **contraste**, no solo **potencia**.

---

**STATUS:** ✅ IMPLEMENTED  
**NEXT:** Test visual con TidalWave en producción
