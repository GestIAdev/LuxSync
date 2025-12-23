# 👻 WAVE 64 - IDLE VIBE (ESTADO NEUTRO)

**Fecha:** 2025-12-22  
**Objetivo:** Selene espera órdenes en silencio visual hasta que el usuario elija un Vibe

---

## 📊 RESUMEN EJECUTIVO

### Problema Detectado
Al activar Selene Mode, el sistema saltaba automáticamente a Techno:
- ❌ VibeManager necesitaba un vibe por defecto para funcionar
- ❌ `DEFAULT_VIBE` era `'pop-rock'` (o se usaba el primero disponible)
- ❌ El usuario perdía control sobre el momento de "acción"

### Solución Implementada
- ✅ **Creado** `VIBE_IDLE` - perfil fantasma con oscuridad total
- ✅ **Cambiado** `DEFAULT_VIBE = 'idle'`
- ✅ **Frontend** trata `'idle'` como `null` visual (ningún botón iluminado)

---

## ❓ CONFIRMACIÓN DE FLUJO

### "¿Al dar ON y seleccionar Selene, se activa algún vibe automáticamente?"

## 🔴 **NO**

El flujo correcto ahora es:

```
┌──────────────────────────────────────────────────────────────┐
│  1. POWER ON                                                 │
│     └── Sistema despierta (humming...)                       │
│     └── globalMode = null                                    │
│     └── activeVibe = null                                    │
│     └── 🔇 SILENCIO VISUAL                                   │
└──────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│  2. CLICK SELENE                                             │
│     └── Cerebro se activa (pensando...)                      │
│     └── globalMode = 'selene'                                │
│     └── activeVibe = 'idle' (backend) = null (UI)            │
│     └── 🔇 SILENCIO VISUAL (VibeManager con VIBE_IDLE)       │
│     └── Vibe Selector APARECE pero ninguno iluminado         │
└──────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│  3. CLICK TECHNO                                             │
│     └── La bestia ataca (BOOM!)                              │
│     └── activeVibe = 'techno-club'                           │
│     └── 💡 LUZ Y MOVIMIENTO                                  │
│     └── VibeManager procesa audio con perfil Techno          │
└──────────────────────────────────────────────────────────────┘
```

---

## 🔧 ARCHIVOS CREADOS/MODIFICADOS

### 1. **CREADO** `src/engines/context/presets/IdleProfile.ts`

Perfil fantasma con output cero:

```typescript
export const VIBE_IDLE: VibeProfile = {
  id: 'idle',
  name: 'Idle',
  description: 'Standby mode. Waiting for user input.',
  icon: '👻',
  
  // OSCURIDAD TOTAL
  dimmer: {
    floor: 0.0,     // 🔴 BLACKOUT
    ceiling: 0.0,   // 🔴 BLACKOUT
    allowBlackout: true,
  },
  
  // SIN MOVIMIENTO
  movement: {
    allowedPatterns: ['static'],
    speedRange: { min: 0, max: 0 },
  },
  
  // SIN COLOR
  color: {
    saturation: { min: 0, max: 0 },
  },
  
  // CERO ENERGÍA
  meta: {
    baseEnergy: 0,
    volatility: 0,
  },
};
```

### 2. `src/engines/context/presets/index.ts`

```typescript
// 🔌 WAVE 64: Añadido VIBE_IDLE
import { VIBE_IDLE } from './IdleProfile';

export const VIBE_REGISTRY: Map<VibeId, VibeProfile> = new Map([
  ['idle', VIBE_IDLE],  // ← NUEVO
  ['techno-club', VIBE_TECHNO_CLUB],
  // ... resto
]);

// 🔌 WAVE 64: Ahora arranca en idle
export const DEFAULT_VIBE: VibeId = 'idle';

// 🔌 WAVE 64: isValidVibeId usa VIBE_REGISTRY (incluye idle)
export function isValidVibeId(id: string): id is VibeId {
  return VIBE_REGISTRY.has(id as VibeId);
}
```

### 3. `src/types/VibeProfile.ts`

