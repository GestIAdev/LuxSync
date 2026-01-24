# WAVE 999: THE SILK PROTOCOL
## Sistema de Transiciones Suaves + Válvula de Presión de Energía

**Fecha**: 2025-01-XX  
**Estado**: ✅ IMPLEMENTADO  
**Arquitecto**: PunkOpus

---

## 🧟 PARTE 1: ZOMBIE STATE (Release Phase)

### El Problema
Los efectos morían instantáneamente: dimmer 100% → 0% en un frame.
Esto causaba "pops" visuales y transiciones bruscas.

### La Solución: Muerte Gradual

Cuando un efecto termina, entra en **ZOMBIE STATE**:
- **NO muere inmediatamente**
- Tiene 500ms para desvanecerse exponencialmente
- Durante el fade, pierde la carrera HTP gradualmente
- Solo se elimina cuando `releaseComplete = true`

### Duraciones de Release

| Tipo de Efecto | Duración | Razón |
|---------------|----------|-------|
| Normal | 500ms | Fade suave estándar |
| Strobes | 300ms | Más rápido para mantener punch |
| Forced Eject | 200ms | Eyección de emergencia |

### Curva de Fade

```
getReleaseMultiplier():
  0ms   → 1.0 (100%)
  125ms → 0.84 (easeInOutCubic)
  250ms → 0.5 (50%)
  375ms → 0.16
  500ms → 0.0 (ZOMBIE DEAD)
```

### Código Clave

```typescript
// BaseEffect.ts
protected isReleasing = false
protected releaseComplete = false
protected releaseStartTime = 0
protected releaseDurationMs = 500

startRelease(durationMs = 500): void {
  if (!this.isReleasing) {
    this.isReleasing = true
    this.releaseStartTime = Date.now()
    this.releaseDurationMs = durationMs
  }
}

getReleaseMultiplier(): number {
  if (!this.isReleasing) return 1.0
  if (this.releaseComplete) return 0.0
  
  const elapsed = Date.now() - this.releaseStartTime
  const progress = Math.min(1, elapsed / this.releaseDurationMs)
  
  if (progress >= 1) {
    this.releaseComplete = true
    return 0.0
  }
  
  // Curva exponencial suave (easeInOutCubic invertida)
  return 1 - (progress < 0.5 
    ? 4 * progress ** 3 
    : 1 - (-2 * progress + 2) ** 3 / 2)
}
```

---

## ⏏️ PARTE 2: VÁLVULA DE PRESIÓN (Energy Eject System)

### El Problema
Efectos ambient (digital_rain, void_mist) persisten cuando la energía sube.
No tienen lógica de "huir" cuando el contexto cambia.

### La Solución: Eyección Automática por Energía

Cada efecto tiene una **zona asignada** con un **techo de energía**:
- Si la energía actual supera el techo + 0.15 margen → **EJECT**

### Umbrales de Zona (THE LADDER)

```typescript
const ZONE_ENERGY_THRESHOLDS: Record<EffectZone, number> = {
  silence: 0.15,  // 0-15% energy
  valley: 0.30,   // 15-30%
  ambient: 0.45,  // 30-45%
  gentle: 0.60,   // 45-60%
  active: 0.75,   // 60-75%
  intense: 0.90,  // 75-90%
  peak: 1.00,     // 90-100%
}
```

### Ejemplo de Eyección

```
Estado: digital_rain activo (zona: ambient, max 0.45)
Energía: 0.62 (62%)
Cálculo: 0.62 > (0.45 + 0.15) = 0.60
Resultado: ⏏️ EJECT - digital_rain expulsado en 200ms
```

### Log de Eyección

```
⏏️ EJECT: digital_rain expelled. Energy 0.62 > zone max 0.45
```

---

## 📊 ARCHIVOS MODIFICADOS

### 1. `BaseEffect.ts`
- ➕ Propiedades: `isReleasing`, `releaseComplete`, `releaseStartTime`, `releaseDurationMs`
- ➕ Métodos: `startRelease()`, `forceFadeOut()`, `getReleaseMultiplier()`

### 2. `types.ts` (ILightEffect)
- ➕ 5 nuevos miembros de interfaz para el sistema de release

### 3. `SolarFlare.ts`
- ➕ Implementación manual de ZOMBIE STATE (no extiende BaseEffect)

### 4. `EffectManager.ts`
- ➕ `ZONE_ENERGY_THRESHOLDS` constante
- ➕ `currentEnergyLevel` propiedad
- ➕ `setCurrentEnergy()` método
- 🔄 `update()`: Lógica de ZOMBIE STATE + VÁLVULA DE PRESIÓN
- 🔄 `getCombinedOutput()`: Aplicación del `releaseMultiplier` en HTP

---

## 🔗 INTEGRACIÓN PENDIENTE

El TitanEngine debe llamar `effectManager.setCurrentEnergy(smoothedEnergy)` cada frame:

```typescript
// TitanEngine.ts (ejemplo)
update(deltaMs: number, smoothedEnergy: number): void {
  this.effectManager.setCurrentEnergy(smoothedEnergy)
  this.effectManager.update(deltaMs)
  // ...
}
```

---

## ✅ VALIDACIÓN

- [x] Todos los efectos heredan ZOMBIE STATE via BaseEffect
- [x] SolarFlare tiene implementación manual
- [x] EffectManager aplica releaseMultiplier en HTP
- [x] Strobe rate NO se atenúa (corte limpio)
- [x] Eyección usa forceFadeOut(200) para rapidez
- [x] TypeScript compila sin errores

---

## 🎯 RESULTADO ESPERADO

### Antes (WAVE 998)
```
Efecto termina → POP → Negro instantáneo
Energía sube → Ambient sigue activo → Conflicto visual
```

### Después (WAVE 999)
```
Efecto termina → ZOMBIE → Fade 500ms → Silencio suave
Energía sube → Ambient EJECT 200ms → Espacio para peak effects
```

---

**"La muerte no es el final. Es una transición."**
— THE SILK PROTOCOL
