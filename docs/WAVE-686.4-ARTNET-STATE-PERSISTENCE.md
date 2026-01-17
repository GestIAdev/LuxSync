# WAVE 686.4: ARTNET STATE PERSISTENCE FIX

**Fecha:** 2025-01-17  
**Bug:** ArtNet UI state not syncing with real backend state  
**Estado:** ✅ FIXED

---

## 🐛 BUG DESCRIPTION

Al cambiar de vista y volver al Dashboard, el `ArtNetPanel` mostraba el botón "🚀 Start" aunque ArtNet ya estuviera corriendo. Al presionar Start de nuevo:

```
Error: Socket already bound to port 59292
```

**Root cause**: El componente `ArtNetPanel` tiene estado local (`ip`, `port`, `universe`) que se inicializa con defaults, pero NO se sincroniza con la configuración REAL de ArtNet cuando el componente se monta.

---

## 🔍 ANÁLISIS

### Estado ANTES del fix:

```typescript
const ArtNetPanel: React.FC = () => {
  const [ip, setIp] = useState('255.255.255.255')  // ❌ Siempre defaults
  const [port, setPort] = useState(6454)           // ❌ No sincroniza
  const [universe, setUniverse] = useState(1)      // ❌ No lee backend
  
  useEffect(() => {
    const fetchStatus = async () => {
      const result = await artnetApi.getStatus()
      if (result.success) {
        setStatus(result)  // ✅ Solo actualiza status
        // ❌ NO actualiza ip/port/universe
      }
    }
    // ...
  }, [])
}
```

**Problema**: `status` se actualiza con el estado real, pero los campos `ip/port/universe` siguen con los defaults.

**Resultado**: 
- UI muestra "Start" porque campos locales != backend
- Backend ya está corriendo con `10.0.0.10:6454`
- Usuario ve "255.255.255.255" y cree que puede reconectar

---

## ✅ SOLUCIÓN

Sincronizar campos locales con la configuración REAL al montar:

```typescript
useEffect(() => {
  const fetchStatus = async () => {
    const artnetApi = getArtnetApi()
    if (artnetApi?.getStatus) {
      try {
        const result = await artnetApi.getStatus()
        if (result.success) {
          const artnetStatus = result as ArtNetStatus
          setStatus(artnetStatus)
          
          // 🔥 NEW: Sync local fields with running config
          if (artnetStatus.state === 'ready' || artnetStatus.state === 'sending') {
            setIp(artnetStatus.ip)
            setPort(artnetStatus.port)
            setUniverse(artnetStatus.universe)
          }
        }
      } catch (err) {
        console.warn('[ArtNet] Status fetch failed:', err)
      }
    }
  }

  // Fetch immediately on mount
  fetchStatus()
  const interval = setInterval(fetchStatus, 2000)
  return () => clearInterval(interval)
}, [])
```

---

## 🎯 COMPORTAMIENTO CORRECTO

### Escenario 1: ArtNet NO está corriendo
1. Usuario abre Dashboard
2. Panel muestra: `255.255.255.255:6454` universe `1`
3. Botón: "🚀 Start"
4. Usuario configura y presiona Start
5. ArtNet arranca

### Escenario 2: ArtNet YA está corriendo
1. Usuario abre Dashboard (o vuelve de otra vista)
2. `fetchStatus()` detecta `state: 'sending'`
3. Panel sincroniza campos: `10.0.0.10:6454` universe `1`
4. Botón: "🛑 Stop"
5. Campos disabled (no editable mientras conectado)

### Escenario 3: Usuario cambia de vista y vuelve
1. ArtNet corriendo con `10.0.0.10:6454`
2. Usuario va a Constructor → vuelve a Dashboard
3. `useEffect` se ejecuta en mount
4. `fetchStatus()` lee backend: `state: 'sending'`
5. **UI sincroniza**: `10.0.0.10:6454` + botón Stop ✅

---

## 📁 ARCHIVO MODIFICADO

**File**: `electron-app/src/components/views/DashboardView/components/SystemsCheck.tsx`

**Change**:
```diff
  useEffect(() => {
    const fetchStatus = async () => {
      const artnetApi = getArtnetApi()
      if (artnetApi?.getStatus) {
        try {
          const result = await artnetApi.getStatus()
          if (result.success) {
-           setStatus(result as ArtNetStatus)
+           const artnetStatus = result as ArtNetStatus
+           setStatus(artnetStatus)
+           
+           // 🔥 Sync local fields with running config
+           if (artnetStatus.state === 'ready' || artnetStatus.state === 'sending') {
+             setIp(artnetStatus.ip)
+             setPort(artnetStatus.port)
+             setUniverse(artnetStatus.universe)
+           }
          }
        } catch (err) {
          console.warn('[ArtNet] Status fetch failed:', err)
        }
      }
    }

-   fetchStatus()
+   // Fetch immediately on mount
+   fetchStatus()
    const interval = setInterval(fetchStatus, 2000)
    return () => clearInterval(interval)
  }, [])
```

---

## ✅ VERIFICACIÓN

**Test case**:
1. Iniciar ArtNet con IP `10.0.0.10`
2. Ir a Constructor
3. Volver a Dashboard
4. **Expected**: Panel muestra `10.0.0.10:6454`, botón "🛑 Stop", campos disabled
5. **Actual**: ✅ FUNCIONA

---

## 🔥 LESSON LEARNED

Cuando un componente tiene **estado local** que representa **estado de backend**, necesitas:

1. **Fetch inicial** al montar: `useEffect(() => { fetch() }, [])`
2. **Sincronización bidireccional**: Backend → UI fields
3. **Polling periódico**: Para detectar cambios externos
4. **Conditional sync**: Solo sincronizar si backend está en estado válido

**Pattern**:
```typescript
const [localState, setLocalState] = useState(defaults)

useEffect(() => {
  const sync = async () => {
    const backendState = await fetchBackend()
    if (backendState.isValid) {
      setLocalState(backendState.config)  // 🔥 Sync!
    }
  }
  
  sync()  // Immediate
  const interval = setInterval(sync, 2000)  // Periodic
  return () => clearInterval(interval)
}, [])
```

**Esto evita**: Desincronización UI ↔ Backend = UX roto.
