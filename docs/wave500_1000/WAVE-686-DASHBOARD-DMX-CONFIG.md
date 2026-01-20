# WAVE 686: DASHBOARD DMX CONFIG MIGRATION

**Fecha:** 2025-01-17  
**Operación:** Dashboard DMX Config Migration  
**Estado:** ✅ COMPLETADO

---

## 📋 PROBLEMA ORIGINAL

Radwulf necesita configurar ArtNet rápidamente para el despliegue de mañana en la discoteca. El problema:

1. **Configuración DMX estaba escondida en SetupView** (pestaña separada)
2. **El dropdown DMX en Dashboard no hacía nada** - solo cambiaba el driver pero sin panel de configuración
3. **AudioReactorRing ocupaba espacio precioso** - bonito pero no útil operacionalmente
4. **Dropdown de Audio se ocultaba detrás del DMX** - z-index incorrecto
5. **Campo Universe se salía del contenedor** - layout roto
6. **Faltaba config USB DMX** - solo tenía ArtNet

**Quote del usuario:**
> "necesito que esta fixture este operativa para mañana y no tengo ganas de tener que estar andando de una pestaña a otra"

---

## 🎯 SOLUCIÓN IMPLEMENTADA

### 1. ARTNET PANEL INLINE EN DASHBOARD

Cuando se selecciona "ArtNet" en el dropdown DMX, aparece un panel compacto de configuración:

```
┌─────────────────────────────────────────────┐
│ 🛰️ SYSTEMS CHECK                            │
├─────────────────────────────────────────────┤
│ 🎵 AUDIO IN   [Simulation ▼]    [█▄█▆▂]    │
├─────────────────────────────────────────────┤
│ 🌐 DMX OUT    [ArtNet ▼]        ● OFFLINE  │
├─────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────┐ │
│ │ IP              Port       Universe     │ │
│ │ [255.255.255.255] [6454]    [1]        │ │
│ │                                         │ │
│ │ [🚀 Start]   📡 0    ⚡ 0.0ms          │ │
│ └─────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
```

### 2. USB DMX PANEL

Cuando se selecciona "USB DMX" aparece un panel compacto con:

```
┌─────────────────────────────────────────────┐
│ COM PORT                            [🔍]    │
│ ☑ Auto-connect                              │
│ [COM3 - FTDI ▼]                             │
└─────────────────────────────────────────────┘
```

### 3. COMPONENTES NUEVOS

- **`ArtNetPanel`**: Config de IP/Port/Universe con botones Start/Stop
- **`UsbDmxPanel`**: Selector de puerto COM con auto-connect toggle

### 4. FIXES DE LAYOUT

- **Z-index fix**: `:has(.dropdown-menu)` aumenta z-index a 100 cuando dropdown está abierto
- **Universe field**: Aumentado de 80px a 90px con `min-width` para evitar overflow
- **Responsive**: `flex-wrap` en panel-row para pantallas pequeñas

---

## 📁 ARCHIVOS MODIFICADOS

### `electron-app/src/components/views/DashboardView/components/SystemsCheck.tsx`

```typescript
// Componentes añadidos:
+ ArtNetPanel
+ UsbDmxPanel

// Render condicional:
{dmxDriver === 'artnet' && <ArtNetPanel />}
{dmxDriver === 'usb-serial' && <UsbDmxPanel />}
```

### `electron-app/src/components/views/DashboardView/components/SystemsCheck.css`

```css
/* Z-index fix para dropdown overlay */
.system-row:has(.dropdown-menu) {
  z-index: 100;
}

/* ArtNet Panel - cyan theme */
.artnet-panel { border-left: 3px solid #00ffff; }

/* USB Panel - orange theme */
.usb-panel { border-left: 3px solid #ffaa00; }

/* Universe field fix */
.artnet-field.small {
  flex: 0 0 90px; /* era 80px */
  min-width: 90px;
}
```

---

## 🔧 FLUJO DE USO

### ArtNet:
1. Dashboard → DMX dropdown → "🌐 ArtNet"
2. Panel aparece → Configura IP/Port/Universe
3. Click "🚀 Start" → ArtNet conecta
4. Stats en tiempo real: Frames enviados, latencia

### USB DMX:
1. Dashboard → DMX dropdown → "🔌 USB DMX"
2. Panel aparece → Auto-scan de puertos
3. Toggle "Auto-connect" → Conecta al mejor dispositivo
4. O selecciona manualmente el puerto

### Virtual:
1. Dashboard → DMX dropdown → "🎮 Virtual"
2. Conecta automáticamente, sin configuración

---

## ⚡ MEJORA DE UX

| Antes | Después |
|-------|---------|
| 3 clicks + cambio de pestaña | 2 clicks in-situ |
| Buscar en SetupView | Todo visible en Dashboard |
| Configuración fragmentada | Centralizado en Mission Control |
| Dropdown se escondía | Z-index dinámico correcto |
| Campo Universe roto | Layout responsive |
| Solo ArtNet config | ArtNet + USB DMX |

---

## 🎨 CÓDIGO CLAVE

### Z-index dinámico (CSS4 `:has()`)
```css
.system-row:has(.dropdown-menu) {
  z-index: 100; /* Boost when dropdown open */
}
```

### ArtNet Panel - Conectar con configuración
```typescript
const handleConnect = async () => {
  const artnetApi = getArtnetApi()
  await artnetApi.configure({ ip, port, universe })
  const result = await artnetApi.start()
}
```

### USB Panel - Auto-connect
```typescript
const handleAutoConnectChange = async (auto: boolean) => {
  if (auto && dmxApi?.autoConnect) {
    await dmxApi.autoConnect()
  }
}
```

---

## 🎪 ESTADO FINAL

✅ ArtNet configurable desde Dashboard  
✅ USB DMX configurable desde Dashboard  
✅ Virtual DMX auto-conecta  
✅ AudioReactorRing removido (espacio liberado)  
✅ Z-index fix - dropdown overlay correcto  
✅ Universe field fix - no se sale del contenedor  
✅ Stats en tiempo real cuando conectado  
✅ Estilos cyberpunk consistentes (cyan/orange themes)  

**La fixture china del canal 50 está lista para la disco de mañana.** 🎉

---

## 🔍 BUGS ARREGLADOS

1. **WAVE 686.1**: Dropdown Audio se escondía → Fixed con `:has(.dropdown-menu)` z-index boost
2. **WAVE 686.2**: Campo Universe desbordado → Fixed con `flex: 0 0 90px` + `min-width`
3. **WAVE 686.3**: Faltaba USB DMX config → Añadido `UsbDmxPanel` con auto-connect
