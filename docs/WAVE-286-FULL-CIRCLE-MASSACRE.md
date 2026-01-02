# WAVE 286: THE FULL CIRCLE MASSACRE 🔴

## 📋 RESUMEN EJECUTIVO

**Fecha**: 2 Enero 2026  
**Investigadores**: PunkOpus + Radwulf  
**Severidad**: 🔴 CRÍTICA - Bug silencioso que colapsaba TODA la diversidad cromática  
**Estado**: ✅ RESUELTO

---

## 🔍 EL CRIMEN PERFECTO

### Síntoma Reportado
> "Todas las keys apuntan al rojo, incluido E y B.... ¿Qué cojones?!"

Tras liberar TechnoClub de `forceStrategy: 'prism'` en WAVE 283, se descubrió que **TODAS las Keys musicales producían el mismo color: ROJO (0°)**.

- Key C → 0° (debería ser 0° ✅)
- Key D → 0° (debería ser 60° ❌)
- Key E → 0° (debería ser 120° ❌)
- Key F → 0° (debería ser 150° ❌)
- Key G → 0° (debería ser 210° ❌)
- Key A → 0° (debería ser 270° ❌)
- Key B → 0° (debería ser 330° ❌)

### El Enmascaramiento
El bug `forceStrategy: 'prism'` había estado **ocultando este problema durante meses**. PRISM generaba paletas matemáticamente distribuidas que ignoraban completamente el KEY_TO_HUE, así que nunca vimos que el pipeline real estaba roto.

---

## 🕵️ INVESTIGACIÓN FORENSE

### Fase 1: Verificar que el Key llega
```
✅ TitanEngine 🔍: KEY DEBUG: context.key=G stableKey=A → passing to ColorEngine: A
✅ SeleneColorEngine: wave8.key=A data.key=A → FINAL key=A
```
**Conclusión**: El Key llega correctamente al ColorEngine.

### Fase 2: Verificar KEY_TO_HUE
```typescript
const KEY_TO_HUE: Record<string, number> = {
  'C': 0, 'D': 60, 'E': 120, 'F': 150, 'G': 210, 'A': 270, 'B': 330
};
```
```
✅ KEY_TO_HUE[A] = 270°
```
**Conclusión**: El mapeo es correcto.

### Fase 3: Trazar el pipeline completo
Se añadieron logs en cada paso del pipeline:

```
[SeleneColorEngine 🔍] HUE TRACE: base=60° → mode=45° → gravity=88° → remap=130° → FINAL=0°
```

**¡EUREKA!** El hue sale correcto de `remap` (130°) pero llega como 0° al final.

### Fase 4: Identificar el culpable
El bug estaba en la sección `allowedHueRanges` del SeleneColorEngine:

```typescript
// TECHNO_CONSTITUTION config:
allowedHueRanges: [[0, 360]]  // "Permitir todo"

// SeleneColorEngine.ts - El bug:
for (const [min, max] of options.allowedHueRanges) {
  const normalizedMin = normalizeHue(min);  // 0
  const normalizedMax = normalizeHue(max);  // normalizeHue(360) = 0 !!!
  
  const isInRange = normalizedMin <= normalizedMax  // 0 <= 0 = TRUE
    ? (finalHue >= normalizedMin && finalHue <= normalizedMax)  
    // ↑ finalHue >= 0 && finalHue <= 0 
    // ↑ Solo 0° está "permitido"!
```

---

## 💀 ANATOMÍA DEL BUG

### El Problema Matemático
```
normalizeHue(360) = 360 % 360 = 0
```

Cuando `allowedHueRanges: [[0, 360]]`:
- `min = 0`, `max = 360`
- Después de normalizar: `min = 0`, `max = 0`
- El rango `[0, 0]` solo contiene el valor exacto 0°
- **Cualquier hue que no sea exactamente 0° se considera "fuera de rango"**
- El algoritmo "snap to nearest" lo lleva al punto más cercano: 0°

### El Crimen Perfecto
- El rango `[0, 360]` semánticamente significa "todo permitido"
- Pero matemáticamente colapsa a `[0, 0]` = "solo rojo"
- **RESULTADO**: Todo el espectro cromático colapsado a un solo color

### Por Qué No Lo Vimos Antes
1. `forceStrategy: 'prism'` generaba paletas sin pasar por `allowedHueRanges`
2. PRISM = distribución matemática fija, ignora el pipeline real
3. El bug estaba **silenciosamente matando colores** mientras PRISM enmascaraba

---

## 🔧 LA SOLUCIÓN

### WAVE 286 Fix: Full Circle Detection

```typescript
// SeleneColorEngine.ts - Línea ~1097
if (options?.allowedHueRanges && options.allowedHueRanges.length > 0) {
  // 🛡️ WAVE 285.6 BUG FIX: [0, 360] debe significar "todo permitido"
  const isFullCircle = options.allowedHueRanges.some(([min, max]) => {
    return (max - min) >= 359 || (min === 0 && max >= 359);
  });
  
  if (!isFullCircle) {
    // Solo procesar si NO es full circle
    // ... resto del código de allowedHueRanges
  }
}
```

