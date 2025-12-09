# 🔥 FIX CRÍTICO - LA RAÍZ DEL BUCLE: key={activeTab}

## WAVE 14.9.1: El Culpable Final Revelado

### El Log Revelador
```
telemetryStore.ts:385 [TelemetryStore] 📡 IPC unsubscribed
index.tsx:163 [SetupView] 🎯 Loaded installation type: ceiling
index.tsx:346 [SetupView] 📦 Fixture IDs: (13) [...]
index.tsx:348 [SetupView] 📦 Found 13 fixtures
```

Cada vez que cambiabas de pestaña (Setup → Live → Setup), estos logs aparecían. ¿Por qué?

---

## La Causa Raíz (La VERDADERA)

### ContentArea.tsx - Línea 39
```tsx
// ❌ ANTES (EL ASESINO)
<div className="view-container" key={activeTab}>
  {renderView()}
</div>
```

### ¿Qué hace `key={activeTab}`?

En React, cuando cambias el `key` de un componente, React interpreta que es un **componente completamente diferente** y lo **desmonta y re-monta desde cero**.

```
Usuario: Click en "Live" tab
  ↓
activeTab cambia de 'setup' → 'live'
  ↓
key cambia de 'setup' → 'live'
  ↓
React: "¡Nuevo key! Este es un componente DIFERENTE"
  ↓
SetupView → Desmontado (cleanup de todos los useEffect)
  ↓
LiveView → Montado desde cero
  ↓
Usuario: Click en "Setup" tab
  ↓
activeTab cambia de 'live' → 'setup'
  ↓
key cambia de 'live' → 'setup'
  ↓
React: "¡Otro componente nuevo!"
  ↓
SetupView → Montado DESDE CERO (todos los useEffect se ejecutan de nuevo)
  ↓
hasLoadedConfig.current = false (nuevo componente)
hasScannedLibrary.current = false (nuevo componente)
  ↓
loadConfig() se ejecuta
scanFixtures() se ejecuta
getPatchedFixtures() se ejecuta
  ↓
BUCLE INFINITO REINICIA
```

---

## ¿Por Qué Pusieron key={activeTab}?

Probablemente para **forzar una limpieza** al cambiar de vista, pero esto es **anti-pattern** en React:

1. **Desmonta TODOS los listeners IPC** (TelemetryStore, TrinityProvider)
2. **Resetea TODOS los useRef flags** (vuelven a `false`)
3. **Re-ejecuta TODOS los useEffect** (carga config, scan fixtures, etc.)
4. **Destruye el estado interno** del componente

---

## La Solución

```tsx
// ✅ AHORA (SIN key)
<div className="view-container">
  {renderView()}
</div>
```

React ahora hace **transición de componentes** en lugar de **desmontaje forzado**:

```
Usuario: Click en "Live" tab
  ↓
activeTab cambia de 'setup' → 'live'
  ↓
React: "Mismo container, diferente hijo"
  ↓
SetupView → Se desmonta (cleanup normal)
LiveView → Se monta
  ↓
Usuario: Click en "Setup" tab
  ↓
SetupView → Se RE-monta (pero SIN el key forzado)
  ↓
hasLoadedConfig.current SIGUE siendo true (el ref sobrevive)
hasScannedLibrary.current SIGUE siendo true
  ↓
loadConfig() NO se ejecuta (flag protege)
scanFixtures() NO se ejecuta (flag protege)
  ↓
CERO re-cargas innecesarias ✅
```

---

## Otros Fixes Complementarios

### 1. TrinityProvider - Prevenir Múltiples Suscripciones
```tsx
const hasSubscribedToFixtures = useRef(false)

useEffect(() => {
  if (!window.electron || hasSubscribedToFixtures.current) return
  hasSubscribedToFixtures.current = true
  
  window.electron.ipcRenderer.on('lux:fixtures-loaded', handleFixturesLoaded)
  
  return () => {
    window.electron.ipcRenderer.removeListener('lux:fixtures-loaded', handleFixturesLoaded)
    hasSubscribedToFixtures.current = false // Reset al desmontar
  }
}, [])
```

**Por qué:** Aunque el componente se desmonte/monte, el listener no debe duplicarse.

### 2. SetupView - Delay en scanFixtures
```tsx
useEffect(() => {
  if (hasScannedLibrary.current) return
  hasScannedLibrary.current = true
  
  const timer = setTimeout(() => {
    scanFixtures()
  }, 100)
  
  return () => clearTimeout(timer)
}, [])
```

**Por qué:** React Strict Mode ejecuta efectos 2 veces. El delay + cleanup evita race conditions.

---

## Resultado Esperado

### ANTES (Con key={activeTab})
```
[Cambio a Setup]
[SetupView] 🎯 Loaded installation type: ceiling
[SetupView] 📦 Found 13 fixtures
[TelemetryStore] 📡 IPC initialized
[TelemetryStore] 📡 IPC unsubscribed  ← Desmontaje
[Trinity] 📡 Listening for fixture updates...

[Cambio a Live]
[TelemetryStore] 📡 IPC unsubscribed  ← Otro desmontaje

[Regreso a Setup]
[SetupView] 🎯 Loaded installation type: ceiling  ← RE-carga
[SetupView] 📦 Found 13 fixtures  ← RE-scan
[TelemetryStore] 📡 IPC initialized  ← RE-suscripción
```

### AHORA (Sin key)
```
[Cambio a Setup - Primera vez]
[SetupView] 🎯 Loaded installation type: ceiling
[SetupView] 📦 Found 13 fixtures
[Trinity] 📡 Listening for fixture updates...
[TelemetryStore] 📡 IPC initialized

[Cambio a Live]
... (silencio) ...

[Regreso a Setup]
... (silencio - sin logs de recarga) ...
```

---

## Lecciones Aprendidas

1. **NUNCA uses `key={prop}` en containers de navegación.**
   - Solo usa `key` si REALMENTE necesitas resetear el estado interno del componente.

2. **React Strict Mode es tu amigo (pero duele).**
   - Ejecuta efectos dos veces para detectar bugs.
   - Los `useRef` flags + cleanup adecuado lo resuelven.

3. **IPC Listeners NO deben acumularse.**
   - Siempre verifica si ya existe un listener antes de agregar otro.
   - Usa flags (`useRef`) para tracking.

4. **Los useEffect con `[]` NO garantizan una sola ejecución en dev.**
   - En Strict Mode, se ejecutan 2 veces.
   - Usa `useRef` + early return para protección real.

---

## Archivos Modificados

1. ✅ `ContentArea.tsx` - Eliminado `key={activeTab}` (LA RAÍZ DEL MAL)
2. ✅ `TrinityProvider.tsx` - Flag `hasSubscribedToFixtures` para prevenir duplicados
3. ✅ `SetupView/index.tsx` - Delay en `scanFixtures()` para evitar race conditions

---

## Testing

Para confirmar el fix:

1. ✅ Abrir Setup → Ver logs iniciales (config, scan)
2. ✅ Cambiar a Live → NO debería haber logs de desmontaje agresivo
3. ✅ Regresar a Setup → **CERO logs de recarga**
4. ✅ Cambiar modo Selene/Flow → NO debería causar re-mount de Setup
5. ✅ CPU usage estable (~5-15%)
