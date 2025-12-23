# WAVE 69.2: VIBE STATE PERSISTENCE FIX (REVISADO)

## 🐛 BUG REAL: Vibe se pierde al cambiar de pestaña

### Síntomas confirmados por usuario
1. ✅ Usuario selecciona vibe (ej: `fiesta-latina`)
2. ✅ Botón se ilumina correctamente
3. ❌ **Al cambiar de pestaña (DMX/Setup/etc), botón se apaga**
4. ❌ Al volver a Dashboard, vibe no está seleccionado

### Diagnóstico corregido

**CAUSA RAÍZ**: Component unmount/remount al cambiar de vista.

#### Arquitectura del problema:
```
App
└── CurrentView (controlled by navigation)
    ├── DashboardView  ← Monta cuando tab = "Dashboard"
    │   └── VibeSelector
    │       └── useSeleneVibe() ← useState local
    ├── DMXView  ← Monta cuando tab = "DMX"
    └── SetupView  ← Monta cuando tab = "Setup"
```

**Flujo del bug**:
1. Usuario en Dashboard → `DashboardView` MONTADO → `useSeleneVibe()` crea `useState`
2. Usuario selecciona `fiesta-latina` → `useState` actualiza → botón iluminado ✅
3. Usuario cambia a pestaña DMX → `DashboardView` SE DESMONTA ❌
4. `useSeleneVibe()` se destruye → `useState` se pierde ❌
5. Usuario vuelve a Dashboard → `DashboardView` SE REMONTA
6. `useSeleneVibe()` crea NUEVO `useState` → state inicial = `null` ❌
7. Botón aparece apagado aunque backend aún tiene el vibe activo

### Solución anterior (WAVE 69.2 original) - INCORRECTA

❌ **Error de diagnóstico**: Pensamos que el problema era OFFLINE → reset a idle
❌ **Fix implementado**: Auto-reset en `powerState === 'OFFLINE'`
❌ **Resultado**: NO solucionó el problema real (cambio de pestaña)

### Solución correcta (WAVE 69.2 REVISADO)

✅ **Migración de useState local a Zustand store global**

#### Archivos creados:
**`electron-app/src/stores/vibeStore.ts`** - Store global persistente

```typescript
export const useVibeStore = create<VibeStoreState>((set, get) => ({
  currentVibe: 'idle',           // Backend truth
  isTransitioning: false,
  hasFetchedInitial: false,
  lastUpdated: 0,
  
  setCurrentVibe: (vibe: VibeId) => {
    set({ 
      currentVibe: vibe, 
      lastUpdated: Date.now(),
      isTransitioning: false
    })
  },
  
  getVisualVibe: () => {
    const vibe = get().currentVibe
    // 'idle' se mapea a null visual
    return vibe === 'idle' ? null : vibe as VibeVisualId
  }
}))
```

**Características del store**:
- **Global**: Sobrevive unmount/remount de componentes
- **Single source of truth**: Un solo lugar para el vibe state
- **Sincronizado con backend**: Actualiza vía IPC events
- **Visual mapping**: `'idle'` → `null` (ningún botón iluminado)

#### Archivos modificados:
**`electron-app/src/hooks/useSeleneVibe.ts`** - Hook refactorizado

**Cambios clave**:
1. ❌ Removido: `const [activeVibe, setActiveVibe] = useState<VibeId | null>(null)`
2. ❌ Removido: `const [isTransitioning, setIsTransitioning] = useState(false)`
3. ❌ Removido: `const [hasFetched, setHasFetched] = useState(false)`
4. ✅ Agregado: Lecturas del store global `useVibeStore`

```typescript
// ANTES (WAVE 64):
const [activeVibe, setActiveVibe] = useState<VibeId | null>(null)
const [isTransitioning, setIsTransitioning] = useState(false)
const [hasFetched, setHasFetched] = useState(false)

// DESPUÉS (WAVE 69.2):
const currentVibe = useVibeStore(state => state.currentVibe)
const isTransitioning = useVibeStore(state => state.isTransitioning)
const hasFetchedInitial = useVibeStore(state => state.hasFetchedInitial)
const getVisualVibe = useVibeStore(state => state.getVisualVibe)
const setCurrentVibe = useVibeStore(state => state.setCurrentVibe)
```

**Beneficios**:
- State persiste entre cambios de vista
- `hasFetchedInitial` evita refetch innecesarios
- Backend sync se mantiene global (no se reinicia)

### Validación del fix