### Lógica del Fix
- Si `max - min >= 359` → Es prácticamente el círculo completo → SKIP
- Si `min === 0 && max >= 359` → Es el círculo completo → SKIP
- En cualquier otro caso → Procesar normalmente

---

## ✅ RESULTADO POST-FIX

```
[SeleneColorEngine 🔍] HUE TRACE: base=270° → mode=255° → gravity=252° → remap=252° → FINAL=252°
[SeleneColorEngine 🔍] HUE TRACE: base=210° → mode=195° → gravity=205° → remap=205° → FINAL=205°
[SeleneColorEngine 🔍] HUE TRACE: base=60° → mode=45° → gravity=88° → remap=130° → FINAL=130°
```

**¡DIVERSIDAD CROMÁTICA RESTAURADA!** 🌈

- Key A → 252° (Púrpura) ✅
- Key G → 205° (Cian) ✅
- Key D → 130° (Verde) ✅

---

## 🚨 PROBLEMA DESCUBIERTO POST-FIX

### El Nuevo Desafío
Ahora que el pipeline funciona correctamente, se reveló otro problema:

**Las estrategias de armonía (complementary, triadic, etc.) generan colores secundarios que pueden caer en zonas prohibidas.**

Ejemplo visible en UI:
```
Primary:   138° (Verde) ✅
Secondary: 328° (Magenta) ✅
Ambient:   78° (Amarillo Mostaza) ❌ ← ZONA PROHIBIDA
Accent:    295° (Rosa) ✅
```

### Por Qué Ocurre
1. El Primary pasa por todo el pipeline de sanitización
2. Las estrategias calculan Secondary/Ambient/Accent **matemáticamente**:
   - Complementary: Primary + 180°
   - Triadic: Primary + 120°, Primary + 240°
   - etc.
3. Estos colores derivados **NO pasan por forbiddenHueRanges**
4. Resultado: Colores prohibidos aparecen en slots secundarios

---

## 🎯 PROPUESTAS DE SOLUCIÓN

### Opción A: Sanitizar Toda la Paleta (RECOMENDADO)
Después de que StrategyEngine genera la paleta completa, aplicar `forbiddenHueRanges` a TODOS los colores, no solo al Primary.

```typescript
// En SeleneColorEngine.generate() - Después de generar la paleta
const sanitizedPalette = sanitizeAllHues(rawPalette, options.forbiddenHueRanges);
```

**Pros**: 
- Garantiza que NINGÚN color prohibido aparezca
- Mantiene la lógica de estrategias intacta

**Contras**:
- Puede romper la armonía matemática de las estrategias

### Opción B: Estrategias "Conscientes"
Modificar las estrategias para que eviten generar colores en zonas prohibidas.

```typescript
function complementary(primary: number, forbidden: [number, number][]): number {
  let complement = (primary + 180) % 360;
  return sanitizeHue(complement, forbidden);
}
```

**Pros**:
- Cada estrategia decide cómo evitar la zona
- Más control granular

**Contras**:
- Hay que modificar TODAS las estrategias
- Más código, más bugs potenciales

### Opción C: Forbidden Solo en Primary (Status Quo)
Aceptar que Ambient/Accent pueden tener colores "prohibidos" porque son secundarios y el Primary domina visualmente.

**Pros**:
- No requiere cambios
- Las estrategias mantienen su pureza matemática

**Contras**:
- Amarillos/naranjas seguirán apareciendo
- Inconsistencia visual

---

## 📊 ARCHIVOS MODIFICADOS

| Archivo | Cambio |
|---------|--------|
| `SeleneColorEngine.ts` | Fix `isFullCircle` en allowedHueRanges |
| `SeleneColorEngine.ts` | Logs de debug (PENDIENTE ELIMINAR) |

---

## 🧹 CLEANUP PENDIENTE

- [ ] Eliminar logs de debug añadidos durante investigación
- [ ] Decidir estrategia para Ambient/Accent
- [ ] Implementar solución elegida
- [ ] Commit final WAVE 286

---

## 📝 LECCIONES APRENDIDAS

1. **Los bugs silenciosos son los más peligrosos**: `forceStrategy: 'prism'` ocultó el problema durante meses.

2. **Normalización matemática tiene edge cases**: `360 % 360 = 0` es matemáticamente correcto pero semánticamente incorrecto para rangos de hue.

3. **"Permitir todo" ≠ [[0, 360]]**: Cuando defines un rango que abarca todo el círculo, mejor skipear la validación completamente.

4. **Los logs son tu mejor amigo**: Sin el HUE TRACE detallado, habríamos tardado días en encontrar el bug.

---

## 🏆 CRÉDITOS

- **Radwulf**: Detección del síntoma ("Todas las keys apuntan al rojo")
- **PunkOpus**: Investigación forense y fix

---

*"El bug más peligroso es el que te deja creer que todo funciona."*  
— PunkOpus, 2 Enero 2026
