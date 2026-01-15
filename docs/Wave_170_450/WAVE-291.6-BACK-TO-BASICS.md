# WAVE 291.6: BACK TO BASICS - Física Normal

## 📋 RESUMEN EJECUTIVO

**Fecha:** 5 de Enero 2026  
**Operación:** Back to Basics - Eliminar experimentos fallidos  
**Archivo Modificado:** `electron-app/src/hal/physics/LatinoStereoPhysics.ts`  
**Estado:** ✅ COMPLETADO

---

## 🔴 PROBLEMAS REPORTADOS (Log de Cumbia)

### 1. MOVERS - "Ridículos, retrasados"
```
IN[0.63, 0.42, 0.19] -> Mover:0.35  // Mid=0.42, apenas pasa gate 0.40
IN[0.66, 0.45, 0.14] -> Mover:0.43  // Subida lentísima
```
**Causa**: Gate 0.40 demasiado alto + Attack 0.25 muy lento.
La cumbia tiene mids en 0.40-0.50, justo en el borde del gate.

### 2. BACK PARs - "Lógica binaria de mierda"
```
IN[0.58, 0.38, 0.17] -> Back:0.95  // ON
IN[0.60, 0.40, 0.17] -> Back:0.00  // OFF inmediato
```
**Causa**: Transient detection binario (bassDelta > 0.08 → 100%, else → 0%).
Además: ¿Qué pinta el BASS en back pars? Debería ser MID.

### 3. FRONT PARs - "Perrito asustado al 40%"
```
IN[0.55, 0.34, 0.15] -> Front:0.50
IN[0.00, 0.00, 0.00] -> Front:0.28  // Siempre ~0.30 por BASE fijo
```
**Causa**: `BASE 0.30 + bass*0.40` = rango 0.30-0.70 (estrecho, siempre encendido).

---

## 🛠️ SOLUCIÓN: FÍSICA NORMAL

### Filosofía WAVE 291.6
> *"Demasiados experimentos. Volvamos a lo que funciona."*

| Componente | Señal | Rol |
|------------|-------|-----|
| **Front PARs** | BASS | Iluminación facial, sigue el bajo |
| **Back PARs** | MID (gateado) | Ritmo (timbales, congas), NO voces |
| **Movers** | MID | Melodía/voces principales |

### Cambios de Constantes

```typescript
// ── MOVERS ──
MOVER_ATTACK = 0.35;        // 🔧 Era 0.25 → Más agresivo
MOVER_DECAY_FACTOR = 0.90;  // 🔧 Era 0.85 → Decay medio
MOVER_GATE = 0.25;          // 🔧 Era 0.40 → Gate BAJO

// ── BACK PARs ──
BACK_PAR_GATE = 0.50;       // 🆕 Gate alto para filtrar voces
BACK_PAR_ATTACK = 0.40;     // 🆕 Ataque rápido
BACK_PAR_DECAY = 0.12;      // 🔧 Era 0.20 → Decay suave

// ── FRONT PARs ──
FRONT_PAR_BASS_POWER = 1.3; // 🆕 Exponente para contraste
FRONT_PAR_SMOOTH = 0.15;    // 🆕 LERP ligero anti-temblor
```

### Cambios de Lógica

#### BACK PARs: MID con Gate Anti-Voz
```typescript
// ANTES: Binario basado en bassDelta
if (bassDelta > 0.08) intensity = 1.0; else intensity = 0;

// AHORA: MID proporcional con gate alto
if (mid > 0.50) {
  const normalized = (mid - 0.50) / 0.50;  // 0-1 proporcional
  current += (normalized - current) * 0.40; // Ataque
} else {
  current -= 0.12;  // Decay suave
}
```

#### MOVERS: Gate Bajo, Ataque Agresivo
```typescript
// ANTES: Gate 0.40 → cumbia apenas entraba
// AHORA: Gate 0.25 + Attack 0.35 → respuesta inmediata
if (mid > 0.25) {
  current += (mid - current) * 0.35;
} else {
  current *= 0.90;
}
```

#### FRONT PARs: BASS Directo, Rango Completo
```typescript
// ANTES: BASE + bass*MULT = rango estrecho (0.30-0.70)
intensity = 0.30 + bass * 0.40;

// AHORA: bass^1.3 = rango completo (0-1)
target = Math.pow(bass, 1.3);
current += (target - current) * 0.15;
```

---

## 📊 COMPORTAMIENTO ESPERADO

| Componente | WAVE 291.5 | WAVE 291.6 |
|------------|------------|------------|
| **Movers** | Retrasados (gate 0.40) | Respuesta inmediata (gate 0.25) |
| **Back PARs** | Binario 0/100% (horrible) | Proporcional, sigue el ritmo |
| **Front PARs** | Clavados en ~40% | Rango 0-100%, contraste real |

---

## 🎯 RESUMEN DE LA CORRECCIÓN

| Problema | Experimento Fallido | Solución |
|----------|---------------------|----------|
| Movers retrasados | Gate 0.40 (muy alto) | Gate 0.25, Attack 0.35 |
| Back PARs binarios | Transient detection | MID proporcional con gate 0.50 |
| Front PARs fijos | BASE 0.30 + rango estrecho | bass^1.3, rango completo |
| Back en BASS | "Evitar karaoke" | Volver a MID (con gate anti-voz) |

---

## 💡 LECCIÓN APRENDIDA

> *"El problema no era la señal (MID para back pars es correcto).*  
> *El problema era la lógica (binaria en vez de proporcional).*  
> *A veces la solución simple es la correcta."*

---

*WAVE 291.6 - Cuando los experimentos fallan, vuelve a lo básico.* 🎯
