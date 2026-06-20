# AUDITORIA ARSENAL — TECHNO & LATINO
## OPERACION: TUNGSTEN INTEGRATION
**Fecha:** 2026-06-19  
**Auditor:** Ingeniero Core  
**Scope:** `src/core/arsenal/builtins/techno` + `src/core/arsenal/builtins/latin` (efectos .lfx reales)  
**Ignorados:** PopRock, Chillout, legacy archive

---

## RESUMEN EJECUTIVO

- **37 efectos auditados** (23 Techno + 14 Latino)
- **CERO efectos** usan la zona `flash` en sus tracks
- **3 efectos** usan `ambient`: `acid_sweep`, `corazon_latino`, `tidal_wave`
- **2 efectos** usan `air`: `acid_sweep`, `tidal_wave`
- **El problema real** no es solo que falta `flash` — es que el Tungsten se añade al stage con `zone: 'unassigned'` por defecto, y el `IntentComposer` ignora `zones: ['all']` cuando hay `zoneOverrides`

---

## TAREA 1: CLASIFICACION POR NIVEL ENERGETICO (.lfx REALES)

### TECHNO ARSENAL (23 efectos .lfx)

| EnergyZone | Efecto | Aggression | Strobe | Divine | Heavy | Zonas en Tracks | Notas |
|------------|--------|------------|--------|--------|-------|-----------------|-------|
| **PEAK** | `core_meltdown` | 1.00 | YES | YES | YES | *(ninguna)* | Dictador global sin tracks |
| | `industrial_strobe` | 1.00 | YES | YES | YES | *(ninguna)* | Dictador global sin tracks |
| | `neon_blinder` | 0.98 | YES | YES | YES | *(ninguna)* | Dictador global sin tracks |
| | `wraht_of_the_titans` | 1.00 | YES | YES | YES | `all-movers`, `all-pars` | Strobe en PARs + movers |
| | `gatling_raid` | 0.93 | YES | YES | YES | `all-movers`, `back`, `front` | |
| | `strobe_storm` | 0.95 | YES | YES | YES | *(ninguna)* | Dictador global |
| | `void_collapse` | 0.95 | NO | YES | YES | `all-movers`, `all-pars` | |
| | `lateral_frag` | 0.92 | YES | NO | YES | `all-movers`, `back`, `front` | |
| | `machine_gun` | 1.00 | YES | NO | YES | `all-movers`, `all-pars` | |
| **INTENSE** | `cascade_strike` | 0.85 | YES | NO | YES | `all-movers`, `back`, `front` | |
| | `binary_glitch` | 0.88 | YES | YES | NO | `back`, `front` | |
| | `red_surge` | 0.88 | YES | YES | YES | `all-movers`, `all-pars` | |
| | `cyber_scanner` | 0.90 | NO | NO | YES | `all-movers`, `all-pars` | |
| | `seismic_snap` | 0.87 | YES | NO | YES | *(ninguna)* | Dictador global |
| **ACTIVE** | `static_pulse` | 0.75 | YES | NO | NO | *(ninguna)* | |
| | `strobe_burst` | 0.90 | YES | NO | YES | *(ninguna)* | |
| | `acid_sweep` | 0.45 | NO | NO | NO | `air`, `all-movers`, `all-pars`, `ambient`, `back`, `floor`, `front`, `movers-left`, `movers-right` | **UNICO con `ambient` + `air`** |
| | `abyssal_rise` | 0.70 | YES | NO | YES | `all-movers`, `all-pars` | |
| **GENTLE** | `ambient_strobe` | 0.70 | YES | NO | NO | *(ninguna)* | |
| | `ghost_chase` | 0.50 | NO | NO | NO | *(ninguna)* | |
| | `void_mist` | 0.60 | NO | NO | NO | *(ninguna)* | |
| **AMBIENT** | `deep_breath` | 0.40 | NO | NO | NO | *(ninguna)* | |

### LATINO ARSENAL (14 efectos .lfx)

