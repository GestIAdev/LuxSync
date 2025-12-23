# 🧠 WAVE 64.5 - AMNESIA (ARRANQUE EN BLANCO)

**Fecha:** 2025-12-22  
**Objetivo:** Nueva sesión = Hoja en blanco. Nadie recuerda el Techno de ayer.

---

## 📊 RESUMEN EJECUTIVO

### Problema Detectado
A pesar de VIBE_IDLE, la persistencia restauraba 'Techno' al arrancar:
- ❌ `main.ts selene:getVibe` devolvía `'techno-club'` como fallback
- ❌ `mind.ts SYSTEM_SLEEP` reseteaba a `'pop-rock'` en lugar de `'idle'`
- ❌ El sistema "recordaba" el vibe de la sesión anterior

### Solución Implementada
- ✅ `selene:getVibe` ahora devuelve `'idle'` siempre al arranque
- ✅ `SYSTEM_SLEEP` resetea a `'idle'` en lugar de `'pop-rock'`
- ✅ Frontend ya inicia con `activeVibe = null` (useState)
- ✅ `controlStore` NO persiste `globalMode` (ya estaba bien)

---

## ❓ CONFIRMACIONES OBLIGATORIAS

### "¿Se ha eliminado la persistencia del Vibe?"

## ✅ **SÍ**

- `controlStore.partialize` NO incluye `globalMode`
- `useSeleneVibe` usa `useState(null)`, no persist
- El backend siempre devuelve `'idle'` al arranque

### "¿Al arrancar, el botón Techno está apagado?"

## ✅ **SÍ**

- `selene:getVibe` → `'idle'`
- `useSeleneVibe` convierte `'idle'` → `null`
- `null` = ningún botón iluminado

---

## 🔧 ARCHIVOS MODIFICADOS

### 1. `electron/main.ts` - Handler selene:getVibe

**ANTES:**
```typescript
ipcMain.handle('selene:getVibe', async () => {
  // ... 
  return { success: true, vibeId: 'techno-club' }  // ❌ SIEMPRE TECHNO
})
```

**DESPUÉS:**
```typescript
ipcMain.handle('selene:getVibe', async () => {
  // 🔌 WAVE 64.5: AMNESIA - Siempre devuelve 'idle' al arranque
  return { success: true, vibeId: 'idle' }  // ✅ SIEMPRE IDLE
})
```

### 2. `src/main/workers/mind.ts` - SYSTEM_SLEEP handler

**ANTES:**
```typescript
case MessageType.SYSTEM_SLEEP:
  // ...
  vibeManager.setActiveVibeImmediate('pop-rock');  // ❌ POP-ROCK
  break;
```

**DESPUÉS:**
```typescript
case MessageType.SYSTEM_SLEEP:
  // ...
  vibeManager.setActiveVibeImmediate('idle');  // ✅ IDLE
  break;
```

---

## 📋 VERIFICACIÓN DE PERSISTENCIA

| Componente | Persiste Vibe? | Estado |
|------------|----------------|--------|
| `controlStore` (globalMode) | ❌ NO (no está en partialize) | ✅ |
| `seleneStore` | ❌ NO tiene campo vibe | ✅ |
| `useSeleneVibe` | ❌ NO (useState local) | ✅ |
| `main.ts getVibe` | ❌ Devuelve 'idle' siempre | ✅ |
| `VibeManager` backend | ❌ DEFAULT_VIBE = 'idle' | ✅ |

---

## 🎯 FLUJO DE ARRANQUE AMNÉSICO

```
┌─────────────────────────────────────────────────────────────────┐
│  1. APP ARRANCA (nuevo proceso Electron)                        │
│     └── VibeManager constructor → DEFAULT_VIBE = 'idle'         │
│     └── controlStore init → globalMode = null                   │
│     └── useSeleneVibe → activeVibe = null                       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  2. FRONTEND HACE getVibe                                       │
│     └── main.ts devuelve { vibeId: 'idle' }                     │
│     └── useSeleneVibe convierte 'idle' → null                   │
│     └── NINGÚN BOTÓN ILUMINADO                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  3. USUARIO HACE POWER ON                                       │
│     └── powerState = 'ONLINE'                                   │
│     └── globalMode = null (NO se cambia)                        │
│     └── Mode Switcher habilitado, ninguno seleccionado          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  4. USUARIO SELECCIONA SELENE                                   │
│     └── globalMode = 'selene'                                   │
│     └── Vibe Selector APARECE                                   │
│     └── activeVibe = null (NINGÚN botón iluminado)              │
│     └── VibeManager tiene VIBE_IDLE → OSCURIDAD                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  5. USUARIO SELECCIONA TECHNO                                   │
│     └── activeVibe = 'techno-club'                              │
│     └── VibeManager → VIBE_TECHNO_CLUB                          │
│     └── 💡 LUZ Y ACCIÓN                                         │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🧪 TEST MANUAL

1. **Cerrar app completamente** (no solo minimizar)
2. **Abrir app de nuevo** →
   - ✅ Mode Switcher: ningún botón iluminado
   - ✅ Power Button: rojo (OFF)
3. **Click Power** →
   - ✅ Power Cyan
   - ✅ Mode Switcher habilitado, **ninguno iluminado**
4. **Click Selene** →
   - ✅ Selene iluminado
   - ✅ Vibe Selector aparece
   - ✅ **Ningún vibe iluminado** (Techno, Latino, Pop, Chill todos apagados)
   - ✅ **Luces APAGADAS** (VIBE_IDLE activo)
5. **Click Techno** →
   - ✅ Techno iluminado
   - ✅ **Luces ENCIENDEN**

---

## 📝 ESTADO DE COMPILACIÓN

| Archivo | Estado |
|---------|--------|
| `main.ts` | ⚠️ Errores pre-existentes (tsconfig) |
| `mind.ts` | ✅ Sin errores |
| `useSeleneVibe.ts` | ✅ Sin errores |
| `controlStore.ts` | ✅ Sin cambios necesarios |

---

## 🎯 FILOSOFÍA FINAL

```
      ╔════════════════════════════════════════════════════════════╗
      ║                                                            ║
      ║   "Nadie recuerda el Techno de ayer"                       ║
      ║                                                            ║
      ║   Nueva sesión = Hoja en blanco                            ║
      ║   El DJ decide desde cero                                  ║
      ║   LuxSync no asume, no recuerda, no impone                 ║
      ║                                                            ║
      ║   ARRANQUE → silencio                                      ║
      ║   SELENE   → espera                                        ║
      ║   VIBE     → acción                                        ║
      ║                                                            ║
      ╚════════════════════════════════════════════════════════════╝

                        A M N E S I A
                    
             Cada show es una experiencia nueva.
```

---

## ✅ WAVE 64.5 COMPLETADA

**La AMNESIA está implementada.**

- El sistema NO recuerda el vibe de sesiones anteriores
- Cada arranque es una hoja en blanco
- El botón Techno (y todos los vibes) están **APAGADOS** al iniciar

**Control absoluto confirmado.** 🧠🔇

---

*Siguiente: WAVE 65 - Testing & Polish*