```typescript
// 🔌 WAVE 64: Añadido 'idle' al tipo
export type VibeId = 'idle' | 'techno-club' | 'fiesta-latina' | 'pop-rock' | 'chill-lounge';
```

### 4. `src/hooks/useSeleneVibe.ts`

```typescript
// 🔌 WAVE 64: 'idle' = null visual (ningún botón iluminado)
const vibeId = result.vibeId === 'idle' ? null : result.vibeId as VibeId
setActiveVibe(vibeId)

// 🔌 WAVE 64: isLoading basado en hasFetched, no en activeVibe
const [hasFetched, setHasFetched] = useState(false)
const isLoading = !hasFetched
```

---

## 🎛️ COMPORTAMIENTO DE UI

### Estado OFF (OFFLINE)
| Componente | Estado |
|------------|--------|
| Power Button | 🔴 Rojo |
| Mode Switcher | ⬛ Deshabilitado |
| Vibe Selector | ⬛ Oculto |
| Audio Reactor | ⬛ Apagado |

### Click Power → ONLINE
| Componente | Estado |
|------------|--------|
| Power Button | 🩵 Cyan |
| Mode Switcher | ⬜ Habilitado, **ninguno iluminado** |
| Vibe Selector | ⬛ Oculto |
| Audio Reactor | 🎵 Activo |

### Click Selene
| Componente | Estado |
|------------|--------|
| Power Button | 🩵 Cyan |
| Mode Switcher | Selene ◉ |
| Vibe Selector | 🎛️ Visible, **ninguno iluminado** |
| Luces | 🔇 **SILENCIO VISUAL** (VIBE_IDLE) |

### Click Techno
| Componente | Estado |
|------------|--------|
| Power Button | 🩵 Cyan |
| Mode Switcher | Selene ◉ |
| Vibe Selector | Techno ◉ |
| Luces | 💡 **ACCIÓN** (VIBE_TECHNO) |

---

## 📝 ESTADO DE COMPILACIÓN

| Archivo | Estado |
|---------|--------|
| `IdleProfile.ts` | ✅ Sin errores |
| `presets/index.ts` | ✅ Sin errores |
| `VibeProfile.ts` | ✅ Sin errores |
| `useSeleneVibe.ts` | ✅ Sin errores |

---

## 🧪 TEST MANUAL

1. **Abrir app** → Sistema en OFFLINE
2. **Click Power** → 
   - ✅ ONLINE
   - ✅ Mode Switcher habilitado, ninguno iluminado
3. **Click Selene** →
   - ✅ Selene se ilumina
   - ✅ Vibe Selector aparece
   - ✅ **NINGÚN vibe iluminado**
   - ✅ **Luces APAGADAS** (VIBE_IDLE activo)
4. **Click Techno** →
   - ✅ Techno se ilumina
   - ✅ **Luces ENCIENDEN**
   - ✅ Console: `[VibeManager] Transitioning: idle → techno-club`

---

## 🎯 FILOSOFÍA FINAL

```
      ╔══════════════════════════════════════════════════════════════╗
      ║                                                              ║
      ║   "La cabezonería de la electrónica ha sido domada"          ║
      ║                                                              ║
      ║   Selene ya no asume. Selene ESPERA.                         ║
      ║                                                              ║
      ║   ON     → El sistema despierta      (humming...)            ║
      ║   SELENE → El cerebro se activa      (pensando...)           ║
      ║   VIBE   → La bestia ataca           (BOOM!)                 ║
      ║                                                              ║
      ╚══════════════════════════════════════════════════════════════╝

                    C O N T R O L   A B S O L U T O
                         
            El DJ/técnico decide. LuxSync obedece.
```

---

## ✅ WAVE 64 COMPLETADA

**El IDLE VIBE está implementado.**

- Power ON → Sistema despierta pero no hace nada
- Selene Mode → Cerebro activo pero en standby (idle)
- Click Vibe → **AHORA** las luces responden

**Control absoluto restaurado.** 🎛️

---

*Siguiente: WAVE 65 - Testing & Polish*
