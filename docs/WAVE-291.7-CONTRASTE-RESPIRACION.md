# WAVE 291.7: CONTRASTE Y RESPIRACIÓN - "Pom Pom Pom"

## 📋 RESUMEN

**Fecha:** 5 de Enero 2026  
**Archivo:** `electron-app/src/hal/physics/LatinoStereoPhysics.ts`  
**Estado:** ✅ COMPLETADO

---

## 🔴 PROBLEMAS REPORTADOS

| Componente | Síntoma | Causa |
|------------|---------|-------|
| **Movers** | Siempre encendidos, parpadean sin contraste | Gate 0.25 (muy bajo), Decay 0.90 (muy lento) |
| **Back PARs** | Apagados todo el tiempo | Gate 0.50 (muy alto para cumbia) |
| **Front PARs** | Decay lento, no respiran | LERP simétrico 0.15 |

---

## 🛠️ CAMBIOS WAVE 291.7

### MOVERS - Necesitan CONTRASTE
```typescript
MOVER_ATTACK = 0.50;        // 🔧 Era 0.35 → Más rápido
MOVER_DECAY_FACTOR = 0.80;  // 🔧 Era 0.90 → Decay RÁPIDO
MOVER_GATE = 0.35;          // 🔧 Era 0.25 → Gate MEDIO
```

### BACK PARs - Que entren
```typescript
BACK_PAR_GATE = 0.40;       // 🔧 Era 0.50 → Más permisivo
BACK_PAR_ATTACK = 0.50;     // 🔧 Era 0.40 → Más rápido
BACK_PAR_DECAY = 0.18;      // 🔧 Era 0.12 → Más rápido
```

### FRONT PARs - El corazón "Pom Pom Pom"
```typescript
FRONT_PAR_BASS_POWER = 1.2; // 🔧 Era 1.3 → Menos exponente
FRONT_PAR_ATTACK = 0.40;    // 🆕 Ataque rápido
FRONT_PAR_DECAY = 0.25;     // 🆕 Decay RÁPIDO (antes LERP simétrico)
```

**Nueva lógica asimétrica:**
```typescript
if (target > current) {
  current += (target - current) * 0.40;  // SUBIDA rápida
} else {
  current += (target - current) * 0.25;  // BAJADA rápida también
}
```

---

## 📊 COMPORTAMIENTO ESPERADO

| Componente | WAVE 291.6 | WAVE 291.7 |
|------------|------------|------------|
| **Movers** | Siempre encendidos ~0.40 | Respiran con contraste |
| **Back PARs** | Apagados (gate 0.50) | Entran con mid > 0.40 |
| **Front PARs** | Decay lento, parpadeo raro | "Pom pom pom" como corazón |

---

## 🎯 FILOSOFÍA

> *"El bajo es el CORAZÓN de la fiesta.*  
> *Sube RÁPIDO con el golpe, baja RÁPIDO para el siguiente.*  
> *Pom pom pom."*

---

*WAVE 291.7 - Pasito a pasito, suave suavecito...* 🎵