| EnergyZone | Efecto | Aggression | Strobe | Divine | Heavy | Zonas en Tracks | Notas |
|------------|--------|------------|--------|--------|-------|-----------------|-------|
| **PEAK** | `divine_obliteration` | 1.00 | YES | YES | YES | `all-movers`, `all-pars` | |
| | `oro_solido` | 0.98 | NO | NO | YES | *(ninguna)* | Dictador global |
| | `latina_meltdown` | 0.95 | YES | YES | NO | *(ninguna)* | Dictador global |
| | `solar_flare` | 0.90 | NO | YES | YES | *(ninguna)* | Dictador global |
| | `salsa_fire` | 0.85 | YES | NO | YES | *(ninguna)* | Dictador global |
| **INTENSE** | `arena_sweep` | 0.75 | NO | NO | NO | *(ninguna)* | |
| | `kitt_scanner` | 0.70 | NO | NO | NO | `all-movers`, `all-pars`, `back`, `front`, `movers-left`, `movers-right` | |
| **ACTIVE** | `machete_spark` | 0.85 | NO | NO | NO | *(ninguna)* | |
| **GENTLE** | `cumbia_moon` | 0.65 | NO | NO | NO | *(ninguna)* | |
| | `tidal_wave` | 0.55 | NO | NO | NO | `air`, `all-movers`, `all-pars`, `ambient`, `back`, `floor`, `front`, `movers-left`, `movers-right` | **UNICO con `ambient` + `air`** |
| **AMBIENT** | `corazon_latino` | 0.38 | NO | NO | NO | `all-movers`, `ambient`, `back`, `floor`, `front` | **UNICO con `ambient`** |
| | `tropical_pulse` | 0.48 | NO | NO | NO | *(ninguna)* | |
| **VALLEY** | `amazon_mist` | 0.12 | NO | NO | NO | *(ninguna)* | |
| | `ghost_breath` | 0.10 | NO | NO | NO | *(ninguna)* | |

---

## TAREA 2: AUDITORIA DE NODOS FALTANTES (El Problema del Tungsten)

### FINDING CRITICO #1: `flash` NO EXISTE en ningun .lfx

Busqueda exhaustiva en los 37 efectos .lfx:
- **0 tracks** apuntan a zona `flash`
- **0 efectos** tienen `aetherNodeId: "impact-20"` o referencia al Tungsten

### FINDING CRITICO #2: `ambient` y `air` estan HUERFANAS

Solo **3 efectos** usan `ambient` en tracks:
- `acid_sweep` (techno) — `ambient` + muchas otras
- `corazon_latino` (latin) — `ambient` + `front`, `back`, `floor`, `all-movers`
- `tidal_wave` (latin) — `ambient` + `air` + casi todas

Solo **2 efectos** usan `air`:
- `acid_sweep` (techno)
- `tidal_wave` (latin)

### FINDING CRITICO #3: El Tungsten esta en `zone: 'unassigned'`

Cuando un fixture se añade al stage sin zona explicita, ShowFileV2 le asigna `zone: 'unassigned'`.

**El `IntentComposer` (WAVE 2662) funciona asi:**
```
for (const zoneId in zoneOverrides) {
  for (const fixture of fixtures) {
    if (!fixtureMatchesZone(fixture.zone, zoneId)) continue  // <-- BREAK
  }
}
```

- Efecto emite `zoneOverrides: { 'front': {...}, 'back': {...} }`
- `IntentComposer` itera por las CLAVES del override (`front`, `back`)
- Tungsten tiene `fixture.zone = 'unassigned'`
- `fixtureMatchesZone('unassigned', 'front')` → `false`
- **Tungsten nunca recibe el efecto**

**El array `zones: ['all']` del efecto NO se usa cuando hay `zoneOverrides`.**
Solo entra por `_composeGlobalFallback` cuando NO hay zoneOverrides.

### CONCLUSION: El Tungsten es un fantasma para el arsenal

1. **Strobe/flash**: Ningun .lfx apunta a `flash`. Los strobes (IndustrialStrobe, StrobeStorm, etc.) son dictadores globales sin tracks o apuntan a `all-pars`/`all-movers`.
2. **Wash/ambient**: Solo 3 efectos tocan `ambient`. La mayoria ignora la zona.
3. **Air/beam**: Solo 2 efectos tocan `air`.
4. **Causa raiz**: El Tungsten tiene `zone: 'unassigned'` y los efectos con `zoneOverrides` nunca lo alcanzan.

---

## DONDE INYECTAR

### Opcion A — Inyeccion en .lfx existentes (Strobe)

