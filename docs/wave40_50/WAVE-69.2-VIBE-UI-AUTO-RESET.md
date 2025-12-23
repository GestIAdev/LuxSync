# WAVE 69.2: VIBE UI AUTO-RESET FIX [❌ DESCARTADO - DIAGNÓSTICO INCORRECTO]

> **⚠️ IMPORTANTE**: Este fix fue descartado. El diagnóstico era incorrecto.
> El problema real NO era el OFFLINE reset, sino el component unmount/remount.
> **Ver**: `WAVE-69.2-VIBE-STATE-PERSISTENCE-REVISADO.md` para el fix correcto.

## 🐛 BUG ORIGINAL (DIAGNÓSTICO INCORRECTO): Botón de vibe se deselecciona solo

### Síntomas reportados
1. ✅ Backend logs muestran transición correcta: `idle → fiesta-latina`
2. ❌ UI: botón se ilumina brevemente, luego se apaga solo
3. ❌ Paleta de colores cae a fallback a pesar de vibe correcto en backend

### Diagnóstico del problema

**CAUSA RAÍZ**: Desincronización entre backend y frontend cuando el sistema entra en modo SLEEP.

#### Flujo normal (funciona):
1. Usuario hace click en `fiesta-latina`
2. `main.ts:1339` envía evento `selene:vibe-changed` al frontend ✅
3. `useSeleneVibe` hook actualiza `activeVibe = 'fiesta-latina'` ✅
4. Botón se ilumina ✅

#### Flujo problemático (desincronización):
1. Sistema entra en SLEEP (sin audio activo)
2. `mind.ts:1000` ejecuta `vibeManager.setActiveVibeImmediate('idle')` ✅
3. Backend vibe = `'idle'` ✅
4. **PROBLEMA**: No se envía evento `selene:vibe-changed` al frontend ❌
5. Frontend sigue con `activeVibe = 'fiesta-latina'` ❌
6. **DESINCRONIZACIÓN**: Backend=idle, Frontend=fiesta-latina

### Análisis de código

**mind.ts** (Worker GAMMA):
```typescript
case MessageType.SYSTEM_SLEEP: {
  console.log('[GAMMA] 💤 SYSTEM SLEEP - Pausing audio processing');
  state.isPaused = true;
  state.keyStabilizer.reset();
  state.energyStabilizer.reset();
  state.moodArbiter.reset();
  state.strategyArbiter.reset();
  // 🔌 WAVE 64.5: Reset vibe to IDLE (no pop-rock)
  vibeManager.setActiveVibeImmediate('idle');  // ⚠️ NO EMITE EVENTO
  break;
}
```

**VibeManager.ts**:
```typescript
public setActiveVibeImmediate(vibeId: VibeId | string): boolean {
  if (!isValidVibeId(vibeId)) return false;
  const newVibe = getVibePreset(vibeId);
  if (!newVibe) return false;
  
  this.currentVibe = newVibe;
  this.previousVibe = null;
  this.transitionProgress = 1.0;
  return true;  // ⚠️ Solo actualiza estado interno, NO notifica
}
```

**Arquitectura de comunicación**:
- Workers (BETA/GAMMA) NO tienen comunicación directa con `main.ts`
- Workers solo se comunican entre sí vía `TrinityOrchestrator` (ALPHA)
- `main.ts` solo envía comandos a workers vía `trinity.setVibe()`
- `main.ts:1339` envía evento optimista ANTES de confirmación del worker

### Soluciones consideradas

#### ❌ Opción 1: Worker GAMMA → ALPHA → Main → Frontend
**Pros**: Arquitectura correcta, comunicación explícita
**Contras**: Requiere:
- Nuevo tipo de mensaje `VIBE_CHANGED_NOTIFICATION`
- Listener en ALPHA para reenviar a main
- Listener en main para enviar a frontend
- Complejidad alta para un caso edge

#### ✅ Opción 2: Frontend auto-reset en OFFLINE (IMPLEMENTADA)
**Pros**: 
- Simple, pragmática
- Aprovecha el knowledge del frontend sobre power state
- Sincroniza automáticamente con el comportamiento del backend
**Contras**: 
- Lógica duplicada (backend + frontend resetean a idle)
- Asume que OFFLINE siempre implica vibe=idle (válido por diseño)

### Solución implementada

**Archivo**: `useSeleneVibe.ts`
**Estrategia**: Auto-reset a `null` cuando `powerState` → `'OFFLINE'`

```typescript
// 🐛 WAVE 69.2: Listen to power state to auto-reset vibe when offline
const powerState = usePowerStore(state => state.powerState)

// 🐛 WAVE 69.2: Auto-reset vibe cuando sistema → OFFLINE
// Backend llama setActiveVibeImmediate('idle') en SYSTEM_SLEEP pero NO notifica frontend
useEffect(() => {
  if (powerState === 'OFFLINE' && activeVibe !== null) {
    console.log('[useSeleneVibe] 🔌 System OFFLINE → Resetting vibe to idle')
    setActiveVibe(null)
    setIsTransitioning(false)
  }
}, [powerState, activeVibe])
```

