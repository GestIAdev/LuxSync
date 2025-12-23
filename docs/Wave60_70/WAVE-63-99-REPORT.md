# ⚡ WAVE 63.99 - ARRANQUE LIMPIO (WAIT FOR INPUT)

**Fecha:** 2025-12-22  
**Objetivo:** Eliminar auto-selección de modo en powerOn()

---

## 📊 RESUMEN EJECUTIVO

### Problema Detectado
Al encender el sistema, se auto-seleccionaba `Selene + Techno`:
- ❌ `powerOn()` llamaba `setGlobalMode('selene')` automáticamente
- ❌ El DJ/técnico perdía control sobre el arranque
- ❌ No había estado "Ready but Idle"

### Solución Implementada
- ✅ **ELIMINADO** `setGlobalMode('selene')` de `powerOn()`
- ✅ `globalMode` permanece `null` tras arranque
- ✅ UI muestra estado "esperando selección del usuario"

---

## ❓ CONFIRMACIÓN OBLIGATORIA

### "¿Al dar ON, se selecciona algún modo solo?"

## 🔴 **NO**

Al presionar el botón de Power:
1. El sistema pasa a `ONLINE`
2. El `globalMode` permanece `null`
3. **NINGÚN** botón (Manual/Flow/Selene) está iluminado
4. El Vibe Selector permanece oculto/inactivo
5. El usuario tiene **CONTROL ABSOLUTO** sobre qué modo activar

---

## 🔧 CAMBIO REALIZADO

### `src/hooks/useSystemPower.ts`

**ANTES (Wave 63.9):**
```typescript
setPowerState('ONLINE')

// 4. 🔌 WAVE 63.9: Set default control mode when powering on
useControlStore.getState().setGlobalMode('selene')

console.log('[SystemPower] ✅ System ONLINE')
```

**DESPUÉS (Wave 63.99):**
```typescript
setPowerState('ONLINE')

// 4. 🔌 WAVE 63.99: NO auto-select mode - Wait for user input
// globalMode permanece null = "Ready but Idle"
// El usuario debe elegir Manual/Flow/Selene manualmente

console.log('[SystemPower] ✅ System ONLINE (awaiting mode selection)')
```

---

## 🎛️ FLUJO DE UI ESPERADO

### Estado OFF (OFFLINE)
```
┌─────────────────────────────────────────┐
│  🔴 Power Button: ROJO                  │
│  ⬛ Mode Switcher: DESHABILITADO        │
│  ⬛ Vibe Selector: OCULTO               │
│  ⬛ Audio Reactor: APAGADO              │
└─────────────────────────────────────────┘
```

### Click Power → ONLINE
```
┌─────────────────────────────────────────┐
│  🩵 Power Button: CYAN (ONLINE)         │
│  ⬜ Mode Switcher: HABILITADO           │
│     └── Manual: ○  Flow: ○  Selene: ○   │
│         (ninguno iluminado)             │
│  ⬛ Vibe Selector: OCULTO               │
│  🎵 Audio Reactor: ACTIVO               │
└─────────────────────────────────────────┘
```

### Usuario selecciona SELENE
```
┌─────────────────────────────────────────┐
│  🩵 Power Button: CYAN                  │
│  ⬜ Mode Switcher: HABILITADO           │
│     └── Manual: ○  Flow: ○  Selene: ◉   │
│  🎛️ Vibe Selector: VISIBLE              │
│     └── Techno ○  Latino ○  Pop ○ Chill○│
│  🎵 Audio Reactor: ACTIVO               │
└─────────────────────────────────────────┘
```

### Usuario selecciona TECHNO
```
┌─────────────────────────────────────────┐
│  🩵 Power Button: CYAN                  │
│  ⬜ Mode Switcher: Selene ◉             │
│  🎛️ Vibe Selector: Techno ◉            │
│  🎵 Audio Reactor: ACTIVO               │
│  🧠 SELENE BRAIN: RUNNING (Techno)      │
└─────────────────────────────────────────┘
```

---

## 🛡️ VERIFICACIÓN useSeleneVibe.ts

| Aspecto | Estado | Detalle |
|---------|--------|---------|
| `activeVibe` inicial | ✅ `null` | Línea 83: `useState<VibeId \| null>(null)` |
| `isGhostMode` cuando `globalMode=null` | ✅ `true` | `globalMode !== 'selene'` = `null !== 'selene'` = `true` |
| `vibeInfo` cuando `activeVibe=null` | ✅ `null` | `activeVibe ? VIBE_PRESETS[activeVibe] : null` |

**Conclusión:** El hook ya respeta correctamente el estado `null`.

---

## 🧪 TEST MANUAL

1. **Abrir app** → Sistema inicia en OFFLINE
2. **Click Power** → 
   - ✅ Botón pasa a Cyan
   - ✅ Console: `[SystemPower] ✅ System ONLINE (awaiting mode selection)`
   - ✅ Mode Switcher habilitado, pero NINGÚN botón iluminado
   - ✅ Vibe Selector oculto
3. **Click Selene** →
   - ✅ Botón Selene se ilumina
   - ✅ Vibe Selector aparece
4. **Click Techno** →
   - ✅ Techno se ilumina
   - ✅ Console: logs de VibeManager procesando

---

## 🎯 FILOSOFÍA FINAL

```
      ╔══════════════════════════════════════════╗
      ║                                          ║
      ║   ON     → El sistema despierta          ║
      ║            (humming...)                  ║
      ║                                          ║
      ║   SELENE → El cerebro se activa          ║
      ║            (pensando...)                 ║
      ║                                          ║
      ║   TECHNO → La bestia ataca               ║
      ║            (BOOM!)                       ║
      ║                                          ║
      ╚══════════════════════════════════════════╝

         C O N T R O L   A B S O L U T O
```

El DJ/técnico de luces decide **CUÁNDO** y **QUÉ** activar.
LuxSync obedece. No asume.

---

## ✅ WAVE 63.99 COMPLETADA

| Archivo | Cambio |
|---------|--------|
| `useSystemPower.ts` | Eliminado `setGlobalMode('selene')` de `powerOn()` |

**Estado del Sistema:**
- Power ON → `globalMode = null` → "Ready but Idle"
- Usuario elige modo → Sistema responde
- **CONTROL ABSOLUTO RESTAURADO**

---

*Siguiente: WAVE 64 - Testing & Polish*