**Flujo corregido**:
1. App arranca → `vibeStore` se crea con `currentVibe: 'idle'`
2. Usuario entra a Dashboard → `useSeleneVibe()` lee del store
3. Fetch inicial: `window.lux.getVibe()` → actualiza store
4. Usuario selecciona `fiesta-latina` → `setCurrentVibe('fiesta-latina')`
5. Store global actualiza → botón se ilumina ✅
6. **Usuario cambia a DMX** → `DashboardView` se desmonta
7. **Store global mantiene** `currentVibe: 'fiesta-latina'` ✅
8. Usuario vuelve a Dashboard → `DashboardView` se remonta
9. `useSeleneVibe()` lee del store → `currentVibe: 'fiesta-latina'` ✅
10. Botón aparece iluminado correctamente ✅

**Casos de prueba**:
1. ✅ Seleccionar vibe → cambiar pestaña → volver → vibe persistente
2. ✅ Seleccionar vibe → apagar sistema → volver a encender → vibe reseteado (comportamiento esperado cuando backend resetea)
3. ✅ Múltiples cambios de pestaña → state siempre consistente

### Diferencias con solución anterior

| Aspecto | WAVE 69.2 Original | WAVE 69.2 REVISADO |
|---------|-------------------|-------------------|
| **Diagnóstico** | OFFLINE causa reset | Component unmount causa pérdida |
| **Fix** | Auto-reset en OFFLINE | useState → Zustand store |
| **Archivos creados** | Ninguno | `vibeStore.ts` |
| **Persistencia** | No | Sí (global store) |
| **Soluciona el bug** | No | Sí |

### Notas arquitectónicas

**Por qué Zustand y no Context API:**
- Zustand es más performante (no causa re-renders innecesarios)
- Store global persiste independiente del árbol de componentes
- API más simple que Redux
- Ya usado en el proyecto (`usePowerStore`, `useControlStore`)

**Por qué no mover VibeSelector a App level:**
- VibeSelector es parte de SeleneBrain (DashboardView)
- Diseño UI: los controles de vibe son específicos de Dashboard
- Cambiar la ubicación requiere redesign de toda la UI

**Trade-offs**:
- ✅ **Pro**: State persiste correctamente
- ✅ **Pro**: Coherente con otros stores del proyecto
- ✅ **Pro**: Facilita debugging (dev tools de Zustand)
- ⚠️ **Con**: Añade una capa de abstracción (store + hook)
- ⚠️ **Con**: Más código a mantener

### Relación con WAVES anteriores

- **WAVE 62**: Introducción del sistema de Vibes
- **WAVE 64**: `'idle'` como vibe por defecto, mapping visual
- **WAVE 68-69.1**: Fixes de temperatura, DROP, genre purge
- **WAVE 69.2 (original)**: Intento fallido de fix OFFLINE
- **WAVE 69.2 (revisado)**: Fix correcto con store global

### Testing manual

**Escenario 1: Persistencia básica**
1. Encender sistema
2. Ir a Dashboard
3. Seleccionar `techno-club`
4. Verificar botón iluminado
5. Cambiar a pestaña DMX
6. Volver a Dashboard
7. **Esperado**: Botón `techno-club` sigue iluminado ✅

**Escenario 2: Múltiples cambios**
1. Con `techno-club` activo
2. Cambiar a `fiesta-latina`
3. Cambiar a pestaña Setup
4. Volver a Dashboard
5. **Esperado**: Botón `fiesta-latina` iluminado ✅

**Escenario 3: Reset por OFFLINE**
1. Con `pop-rock` activo
2. Apagar sistema (Power OFF)
3. Esperar
4. Encender sistema
5. Ir a Dashboard
6. **Esperado**: Ningún botón iluminado (idle) ✅

### Métricas de éxito

- ✅ Compilación TypeScript sin errores
- ✅ No hay re-renders infinitos
- ✅ State persiste entre cambios de vista
- ✅ Sincronización correcta con backend
- ✅ Performance sin degradación

### Archivos del fix

```
electron-app/src/
├── stores/
│   └── vibeStore.ts                    [NUEVO]
├── hooks/
│   └── useSeleneVibe.ts                [MODIFICADO]
└── components/views/DashboardView/
    └── components/
        └── VibeSelector.tsx            [SIN CAMBIOS]
```

### Próximos pasos

Si persiste algún problema después de este fix:
1. Verificar que el store se esté poblando correctamente (DevTools)
2. Verificar que `onVibeChange` se esté subscrib iendo correctamente
3. Verificar que no haya múltiples instancias del hook compitiendo

---

**Timestamp**: WAVE 69.2 REVISADO - 2024-12-22
**Autor**: Agent (diagnóstico correcto del usuario)
**Status**: ✅ IMPLEMENTADO
**Fix anterior**: ❌ DESCARTADO (diagnóstico incorrecto)