**Lógica**:
- Hook `useSeleneVibe` ahora escucha `usePowerStore.powerState`
- Cuando `powerState === 'OFFLINE'` Y hay un vibe activo (`activeVibe !== null`)
- Auto-resetea a `null` (equivalente visual de `'idle'`)
- Apaga el transitioning para liberar el botón

### Validación

**Flujo corregido**:
1. Usuario hace click en `fiesta-latina`
2. Frontend: `activeVibe = 'fiesta-latina'`, botón iluminado ✅
3. Sistema entra en SLEEP (sin audio)
4. Backend: `vibeManager.setActiveVibeImmediate('idle')` ✅
5. `main.ts` envía `system:power-off` al frontend ✅
6. `usePowerStore` actualiza `powerState = 'OFFLINE'` ✅
7. `useSeleneVibe` detecta cambio y resetea `activeVibe = null` ✅
8. Botón se apaga, sincronizado con backend ✅

**Comportamientos esperados**:
- ✅ Botón se apaga cuando sistema entra en OFFLINE
- ✅ Botón permanece apagado mientras OFFLINE
- ✅ Cuando sistema vuelve a ONLINE, vibe permanece en `idle` hasta que usuario seleccione nuevo
- ✅ No hay estados visuales fantasma (botón iluminado sin backend activo)

### Cambios de código

#### Archivos modificados
1. `electron-app/src/hooks/useSeleneVibe.ts`
   - Agregado import `usePowerStore`
   - Agregado listener de `powerState`
   - Agregado `useEffect` para auto-reset en OFFLINE
   - Actualizado header con documentación WAVE 69.2

#### Archivos NO modificados (considerados pero descartados)
- `mind.ts` - No se agregó notificación de vibe change en SYSTEM_SLEEP
- `TrinityOrchestrator.ts` - No se agregó mensaje VIBE_CHANGED_NOTIFICATION
- `main.ts` - No se modificó flujo de eventos vibe

### Testing manual recomendado

1. **Caso: Vibe persiste durante sesión activa**
   - Encender sistema (ONLINE)
   - Seleccionar `fiesta-latina`
   - Reproducir audio constante
   - **Esperado**: Botón permanece iluminado, paleta cálida activa

2. **Caso: Vibe se resetea en OFFLINE**
   - Sistema ONLINE con `fiesta-latina` activo
   - Apagar sistema (botón power OFF)
   - **Esperado**: Botón `fiesta-latina` se apaga inmediatamente
   - Encender sistema de nuevo
   - **Esperado**: Ningún vibe iluminado (idle state)

3. **Caso: Vibe se resetea por inactividad de audio**
   - Sistema ONLINE con `techno-club` activo
   - Pausar audio por varios segundos
   - Sistema entra en auto-SLEEP
   - **Esperado**: Botón se apaga cuando UI detecta OFFLINE

### Métricas de éxito

- ✅ Compilación TypeScript sin errores
- ✅ No hay re-renders infinitos (useEffect con dependencias correctas)
- ✅ Sincronización visual con backend power state
- ✅ UX coherente: botones apagados = sistema apagado

### Notas arquitectónicas

Este fix es un **compromiso pragmático** entre:
- **Pureza arquitectural**: Toda sincronización vía eventos explícitos
- **Pragmatismo**: Aprovechar el conocimiento del frontend sobre power state

El frontend ya tiene el knowledge de que:
- `powerState === 'OFFLINE'` implica que el backend ejecutó SYSTEM_SLEEP
- SYSTEM_SLEEP siempre resetea vibe a `'idle'` (por diseño en WAVE 64.5)

Por lo tanto, **es semánticamente correcto** que el frontend infiera el reset del vibe cuando detecta OFFLINE, sin esperar evento explícito.

### Relación con WAVES anteriores

- **WAVE 64**: Introducción de vibe `'idle'` como estado por defecto
- **WAVE 64.5**: Backend resetea a `'idle'` en SYSTEM_SLEEP
- **WAVE 68-69.1**: Fixes de temperatura, DROP, genre purge, vibe logging
- **WAVE 69.2**: Fix de sincronización UI/backend para vibe state

### Próximos pasos

Si el problema de "palette falling back" persiste después de este fix:
1. Verificar que `selenePalette` se genera correctamente en backend (logs chromatic audit)
2. Verificar que `truthStore` propaga correctamente la paleta al frontend
3. Verificar que componentes de UI leen de `truthStore` y NO tienen fallback prematuro

---

**Timestamp**: WAVE 69.2 - 2024
**Autor**: Agent (con diagnóstico de usuario)
**Status**: ✅ IMPLEMENTADO
