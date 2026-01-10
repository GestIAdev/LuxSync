# WAVE 342: DUAL REALITY - 2D vs 3D 🎭

**Fecha:** 2026-01-09
**Tipo:** Arquitectura de Visualización
**Status:** ✅ IMPLEMENTADO

---

## 🎭 EL PROBLEMA ORIGINAL (341.9)

Intentamos unificar 2D y 3D usando `physicalPan` para ambos.

**Resultado:** ¡TODO ROTO!
- Latino: Pausas y comportamiento errático (physics driver muy conservador)
- Techno: 2D funciona, 3D congelado

### Análisis de Logs

```
Target:-216°/108° → Phys:-11°/11°   // ¡206° de diferencia!
Target:-217°/-9°  → Phys:-11°/-10°  // El physics no puede seguir
Target:217°/106°  → Phys:34°/77°    // Muy lejos del target
```

**Causa raíz:** El physics driver con SNAP MODE + REV LIMITER era demasiado conservador para seguir trayectorias de alta amplitud como figure8 (±216°).

---

## 🏛️ NUEVO PARADIGMA: DUAL REALITY

### El Principio

| Canvas | Muestra | Fuente |
|--------|---------|--------|
| **3D** | A DÓNDE QUIERE IR | `pan`/`tilt` (target) |
| **2D** | QUÉ ESTÁ HACIENDO | `physicalPan`/`physicalTilt` |

### ¿Por qué?

- **3D es ARTÍSTICO**: Muestra la intención del engine, los patrones puros (figure8, circle, sweep)
- **2D es TÉCNICO**: Muestra lo que el hardware real está haciendo, con todas las limitaciones físicas

---

## 🔧 CAMBIOS IMPLEMENTADOS

### 1. Stage3DCanvas.tsx - Vuelve a usar targets

```tsx
// Antes (341.9 - roto):
const { physicalPan, physicalTilt } = useFixtureRender(...)

// Después (342):
const { pan, tilt } = useFixtureRender(...)
```

### 2. Fixture3D.tsx - LERP más rápido

```tsx
// Antes: LERP 0.15 (muy lento, no seguía targets rápidos)
// Después: LERP 0.3 (sigue bien sin perder suavidad)
yokeRef.current.rotation.y = THREE.MathUtils.lerp(
  yokeRef.current.rotation.y,
  panAngle,
  0.3  // Era 0.15
)
```

### 3. FixturePhysicsDriver.ts - REV LIMITER más generoso para Latino

```typescript
// Antes:
REV_LIMIT_PAN = 10   // Latino no podía seguir figure8
REV_LIMIT_TILT = 7

// Después:
REV_LIMIT_PAN = 25   // ~1050°/s - Sigue trayectorias curvas
REV_LIMIT_TILT = 18  // ~750°/s
```

### 4. snapFactor dinámico

```typescript
// Antes: snapFactor = 0.25 + (1 - friction) * 0.5  (≈0.5 para Latino)
// Después: snapFactor = 0.4 + (maxAccel - 1000) / 800  (≈0.65 para Latino)
```

---

## 📊 RESULTADOS ESPERADOS

### 3D Canvas (TARGET)
| Vibe | Patrón | Comportamiento |
|------|--------|----------------|
| Latino | figure8 | Curvas suaves, amplitud completa ±216° |
| Techno | mirror | Oscilación visible, 1 ciclo/4 beats |
| Chill | circle | Rotación lenta, zen |
| Rock | sweep | Barridos dramáticos |

### 2D Canvas (PHYSICS)
| Vibe | Comportamiento |
|------|----------------|
| Latino | Sigue figure8 con ~200ms de delay |
| Techno | Instantáneo (INSTANT MODE) |
| Chill | Muy suave, física clásica |
| Rock | SNAP con 12 DMX/frame REV LIMIT |

---

## � MÉTRICAS TÉCNICAS

### REV LIMITER por Vibe

| Vibe | PAN DMX/frame | TILT DMX/frame | °/segundo |
|------|---------------|----------------|-----------|
| Techno | 6 | 4 | ~250° |
| **Latino** | **25** | **18** | **~1050°** |
| Rock | 12 | 8 | ~500° |
| Chill | 255 | 255 | Sin límite |

### snapFactor por maxAccel

| maxAccel | snapFactor | Uso |
|----------|------------|-----|
| 1050 (Rock) | 0.46 | Dramático |
| 1200 (Latino) | 0.65 | Fluido |
| 1400+ (Techno) | INSTANT | Brutal |

---

## 📁 ARCHIVOS MODIFICADOS

1. **Stage3DCanvas.tsx** - Usa pan/tilt (targets)
2. **Fixture3D.tsx** - LERP 0.3 (más rápido)
3. **FixturePhysicsDriver.ts** - REV LIMITS y snapFactor aumentados
4. **TitanEngine.ts** - Mirror 1 ciclo/4 beats (de WAVE 341.9)

---

*"El 3D muestra sueños. El 2D muestra realidad. Ambos son necesarios."* - PunkOpus
