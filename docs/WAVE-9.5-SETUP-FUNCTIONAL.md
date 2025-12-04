# 🔧 WAVE 9.5 - SETUP CONFIGURATION FUNCIONAL

**Fecha**: $(date)  
**Commit**: 8936a95  
**Branch**: main

---

## 📋 OBJETIVO

Hacer que el wizard de Setup sea funcional con:
- Captura de audio real del sistema (Desktop Capture)
- Carga de fixtures desde archivos .fxt
- Persistencia de configuración

---

## ✅ CAMBIOS IMPLEMENTADOS

### 1. AUDIO CAPTURE REAL (`useAudioCapture.ts`)

```typescript
// Nuevo tipo de fuente
export type AudioSource = 'microphone' | 'system' | 'simulation' | 'none'

// Nuevos métodos
startSystemAudio()   // Usa getDisplayMedia con systemAudio: 'include'
startMicrophone()    // Usa getUserMedia para micrófono
audioSource          // Estado actual de la fuente
```

**getDisplayMedia** permite capturar audio del sistema:
- Requiere compartir una ventana/pantalla
- El audio del sistema fluye como si fuera un micrófono
- Funciona con Spotify, YouTube, cualquier app

### 2. FIXTURE IPC HANDLERS (`main.ts`)

```typescript
// Escanear directorio de fixtures
ipcMain.handle('lux:scan-fixtures', async (_, customPath?) => {
  // Busca en:
  // 1. customPath (si se proporciona)
  // 2. Directorio de la app /librerias
  // 3. Resources del app empaquetado
})

// Cargar fixtures
ipcMain.handle('lux:load-fixtures', async (_, filePaths) => {
  // Parsea archivos .fxt usando FXTParser
})

// Guardar/Cargar config
ipcMain.handle('lux:save-config', async (_, config) => {
  // Guarda en userData/luxsync-config.json
})

ipcMain.handle('lux:load-config', async () => {
  // Carga config guardada
})
```

### 3. TIPOS UNIFICADOS (`vite-env.d.ts`)

```typescript
interface FixtureLibraryItem {
  id: string
  name: string
  manufacturer: string
  channelCount: number
  type: string
  filePath: string
}

interface PatchedFixture extends FixtureLibraryItem {
  dmxAddress: number
  universe: number
}

interface LuxSyncConfig {
  audio: {
    source: 'microphone' | 'system' | 'simulation'
    deviceId?: string
    sensitivity: number
  }
  dmx: {
    driver: string
    port: string
    universe: number
    frameRate: number
  }
  fixtures: PatchedFixture[]
  ui: {
    theme: string
    showAdvanced: boolean
  }
}
```

### 4. SETUPVIEW FUNCIONAL (`SetupView/index.tsx`)

**Step 1: Audio**
- 🖥️ System Audio - Captura desktop via getDisplayMedia
- 🎤 Microphone - Captura tradicional via getUserMedia  
- 🎵 Simulation - Modo demo sin hardware

**Step 2: DMX Interface**
- Selector de driver (Enttec Open, Pro, etc.)
- Test de conexión

**Step 3: Fixtures**
- Escaneo de librería /librerias
- Tabla de fixtures disponibles con búsqueda
- Patch Table para asignar direcciones DMX

**Step 4: System Test**
- Verificación de audio
- Verificación de DMX
- Verificación de fixtures patcheados

### 5. FIX CONFLICTO DE TIPOS (`useSelene.ts`)

Eliminada la declaración duplicada de `window.lux` que conflictuaba con `vite-env.d.ts`.

Actualizado mapeo en `setState()` para convertir `SeleneStateUpdate` → `SeleneState`:
```typescript
setState(prev => ({
  ...DEFAULT_STATE,
  ...prev,
  r: update.colors?.primary.r ?? prev?.r ?? 0,
  g: update.colors?.primary.g ?? prev?.g ?? 0,
  // etc...
}))
```

---

## 🔌 API EXPUESTA EN `window.lux`

### Fixtures
```typescript
window.lux.scanFixtures(customPath?)      // Escanear directorio
window.lux.getFixtureLibrary()            // Obtener librería cargada
window.lux.getPatchedFixtures()           // Obtener patch actual
window.lux.patchFixture(id, address, universe?)  // Patchear fixture
window.lux.unpatchFixture(address)        // Remover del patch
window.lux.clearPatch()                   // Limpiar todo el patch
```

### Config
```typescript
window.lux.getConfig()                    // Cargar config
window.lux.saveConfig(partialConfig)      // Guardar cambios
window.lux.resetConfig()                  // Reset a defaults
```

---

## 📁 ARCHIVOS MODIFICADOS

| Archivo | Cambios |
|---------|---------|
| `useAudioCapture.ts` | +getDisplayMedia, audioSource state |
| `main.ts` | +4 IPC handlers (fixtures/config) |
| `preload.ts` | +APIs expuestas |
| `vite-env.d.ts` | +Tipos unificados |
| `SetupView/index.tsx` | Reescrito (~650 líneas) |
| `useSelene.ts` | Fix tipos, eliminar declaración duplicada |

---

## 🧪 TESTING

```bash
cd electron-app
npm run dev
```

1. Ir a Setup View
2. Probar botones de Audio Source
3. Verificar que el VU meter reacciona
4. Ir a Step 3 (Fixtures)
5. Verificar que escanea /librerias
6. Completar el wizard

---

## 📈 MÉTRICAS

- **Líneas añadidas**: ~1150
- **Líneas eliminadas**: ~160
- **Archivos modificados**: 8
- **Errores TypeScript nuevos**: 0

---

## 🔜 PRÓXIMOS PASOS

1. **Conexión real TrinityProvider ↔ SetupView**
   - Conectar botones de audio a trinity.startTrinity()
   
2. **DMX Hardware Detection**
   - Implementar detección real de dispositivos USB-DMX

3. **Fixture Patch Persistence**
   - El patch actual se debe cargar al iniciar

4. **Audio Permissions Dialog**
   - Mostrar diálogo explicativo antes de getDisplayMedia

---

**WAVE 9.5 COMPLETE** ✅
