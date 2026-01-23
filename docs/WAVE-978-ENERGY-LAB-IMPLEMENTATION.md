# 🧪 WAVE 978 - THE ENERGY LAB (PHASE 1) - IMPLEMENTATION COMPLETE

**FECHA**: 2026-01-23  
**IMPLEMENTADO POR**: PunkOpus  
**STATUS**: ✅ READY FOR DATA COLLECTION

---

## 📦 ARCHIVOS CREADOS

### 1️⃣ `EnergyLogger.ts`
**Ubicación**: `electron-app/src/core/intelligence/EnergyLogger.ts`

**Funcionalidad**:
- Logger singleton que escribe datos crudos a CSV
- Buffer automático (100 entries o 5 segundos)
- Flush final en shutdown
- Output: `logs/energy_lab_[timestamp].csv`

**Columnas CSV**:
```
timestamp,raw_energy,smoothed_energy,zone_label,agc_gain,bass_band,spectral_flux,mid_band,treble_band,percentile
```

---

## 🔧 ARCHIVOS MODIFICADOS

### 2️⃣ `EnergyConsciousnessEngine.ts`

**Cambios**:
1. Importado `EnergyLogger`
2. Creada interfaz `EnergyDebugData` para datos opcionales
3. Modificado método `process()` para aceptar `debugData` opcional
4. Inyectada sonda en proceso:
   ```typescript
   if (EnergyLogger.isEnabled()) {
     EnergyLogger.log({
       timestamp: now,
       raw: rawEnergy,
       smooth: smoothed,
       zone: this.currentZone,
       gain: debugData?.agcGain ?? 1.0,
       bass: debugData?.bassEnergy ?? 0,
       spectralFlux: debugData?.spectralFlux,
       mid: debugData?.midEnergy,
       treble: debugData?.trebleEnergy,
       percentile,
     })
   }
   ```

### 3️⃣ `SeleneTitanConscious.ts`

**Cambios**:
1. Importado `EnergyLogger`
2. Agregada constante `DEBUG_ENERGY` (línea ~119):
   ```typescript
   const DEBUG_ENERGY = false  // 🧪 Set to TRUE to activate Energy Lab
   ```
3. Inicialización del logger en constructor (si DEBUG_ENERGY = true)
4. Pasados datos disponibles al `energyConsciousness.process()`:
   ```typescript
   const energyContext = this.energyConsciousness.process(state.rawEnergy, {
     bassEnergy: state.bass,
     midEnergy: state.mid,
     trebleEnergy: state.high,
   })
   ```

---

## 🧪 PROTOCOLO DE PRUEBA (PARA RADWULF)

### PASO 1: ACTIVAR DEBUG

1. Abrir `SeleneTitanConscious.ts` (línea ~119)
2. Cambiar:
   ```typescript
   const DEBUG_ENERGY = false
   ```
   A:
   ```typescript
   const DEBUG_ENERGY = true  // 🧪 ENERGY LAB ACTIVATED
   ```

### PASO 2: EJECUTAR SESIÓN DE PRUEBA

1. Reiniciar la aplicación
2. Deberías ver en consola:
   ```
   [🧪 ENERGY_LAB] DEBUG_ENERGY = TRUE → Initializing logger...
   [🧪 ENERGY_LAB] Initialized: C:\...\logs\energy_lab_2026-01-23T14-30-00.csv
   ```

3. Reproducir los siguientes tracks (30s cada uno):
   - ✅ **Hard Techno** (ritmo constante, 138-145 BPM)
   - ✅ **Dubstep/Trap** (drops con espacios, bass pesado)
   - ✅ **Ambient/Breakdown** (sin bombo, atmospheric)

4. Cerrar la aplicación (el logger hace flush automático en shutdown)

5. Buscar el archivo CSV en: `logs/energy_lab_[timestamp].csv`

### PASO 3: ENVIAR DATOS

Enviar el CSV al Cónclave para análisis.

---

