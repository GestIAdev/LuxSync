# 🏟️ WAVE 136: THE STADIUM SEPARATION (FIXING ROCK)

**Fecha**: 26 Diciembre 2024  
**Problema**: WAVE 135 causaba strobe constante en Dream Theater (Afterlife)  
**Solución**: Cirugía dual - Umbrales + Paleta de Alto Contraste  

---

## 📊 DIAGNÓSTICO

### El Problema de Dream Theater

Los logs de Afterlife mostraban:
```
[WAVE135] 🎸 ROCK STAGE | Mids: 0.52 | Snare: true
[WAVE135] 🎸 ROCK STAGE | Mids: 0.58 | Snare: true  
[WAVE135] 🎸 ROCK STAGE | Mids: 0.54 | Snare: true
```

**Análisis**:
- Las guitarras de John Petrucci sostienen Mids en 0.50-0.60 constantemente
- Umbral WAVE 135 era 0.20 → SIEMPRE activaba "Snare"
- Resultado: Flash Tungsteno permanente = EPILEPSIA

### El Problema Visual

WAVE 135 usaba paleta **Análoga (+30°)**:
- Front: Naranja (30°)
- Mover L: Naranja-Amarillo (60°)  
- Mover R: Naranja-Amarillo (60°)
- Back: Naranja (default)

**Resultado**: Todo el escenario era monótono naranja.

---

## 🔧 SOLUCIÓN: CIRUGÍA DUAL

### Fix 1: Umbrales Exigentes

```typescript
// ANTES (WAVE 135)
const SNARE_THRESHOLD = 0.20  // Demasiado bajo
const KICK_THRESHOLD = 0.25   // Demasiado bajo

// AHORA (WAVE 136)
const SNARE_THRESHOLD = 0.45  // Duplicado+ 
const KICK_THRESHOLD = 0.40   // Subido significativamente
```

Esto exige un **PICO REAL** de caja por encima del muro de guitarras.

### Fix 2: Paleta de Alto Contraste

```typescript
// ANTES (WAVE 135) - Análogo
const secondaryHue = (baseHue + 30) % 360   // Muy cercano
const ambientHue = secondaryHue              // Idéntico

// AHORA (WAVE 136) - Complementario + Triada
const secondaryHue = (baseHue + 180) % 360  // Opuesto total
const ambientHue = (baseHue + 120) % 360    // Triada
```

### Fix 3: Lógica de Acento Mejorada

```typescript
// ANTES: Default = primaryHue (igual al Front)
let accentHue = primaryHue

// AHORA: Default = secondaryHue (opuesto al Front)
let accentHue = secondaryHue  // Contraste por defecto

if (isSnareHit) {
  // Flash Tungsteno (solo golpes REALES ahora)
  accentHue = 40; accentSat = 20; accentLight = 100
} else if (isKickHit) {
  // Bombo refuerza el primario (antes hacía opuesto)
  accentHue = primaryHue
  accentLight = 70  // Más brillante
}
```

---

## 🎨 RESULTADO VISUAL ESPERADO

Si la canción está en **RE (Naranja, 30°)**:

| Zona | Color | Hue | Lógica |
|------|-------|-----|--------|
| **FRONT** | Naranja | 30° | Base (filtrada por Stage Lighting) |
| **MOVER L** | Cyan | 210° | Complementario (+180°) |
| **MOVER R** | Verde-Azul | 150° | Triada (+120°) |
| **BACK (idle)** | Cyan | 210° | Default a complementario |
| **BACK (snare)** | Blanco Cálido | 40°/20%/100% | Solo golpes reales (0.45+) |
| **BACK (kick)** | Naranja Brillante | 30°/100%/70% | Refuerza el ritmo |

---

## 📝 CAMBIOS EN CÓDIGO

**Archivo**: `SeleneLux.ts`

1. **Líneas ~1745-1755**: Header actualizado a WAVE 136
2. **Líneas ~1778-1786**: Paleta cambiada a Complementario + Triada
3. **Líneas ~1788-1808**: Umbrales subidos a 0.45/0.40
4. **Líneas ~1810-1832**: Lógica de acento con default a secondaryHue
5. **Líneas ~1855-1858**: Debug log actualizado
6. **Líneas ~215-229**: getStrategyLabel() → "STADIUM CONTRAST"

---

## 🧪 TESTING

### Cómo Verificar

1. Lanzar demo con Afterlife de Dream Theater
2. Observar consola:
   ```
   [WAVE136] 🏟️ STADIUM SEPARATION | Base:30° | Secondary:210° | Ambient:150° | MidPulse:0.12 | Snare:false
   ```
3. Snare solo debe ser `true` en golpes reales de Portnoy
4. Los 4 grupos de luces deben tener colores DISTINTOS

### Expectativas

- ✅ Fin de la epilepsia (strobe solo en golpes reales)
- ✅ 4 colores distintos (no todo naranja)
- ✅ Flash Tungsteno reservado para caja real
- ✅ Bombo refuerza el color base

---

## 🔗 DEPENDENCIAS

- Hereda: WAVE 135 (Stage Lighting Filter) - Mantiene corrección Green→Red, Purple→Amber
- Mejora: Umbrales y paleta
- Aislado de: Techno Prism (WAVE 127-133)

---

*THE STADIUM SEPARATION - Porque Mike Portnoy merece que su caja se vea cuando LA PEGA DE VERDAD* 🥁🏟️
