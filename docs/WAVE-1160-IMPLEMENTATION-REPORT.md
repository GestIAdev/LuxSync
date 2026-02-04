# 💀 WAVE 1160 - AUTO-GAIN PACEMAKER

## EL PROBLEMA QUE IDENTIFICÓ EL ARQUITECTO

> "El secreto no es un umbral bajo fijo, es un umbral INTELIGENTE.
> Si la música está bajita, el umbral debe bajar. 
> Si Boris Brejcha suelta el bajo a tope, el umbral debe subir para no comerse el sustain del bajo como si fueran kicks."

**100% correcto.**

### ¿Por qué BETA funciona y PACEMAKER no?

**BETA usa threshold RELATIVO:**
```typescript
const threshold = avgEnergy * 1.2;  // Se adapta al nivel!
```

**PACEMAKER usaba threshold ABSOLUTO:**
```typescript
this.kickThreshold = 0.15;  // Fijo, estúpido, sordo
```

---

## LA SOLUCIÓN: THRESHOLD DINÁMICO

### Nuevas Variables

```typescript
// Media móvil del bass (últimos 30 frames = ~1 segundo)
private bassHistory: number[] = []
private bassAvg = 0.3

// Parámetros de calibración
private readonly KICK_THRESHOLD_BASE = 0.05
private readonly KICK_THRESHOLD_MULTIPLIER = 0.30
```

### La Fórmula Mágica

```typescript
dynamicThreshold = BASE + (bassAvg * MULTIPLIER)
dynamicThreshold = 0.05 + (bassAvg * 0.30)
```

### Tabla de Calibración

| Bass Avg | Threshold | Escenario |
|----------|-----------|-----------|
| 0.2 | 0.11 | Música tranquila → Muy sensible |
| 0.3 | 0.14 | Nivel bajo → Sensible |
| 0.5 | 0.20 | Nivel medio → Equilibrado |
| 0.7 | 0.26 | Boris Brejcha → Ignora wobbles |
| 0.9 | 0.32 | Bass puro → Solo kicks brutales |

---

## CAMBIOS EN process()

```typescript
// 1. Actualizar historial de bass
this.bassHistory.push(metrics.bass)
if (this.bassHistory.length > 30) this.bassHistory.shift()

// 2. Calcular media móvil
this.bassAvg = this.bassHistory.reduce((a, b) => a + b, 0) / this.bassHistory.length

// 3. Threshold DINÁMICO
this.kickThreshold = 0.05 + (this.bassAvg * 0.30)

// 4. Detección de kick con umbral adaptativo
// El bass actual debe ser significativo respecto al promedio
this.state.kickDetected = bassTransient > this.kickThreshold 
                       && metrics.bass > (this.bassAvg * 0.7)
```

---

## LOG DIAGNÓSTICO

El nuevo log muestra el threshold bailando con la música:

```
[💓 PACEMAKER] bass=0.67 avg=0.55 thresh=0.215 trans=0.159 | kicks=25 | bpm=160 (raw:160)
```

- `avg=0.55` → Media móvil del bass
- `thresh=0.215` → Threshold calculado (0.05 + 0.55*0.30)
- `trans=0.159` → Transiente actual
- `0.159 < 0.215` → ¡Este transiente NO es un kick! (wobble filtrado)

---

## ¿POR QUÉ ESTO FUNCIONA?

1. **Música suave** → bassAvg bajo → threshold bajo → detecta kicks suaves ✅
2. **Boris Brejcha** → bassAvg alto → threshold alto → ignora wobbles ✅
3. **Transición** → el threshold se adapta en ~1 segundo ✅

---

## CONFIGURACIÓN ACTUAL

### WAVE 1159 (activa):
- BPM final = `context.bpm || beatState.bpm` (BETA primero, Pacemaker fallback)

### WAVE 1160 (activa):
- kickThreshold = DINÁMICO (ya no fijo)
- Calibración automática basada en bassAvg

Si el PACEMAKER ahora detecta BPM correctamente, podemos eliminar el fallback a BETA y dejar que el Ferrari corra solo.

---

*"The wise threshold listens to the music before judging the kick."*

**- El Arquitecto + PunkOpus, WAVE 1160**