## 📊 QUÉ ESPERAMOS VER

### HIPÓTESIS A VALIDAR:

1. **AGC Compression**:
   - ¿Está el AGC comprimiendo los drops?
   - ¿Columna `agc_gain` muestra valores altos durante drops?
   - **NOTA**: AGC gain NO está disponible aún en TitanState (columna estará en 1.0)

2. **Energy Normalization**:
   - ¿`raw_energy` muestra los drops claramente?
   - ¿`smoothed_energy` está matando los picos?
   - ¿La diferencia entre raw/smooth es grande durante transitorios?

3. **Zone Classification**:
   - ¿Drops reales (E=0.84+) llegan a `intense` o se quedan en `active`/`valley`?
   - ¿Silencios/breakdowns se clasifican correctamente como `silence`/`valley`?

4. **Bass Band Energy**:
   - ¿`bass_band` muestra energía alta durante drops de Dubstep?
   - ¿El sistema está "ciego" a los sub-bajos?

---

## ⚠️ LIMITACIONES ACTUALES

### DATOS NO DISPONIBLES (YET):

1. **AGC Gain**: 
   - No está en `TitanStabilizedState`
   - Necesita agregarse en el pipeline de audio
   - Columna CSV tendrá valor fijo `1.0`

2. **Spectral Flux**:
   - No está en `TitanStabilizedState`
   - Necesita calcularse en el análisis espectral
   - Columna CSV tendrá valor fijo `0.0`

### WORKAROUND:

El CSV capturará:
- ✅ `raw_energy` (crítico)
- ✅ `smoothed_energy` (crítico)
- ✅ `zone_label` (crítico)
- ✅ `bass_band` (disponible)
- ✅ `mid_band` (disponible)
- ✅ `treble_band` (disponible)
- ✅ `percentile` (disponible)
- ❌ `agc_gain` (fijo en 1.0 por ahora)
- ❌ `spectral_flux` (fijo en 0.0 por ahora)

---

## 🔬 SIGUIENTE FASE (WAVE 978.2)

Una vez analizado el CSV, implementaremos:

1. **Peak Hold** (si AGC está comprimiendo)
2. **Spectral Flux** (para detectar transitorios de bombo)
3. **Sub-Bass Boost** (si el sistema está ciego a sub-100Hz)
4. **Zone Threshold Recalibration** (si los umbrales están mal)

**POR AHORA**: Solo observación. NO tocar calibración.

---

## 📝 CÓDIGO RELEVANTE

### Activar/Desactivar Logger:

```typescript
// En SeleneTitanConscious.ts (línea ~119)
const DEBUG_ENERGY = true  // Toggle aquí
```

### Leer logs:

```typescript
// El logger escribe automáticamente
// Archivo: logs/energy_lab_[timestamp].csv
// Se puede abrir con Excel, Google Sheets, o Python pandas
```

### Análisis Python (ejemplo):

```python
import pandas as pd
import matplotlib.pyplot as plt

# Leer CSV
df = pd.read_csv('logs/energy_lab_2026-01-23T14-30-00.csv')

# Plot energía
plt.figure(figsize=(15, 5))
plt.plot(df['timestamp'], df['raw_energy'], label='Raw', alpha=0.7)
plt.plot(df['timestamp'], df['smoothed_energy'], label='Smoothed', alpha=0.9)
plt.axhline(y=0.82, color='r', linestyle='--', label='Intense Threshold')
plt.axhline(y=0.92, color='r', linestyle='--', label='Peak Threshold')
plt.legend()
plt.title('Energy Analysis')
plt.show()

# Ver distribución de zonas
print(df['zone_label'].value_counts())

# Identificar drops (raw > 0.82 pero zone != intense/peak)
drops_missed = df[(df['raw_energy'] > 0.82) & (~df['zone_label'].isin(['intense', 'peak']))]
print(f"Drops missed: {len(drops_missed)}")
```

---

**PunkOpus**  
*"No arreglamos lo que no podemos medir"*