Efectos que deberian incluir `flash` en sus tracks:
- `industrial_strobe` (techno) — dictador strobe
- `strobe_storm` (techno) — dictador strobe
- `strobe_burst` (techno) — strobe activo
- `static_pulse` (techno) — strobe asincrono
- `seismic_snap` (techno) — snap con strobe
- `binary_glitch` (techno) — glitch on/off
- `neon_blinder` (techno) — blinder cegador
- `latina_meltdown` (latin) — strobe brutal
- `salsa_fire` (latin) — strobe + fuego
- `divine_obliteration` (latin) — strobe divino

### Opcion B — Inyeccion en .lfx existentes (Ambient)

Efectos atmosfericos que deberian incluir `ambient`:
- `deep_breath` (techno)
- `void_mist` (techno)
- `ghost_chase` (techno)
- `amazon_mist` (latin)
- `ghost_breath` (latin)
- `cumbia_moon` (latin)
- `tropical_pulse` (latin)

### Opcion C — Inyeccion en .lfx existentes (Air)

Efectos brillantes/agudos que deberian incluir `air`:
- `neon_blinder` (techno)
- `cascade_strike` (techno)
- `red_surge` (techno)
- `cyber_scanner` (techno)
- `solar_flare` (latin)
- `oro_solido` (latin)

### Opcion D — FIX ARQUITECTONICO: Asignar `zone: 'ambient'` al Tungsten en el Stage

Si el Tungsten se coloca con `zone: 'ambient'` (o creamos una nueva `zone: 'flash'` en CANONICAL_ZONES), los efectos que ya apuntan a `ambient` lo alcanzarian automaticamente.

---

## ANEXO: FLUJO REAL DEL PAD DE BOTONES

```
Boton (UI) → EffectManager.trigger() → getCombinedOutput() 
→ IntentComposer.compose() → MasterArbiter
```

**TimelineEngine (Chronos) es una ruta paralela**, pero los efectos del pad NO pasan por el timeline.

---

## RECOMENDACIONES

1. **Fase 1 — FIX RAPIDO**: Modificar el fixture Tungsten para que su `zone` por defecto sea `'ambient'` (donde vive el wash) y `'flash'` (donde vive el strobe/golden). Esto requiere que `flash` sea canónica.
2. **Fase 2 — Inyeccion de `flash`**: Añadir track `strobeRate` + `intensity` con zona `flash` a los efectos strobe mas usados (IndustrialStrobe, StrobeStorm, NeonBlinder).
3. **Fase 3 — Inyeccion de `ambient`**: Añadir `ambient` a los efectos atmosfericos de baja energia.
4. **Fase 4 — Inyeccion de `air`**: Añadir `air` a efectos de alto brillo/agudos.

----------------------------------------------------------
-----------------------------------------------


La ruta real del pad es:

Botón → EffectManager.trigger() → getCombinedOutput() → IntentComposer.compose() → MasterArbiter

Y ahí está el quiebre. @c:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\orchestrator\intent\IntentComposer.ts:97-119



typescript
for (const zoneId in zoneOverrides) {
  for (const fixture of fixtures) {
    if (!fixtureMatchesZone(fixture.zone, zoneId, ...)) continue
    // ...dispatch
  }
}
El zones: ['all'] del efecto NO se usa cuando hay zoneOverrides.

Cuando un efecto emite zoneOverrides: { 'front': {...}, 'back': {...} }, el IntentComposer itera por las claves del override ('front', 'back') y para cada fixture pregunta fixtureMatchesZone(fixture.zone, zoneId). El fixture.zone del Tungsten es 'unassigned' por defecto. Ninguna clave de zoneOverrides coincide.

El único caso donde 'all' funciona es el _composeGlobalFallback (sin zoneOverrides). Ahí sí se itera por effectOutput.zones y fixtureMatchesZone('unassigned', 'all') devuelve true.

Pero todos los efectos del arsenal usan zoneOverrides, así que nunca entran por el fallback global.

Conclusión: El Tungsten (zone: 'unassigned') está fuera del sistema de efectos porque:

Los efectos emiten zoneOverrides con claves como 'front', 'back', 'all-movers'
IntentComposer ignora el array zones: ['all'] del efecto cuando hay overrides
Ningún override apunta a 'unassigned', 'ambient', 'air' o 'flash'