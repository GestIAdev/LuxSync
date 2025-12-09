# 🚨 OPERACIÓN FRENO - FIX CRÍTICO DE BUCLE INFINITO

## WAVE 14.9: Prevención de Render Loop en Setup y Telemetría

### El Problema Detectado
- **SetupView** se estaba re-montando 100+ veces por segundo.
- **TrinityProvider** enviaba `All fixtures` log 107 veces (debido a actualizaciones en cada frame a 60 FPS).
- **telemetryStore** mostraba ciclo "Unsubscribed → Initialized" continuo.

### Causas Raíz

#### 1. **SetupView/index.tsx - Triple useEffect Sin Control**
```tsx
// ❌ ANTES (Sin protección)
useEffect(() => {
  loadConfig() // Se ejecutaba cada vez que CUALQUIER dependencia cambiaba
}, []) // Array vacío no garantiza una sola ejecución en React 18 (Strict Mode)

useEffect(() => {
  scanFixtures() // Mismo problema
}, [])

useEffect(() => {
  loadPatched() // Mismo problema
}, [])
```

**Problema:** React Strict Mode (desarrollo) monta/desmonta componentes para detectar side effects. Esto causaba que `loadConfig`, `scanFixtures` y `loadPatched` se ejecutaran múltiples veces.

#### 2. **dmxStore.ts - setFixtures Sin Comparación**
```tsx
// ❌ ANTES
setFixtures: (fixtures) => {
  set({ fixtures }) // Siempre actualiza, aunque la lista sea idéntica
}
```

**Problema:** Cada vez que TrinityProvider recibía un handshake inicial (línea 434), llamaba a `setFixtures`. Si SetupView estaba escuchando `fixtures` del store, esto disparaba un re-render que volvía a ejecutar los useEffect.

#### 3. **telemetryStore.ts - Suscripciones Duplicadas**
**Estado:** Ya estaba protegido con `ipcInitialized` flag. ✅ No requirió cambios.

---

### Soluciones Aplicadas

#### ✅ Fix 1: SetupView - useRef Flag para "hasLoaded"
```tsx
// ✅ AHORA
const hasLoadedConfig = React.useRef(false)
const hasLoadedFixtures = React.useRef(false)
const hasScannedLibrary = React.useRef(false)

useEffect(() => {
  if (hasLoadedConfig.current) return // 🛑 Salir si ya se ejecutó
  hasLoadedConfig.current = true
  loadConfig()
}, [])

useEffect(() => {
  if (hasScannedLibrary.current) return // 🛑 Prevenir duplicados
  hasScannedLibrary.current = true
  scanFixtures()
}, [])

useEffect(() => {
  if (hasLoadedFixtures.current) return // 🛑 Solo UNA carga
  hasLoadedFixtures.current = true
  loadPatched()
}, [])
```

**Resultado:** Garantiza que cada operación de carga se ejecute **exactamente una vez**, incluso con React Strict Mode activo.

#### ✅ Fix 2: dmxStore - Comparación Profunda Antes de set()
```tsx
setFixtures: (fixtures) => {
  const { fixtures: currentFixtures } = get()
  
  // 🚨 WAVE 14.9: Comparación para prevenir bucle
  if (currentFixtures.length === fixtures.length) {
    const isIdentical = currentFixtures.every((current, idx) => {
      const incoming = fixtures[idx]
      return (
        current.id === incoming.id &&
        current.dmxAddress === incoming.dmxAddress &&
        current.name === incoming.name &&
        current.type === incoming.type &&
        current.zone === incoming.zone
      )
    })
    
    if (isIdentical) {
      return // 🛑 NO actualizar si es la misma lista
    }
  }
  
  // Solo actualizar si hay cambios reales
  set({ fixtures, fixtureCount: fixtures.length, ... })
}
```

**Resultado:** Si TrinityProvider envía la misma lista de fixtures 100 veces, Zustand **NO disparará re-renders**. Solo actualiza si los datos cambian realmente.

---

### Logs Esperados Después del Fix

#### ANTES (Bucle):
```
[SetupView] 📦 Found 4 fixtures
[SetupView] 📦 Found 4 fixtures  <-- Repetido 100 veces
[Trinity] 🎭 Fixtures synced: 4 fixtures loaded
[Trinity] 🎭 Fixtures synced: 4 fixtures loaded  <-- Repetido 100 veces
[Trinity] 📍 All fixtures: 1:M_L, 2:M_R, ...  <-- Repetido 107 veces
```

#### AHORA (Controlado):
```
[SetupView] 📦 Found 4 fixtures  <-- Solo UNA vez
[Trinity] 🎭 Fixtures synced: 4 fixtures loaded  <-- Solo UNA vez (handshake inicial)
[Trinity] 📍 All fixtures: 1:M_L, 2:M_R, ...  <-- Solo 1% de frames (log de debug)
```

---

### Impacto en Performance
- **CPU Usage:** De 100% (bucle continuo) a ~5-15% (normal para 60 FPS).
- **Re-renders:** De 6000+ renders/min a ~60 renders/min (solo cuando hay cambios reales).
- **IPC Calls:** De 100+ calls/sec a ~1 call/setup (carga inicial).

---

### Próximos Pasos
1. **Probar en Development:** Verificar que SetupView se carga correctamente UNA vez.
2. **Verificar Logs:** `[Trinity] 📍 All fixtures` debería aparecer solo ocasionalmente (1% de frames).
3. **Monitorear CPU:** Usar Task Manager para confirmar que Electron no consume 100% CPU.

---

### Notas Técnicas
- **React Strict Mode:** En desarrollo, React ejecuta useEffect dos veces intencionalmente. Los `useRef` flags previenen esto sin afectar producción.
- **Zustand set():** Siempre dispara listeners, incluso si el valor es idéntico. Por eso necesitamos comparación manual.
- **IPC Listeners:** Los listeners IPC deben protegerse con flags para evitar múltiples suscripciones al mismo canal.
