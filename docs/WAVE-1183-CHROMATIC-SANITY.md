# 🎨 WAVE 1183: CHROMATIC SANITY - "Nadie cambia la paleta cada 10 segundos"

**Fecha**: 5 de Febrero 2026  
**Autor**: PunkOpus + Radwulf  
**Tipo**: Calibración Visual

---

## 🌈 EL PROBLEMA: "ESTROBOSCOPIA CROMÁTICA"

### Síntomas Observados
```
[KeyStabilizer] 🎵 KEY CHANGE: C → D (after 180 frames)
... 10 segundos después ...
[KeyStabilizer] 🎵 KEY CHANGE: D → F (after 180 frames)
... 10 segundos después ...
[KeyStabilizer] 🎵 KEY CHANGE: F → G (after 180 frames)
```

**Resultado**: Cambio de paleta cromática cada ~10 segundos.

### El Diagnóstico
Entre los **efectos disparando** + los **cambios de paleta constantes**, estábamos creando una **estroboscopia cromática**.

En una discoteca real, nadie cambia la paleta de color cada 10 segundos. Los cambios de paleta son:
1. **Modulación real de la canción** (cambio de tonalidad)
2. **Cambio de track**
3. **Drop épico** que justifica cambio visual

---

## 🎯 LA SOLUCIÓN: 30 SEGUNDOS MÍNIMO

### ANTES (WAVE 287: "Relaxed Stabilization"):
```typescript
bufferSize: 300,           // 5 segundos @ 60fps
lockingFrames: 180,        // 3 segundos para cambiar
dominanceThreshold: 0.40,  // 40% de votos
```

**Frecuencia de cambios**: Cada 3-10 segundos (depende de la música)

### DESPUÉS (WAVE 1183: "Chromatic Sanity"):
```typescript
bufferSize: 600,           // 10 segundos @ 60fps
lockingFrames: 1800,       // 30 segundos para cambiar
dominanceThreshold: 0.50,  // 50% de votos (más consenso)
```

**Frecuencia de cambios**: Cada 30+ segundos (solo modulaciones reales)

---

## 📊 CAMBIOS REALIZADOS

### KeyStabilizer Configuration

| Parámetro | ANTES | DESPUÉS | Razón |
|-----------|-------|---------|-------|
| bufferSize | 300 (5s) | **600 (10s)** | Buffer más largo para detectar modulaciones reales |
| lockingFrames | 180 (3s) | **1800 (30s)** | 30s mínimo entre cambios de paleta |
| dominanceThreshold | 0.40 | **0.50** | 50% consenso - evita cambios por acordes de paso |
| minConfidence | 0.35 | 0.35 | Sin cambio |

---

## 🎭 FILOSOFÍA DEL CAMBIO

### Lo que NO queremos:
```
Track en Do Mayor → sala ROJA
Acorde de Fa pasa → sala VERDE (2 segundos)
Vuelve Do Mayor → sala ROJA (8 segundos)
Acorde de Sol pasa → sala AZUL (3 segundos)
Vuelve Do Mayor → sala ROJA
```

**Esto es epilepsia cromática.**

### Lo que SÍ queremos:
```
Track en Do Mayor → sala ROJA (3 minutos)
Modulación a Re Mayor → sala NARANJA (2 minutos)
Cambio de track (Mi Mayor) → sala AMARILLA
```

**Esto es coherencia visual.**

---

## 🧮 MATEMÁTICAS DEL LOCKING

### Sistema de Votación (mantiene de WAVE 287):
1. **Buffer circular** de 600 frames (10 segundos)
2. Cada frame "vota" por su Key detectada
3. Los votos se **ponderan por energía**: `weight = energy^1.5`
4. Se calcula la **Key dominante** (más votos)

### Lógica de Cambio:
```
Para cambiar de C → D:
1. D debe ser dominante (>50% de votos) en el buffer
2. D debe mantener dominancia por 1800 frames (30 segundos)
3. Solo entonces se actualiza la paleta a D
```

### Ejemplo Real:
```
Frame 0-600: Track en Do Mayor
  → Buffer: 90% votos C, 10% otros
  → stableKey = C (ROJO)

Frame 600-1200: Pasa acorde de Fa
  → Buffer: 60% C, 35% F, 5% otros
  → stableKey = C (sigue ROJO - F no alcanza 50%)

Frame 1200-3000: Modulación real a Re Mayor
  → Buffer: 10% C, 85% D, 5% otros
  → candidateKey = D, frames = 0
  → (D mantiene dominancia 1800 frames...)
  → stableKey = D (NARANJA) ✅ CAMBIO
```

---

## 🎨 IMPACTO EN LA EXPERIENCIA VISUAL

### ANTES:
- Efectos: 6-7 por minuto ✅
- Cambios de paleta: 6-8 por minuto ❌ (TOO MUCH)
- **Resultado**: Estímulos visuales cada ~5-10 segundos = epilepsia

### DESPUÉS:
- Efectos: 6-7 por minuto ✅
- Cambios de paleta: 1-2 por minuto ✅
- **Resultado**: Coherencia visual, cambios solo cuando importan

---

## ✅ VERIFICACIÓN

Para confirmar que WAVE 1183 funciona:

1. **Log de cambios de Key**:
   ```
   [KeyStabilizer] 🎵 KEY CHANGE: C → D (after 1800 frames, X total changes)
   ```
   Deberías ver este log cada 30+ segundos, no cada 3-10 segundos.

2. **Observación visual**:
   - La paleta de color debería **permanecer estable** durante 30+ segundos
   - Solo cambia en modulaciones reales o cambio de track
   - Los efectos pueden disparar sin cambiar la paleta base

---

## 📁 ARCHIVOS MODIFICADOS

- `electron-app/src/engine/color/KeyStabilizer.ts`
  - bufferSize: 300 → 600 (5s → 10s)
  - lockingFrames: 180 → 1800 (3s → 30s)
  - dominanceThreshold: 0.40 → 0.50 (más consenso)

---

*"Nadie cambia la paleta cada 10 segundos. La coherencia cromática es el arte."*  
— Cónclave, WAVE 1183
