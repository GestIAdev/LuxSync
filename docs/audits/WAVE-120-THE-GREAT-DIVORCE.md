# WAVE 120: THE GREAT DIVORCE
## Desacoplamiento Inteligente de Zonas por Densidad de Género

**Fecha**: 2025-01-XX  
**Arquitecto**: GeminiPunk  
**Implementador**: PunkOpus  
**Estado**: ✅ COMPLETADO

---

## 🎯 PROBLEMA

En géneros **4x4 densos** (Techno, Latino, Pop), la música **nunca para**:
- No hay silencios reales
- El bajo y los mids están siempre presentes
- El Dynamic Masking (creado para Dubstep) **mata** a los movers

El enmascaramiento `bassMasking = rawBass * 0.25` funcionaba en Dubstep:
```
DROP → rawBass alto → masking alto → movers bajan
BUILD → rawBass bajo → masking bajo → movers suben
```

Pero en Techno:
```
Techno → rawBass SIEMPRE alto → masking SIEMPRE alto → movers SIEMPRE bajos
```

---

## 💡 SOLUCIÓN: Selector de Estrategia por Género

### 1. **isHighDensityGenre** (Líneas ~1145 y ~1275)
```typescript
const isHighDensityGenre = preset.name.includes('Techno') || 
                           preset.name.includes('Latino') || 
                           preset.name.includes('Pop');
```

Si es género denso:
- `bassMasking = 0` → NO se aplica enmascaramiento
- Los movers responden directamente a la melodía
- Permite **superposición** de pars + movers

---

### 2. **Vocal Lift** (Líneas ~1150 y ~1280)
```typescript
const melodyFloor = avgNormEnergy * 0.6 || 0.3;
let boostedMelody = melodySignal;
if (melodySignal > melodyFloor * 1.1) {
  boostedMelody = melodySignal * 1.2; // +20% boost
}
```

- Calcula un **piso dinámico** basado en la energía promedio
- Si la melodía supera el piso en 10%, aplica boost de 20%
- Asegura que las vocales/melodías destaquen

---

### 3. **Minimum Beam Integrity** (Líneas ~1210 y ~1330)
```typescript
if (targetMover < 0.20) {
  targetMover = 0; // Negro absoluto
} else {
  targetMover = Math.max(0.25, targetMover); // Beam visible
}
```

- Si el mover está por debajo del 20%, apágalo completamente
- Si está encendido, asegura que esté al menos al 25%
- Evita beams "fantasma" que apenas se ven

---

### 4. **Bass Dominance Gate Condicional** (Líneas ~1195 y ~1315)
```typescript
// ANTES (aplicaba siempre en techno-club):
if (currentVibePreset === 'techno-club' && rawMid < rawBass * 0.5) {
  targetMover = 0;
}

// DESPUÉS (solo para géneros con silencios):
if (!isHighDensityGenre && rawMid < rawBass * 0.5) {
  targetMover = 0;
}
```

---

## 📊 MATRIZ DE COMPORTAMIENTO

| Género | bassMasking | Vocal Lift | Bass Gate | Resultado |
|--------|-------------|------------|-----------|-----------|
| Techno-Club | 0 | ✅ | ❌ | Movers responden a melodía pura |
| Fiesta-Latina | 0 | ✅ | ❌ | Movers responden a melodía pura |
| Pop-Rock | 0 | ✅ | ❌ | Movers responden a melodía pura |
| Chill-Lounge | Activo | ✅ | ✅ | Movers apagados en silencios |
| Dubstep* | Activo | ✅ | ✅ | Movers siguen drops |

*Dubstep no tiene preset propio, usa chill-lounge o techno-club según configuración.

---

## 🔗 DEPENDENCIAS

Esta wave trabaja **sobre** las implementaciones anteriores:

- **WAVE 118**: Zero Tolerance Clipper (softKneeClipper en movers)
- **WAVE 119**: Vanta Black (AGC Trap + Histéresis + Hard Floor)
- **WAVE 117**: melodyThreshold 0.30 para techno-club

---

## 📁 ARCHIVOS MODIFICADOS

- `electron/main.ts`:
  - Líneas ~490: melodyThreshold ya estaba en 0.30 (WAVE 117)
  - Líneas ~1145-1155: isHighDensityGenre + Vocal Lift para MOVING_LEFT
  - Líneas ~1195: Bass Gate condicional para MOVING_LEFT
  - Líneas ~1210: Minimum Beam Integrity para MOVING_LEFT
  - Líneas ~1275-1288: isHighDensityGenreR + Vocal Lift para MOVING_RIGHT
  - Líneas ~1315: Bass Gate condicional para MOVING_RIGHT
  - Líneas ~1330: Minimum Beam Integrity para MOVING_RIGHT

---

## 🎛️ PRÓXIMOS PASOS

1. **Testing**: Probar con tracks de Techno, Latino y Pop
2. **Validación**: Verificar que los movers se desacoplan de los pars
3. **Fine-tuning**: Ajustar melodyFloor si las vocales no destacan lo suficiente

---

## 🏛️ FILOSOFÍA

> "El Techno es superposición, no alternancia. Los pars y movers deben bailar JUNTOS, no turnarse."

> "El Dubstep es drama. Los drops necesitan contraste. El masking crea ese espacio."

---

*Documentación generada por PunkOpus como parte del flujo WAVE 120*
