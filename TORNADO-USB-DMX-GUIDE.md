# 🌪️ TORNADO USB DMX - GUÍA COMPLETA

## 📋 Tabla de Contenidos
1. [Hardware Specs](#hardware-specs)
2. [Mapeo de Canales DMX](#mapeo-de-canales-dmx)
3. [Cómo Conectar](#cómo-conectar)
4. [Configuración de PARs](#configuración-de-pars)
5. [Uso en LuxSync](#uso-en-luxsync)
6. [Troubleshooting](#troubleshooting)
7. [Specs Técnicas](#specs-técnicas)

---

## 🔌 Hardware Specs

### Tornado USB DMX Interface
```
┌─────────────────────────────────┐
│  TORNADO USB DMX INTERFACE      │
│                                 │
│  LEDs:  [AUX][USB][DMX][OUT1][OUT2] │
│                                 │
│  USB ────┐                      │
│          │  XLR OUT1 ○          │
│          └─ XLR OUT2 ○          │
└─────────────────────────────────┘
```

**Características:**
- **2× XLR Outputs** (3-pin, macho)
- **1× USB Input** (USB 2.0, Type A/B)
- **5× LEDs indicadores:**
  - 🟢 **AUX** - Alimentación auxiliar
  - 🟢 **USB** - Conexión USB activa
  - 🟢 **DMX** - Protocolo DMX transmitiendo
  - 🟢 **OUT1** - Universo 1 transmitiendo
  - 🟢 **OUT2** - Universo 2 transmitiendo

**Protocolo:** DMX512 estándar
**Universos:** 2 (512 canales cada uno)
**Chipset:** FTDI FT232R (USB-Serial)
**Compatible:** Windows, Linux, macOS

---

## 🎨 Mapeo de Canales DMX

### Configuración Actual: 8 PAR RGB (3 canales)

```
┌─────────────────────────────────────────────────────────┐
│ UNIVERSO 1 (OUT1) - 512 Canales                        │
├─────────────────────────────────────────────────────────┤
│ PAR 1:  Ch 1-3    [R][G][B]                           │
│ PAR 2:  Ch 4-6    [R][G][B]                           │
│ PAR 3:  Ch 7-9    [R][G][B]                           │
│ PAR 4:  Ch 10-12  [R][G][B]                           │
│ PAR 5:  Ch 13-15  [R][G][B]                           │
│ PAR 6:  Ch 16-18  [R][G][B]                           │
│ PAR 7:  Ch 19-21  [R][G][B]                           │
│ PAR 8:  Ch 22-24  [R][G][B]                           │
│                                                         │
│ Ch 25-512: Disponibles para más fixtures               │
└─────────────────────────────────────────────────────────┘
```

### Tabla de Mapeo Detallada

| Fixture | DMX Start | Ch 1 (R) | Ch 2 (G) | Ch 3 (B) | Nota Musical | Color Base |
|---------|-----------|----------|----------|----------|--------------|------------|
| PAR 1   | 1         | 1        | 2        | 3        | DO           | 🔴 Rojo    |
| PAR 2   | 4         | 4        | 5        | 6        | DO           | 🔴 Rojo    |
| PAR 3   | 7         | 7        | 8        | 9        | RE           | 🟠 Naranja |
| PAR 4   | 10        | 10       | 11       | 12       | RE           | 🟠 Naranja |
| PAR 5   | 13        | 13       | 14       | 15       | SOL          | 🔵 Cyan    |
| PAR 6   | 16        | 16       | 17       | 18       | SOL          | 🔵 Cyan    |
| PAR 7   | 19        | 19       | 20       | 21       | LA           | 💙 Azul    |
| PAR 8   | 22        | 22       | 23       | 24       | LA           | 💙 Azul    |

---

## 🔗 Cómo Conectar

### Paso 1: Conexión Física

```
┌──────────┐  USB Cable  ┌───────────┐  XLR-3  ┌────────┐
│ Laptop   │─────────────│  Tornado  │─────────│ PAR 1  │
│ Windows  │             │    USB    │    │    └────────┘
└──────────┘             └───────────┘    │    ┌────────┐
                                          └─────│ PAR 2  │
                                           │    └────────┘
                                           │    ┌────────┐
                                           └─────│ PAR 3  │
                                                └────────┘
                                                   ...
                                                ┌────────┐
                                                │ PAR 8  │
                                                └────────┘
```

**Cable XLR:** 3-pin macho → 3-pin hembra (estándar DMX512)

### Paso 2: Daisy Chain (Cadena)

```
Tornado OUT1 → PAR 1 (IN) → PAR 1 (OUT) → PAR 2 (IN) → PAR 2 (OUT) → ...
```

**Notas importantes:**
- ⚠️ **Último fixture** debe tener **terminador DMX** (120Ω)
- ⚠️ **Máximo 32 fixtures** en una cadena (estándar DMX)
- ⚠️ **Cable máximo**: 300-500 metros total

---

## 🎛️ Configuración de PARs

### En cada PAR fixture:

1. **Modo DMX:** Actívalo en el menú del PAR
2. **Address (Dirección):** Configura según la tabla:

```
PAR 1 → Address: 001  (empieza en canal 1)
PAR 2 → Address: 004  (empieza en canal 4)
PAR 3 → Address: 007  (empieza en canal 7)
PAR 4 → Address: 010  (empieza en canal 10)
PAR 5 → Address: 013  (empieza en canal 13)
PAR 6 → Address: 016  (empieza en canal 16)
PAR 7 → Address: 019  (empieza en canal 19)
PAR 8 → Address: 022  (empieza en canal 22)
```

3. **Modo de Canales:** Selecciona **3CH** o **RGB**
4. **Personality:** Si tiene opciones, elige **RGB Basic**

### Ejemplo: Chauvet DJ SlimPAR 56

```
Menu → DMX Address → 001 (para PAR 1)
Menu → DMX Mode → 3CH RGB
Menu → Personality → RGB
```

---

## 🎮 Uso en LuxSync

### Método 1: Desde la Demo UI

1. **Abre la demo** en Chrome/Edge:
   ```bash
   cd demo
   npm run dev
   ```

2. **Clic en botón** "🔌 USB DMX (Tornado)"

3. **Selecciona dispositivo** en el diálogo USB:
   ```
   ┌─────────────────────────────┐
   │ FTDI USB Serial Converter   │ ← Selecciona
   │ (Tornado USB DMX)           │
   └─────────────────────────────┘
   ```

4. **Verifica LEDs** en el Tornado:
   - 🟢 USB = ON
   - 🟢 DMX = ON
   - 🟢 OUT1 = ON

5. **Elige modo de audio:**
   - 🎤 **Micrófono** (si tienes buen audio)
   - 🎵 **Audio Simulator** (para testing sin música)

6. **Clic "▶️ Start Demo"**

7. **¡Disfruta!** 🎉

### Método 2: Desde Código

```javascript
import { TornadoUSBDriver } from './drivers/TornadoUSBDriver.js';

// Crear driver
const tornado = new TornadoUSBDriver(30); // 30 FPS

// Inicializar (pide permiso USB)
await tornado.initialize();

// Usar en bridge
const bridge = new SeleneLightBridge(
  audioAdapter,
  seleneCore,
  tornado  // ← Tornado en lugar de SimulatorDriver
);

await bridge.start();
```

---

## 🛠️ Troubleshooting

### Problema 1: "No device selected"

**Causa:** No se seleccionó dispositivo en el diálogo USB

**Solución:**
1. Verifica que el Tornado esté conectado
2. Intenta con otro puerto USB
3. Reinicia el navegador (Chrome/Edge)

---

### Problema 2: "Web USB API not supported"

**Causa:** Navegador no compatible

**Solución:**
- ✅ Usa **Chrome** (recomendado)
- ✅ Usa **Edge** (recomendado)
- ❌ **NO uses Firefox** (no soporta Web USB)
- ❌ **NO uses Safari** (no soporta Web USB)

---

### Problema 3: LEDs no se encienden

**Causa:** Driver FTDI no instalado

**Solución:**
1. Descarga driver FTDI: https://ftdichip.com/drivers/vcp-drivers/
2. Instala para Windows
3. Reinicia laptop
4. Reconecta Tornado

---

### Problema 4: Luces no responden

**Verificaciones:**
- ✅ **Address correcto** en cada PAR (001, 004, 007...)
- ✅ **Modo DMX** activado (no Stand-alone)
- ✅ **Canales**: 3CH RGB seleccionado
- ✅ **Cable XLR**: Bien conectado (no al revés)
- ✅ **Terminador**: 120Ω en último PAR de la cadena

**Test rápido:**
```javascript
// En consola del navegador:
window.app.testPattern();
```

Deberías ver:
- PAR 1-2: Rojo
- PAR 3-4: Verde
- PAR 5-6: Azul
- PAR 7-8: Blanco

---

### Problema 5: FPS bajo (<20)

**Causa:** Demasiados fixtures o latencia USB

**Solución:**
```javascript
tornado.setFPS(23); // Baja a 23 FPS (estándar DMX)
```

O en código:
```javascript
const tornado = new TornadoUSBDriver(23); // ← 23 en lugar de 30
```

---

## 📊 Specs Técnicas

### DMX512 Protocol

```
Frame Structure:
┌──────┬────────────────────────────────────┐
│ BYTE │ CONTENT                            │
├──────┼────────────────────────────────────┤
│ 0    │ 0x00 (START CODE / BREAK)         │
│ 1    │ Channel 1 (0-255)                  │
│ 2    │ Channel 2 (0-255)                  │
│ ...  │ ...                                │
│ 512  │ Channel 512 (0-255)                │
└──────┴────────────────────────────────────┘

Total: 513 bytes per frame
```

### Timing
- **FPS estándar:** 23-44 Hz
- **LuxSync default:** 30 Hz
- **Frame time:** ~33ms @ 30 FPS

### USB Configuration
- **Vendor ID:** 0x0403 (FTDI)
- **Product ID:** 0x6001 (FT232R)
- **Interface:** 0
- **Endpoint:** OUT (bulk transfer)
- **Transfer type:** Bulk
- **Max packet:** 64 bytes

### Power
- **USB powered:** 5V, ~100mA
- **XLR phantom:** NO (DMX no tiene phantom power)

---

## 🎯 Frequency Routing (Audio → Fixtures)

LuxSync mapea frecuencias de audio a fixtures:

```
┌─────────────────────────────────────────────────┐
│ FREQUENCY ZONE    │ FIXTURES │ COLOR  │ NOTE   │
├───────────────────┼──────────┼────────┼────────┤
│ 20-250 Hz (Bass)  │ 1-2      │ 🔴 Red │ DO     │
│ 250-800 Hz (Low)  │ 3-4      │ 🟠 Org │ RE     │
│ 800-2k Hz (Mid)   │ 5-6      │ 🔵 Cya │ SOL    │
│ 2k-20k Hz (Tre)   │ 7-8      │ 💙 Blu │ LA     │
└───────────────────┴──────────┴────────┴────────┘
```

**Ejemplo con música:**
- 🎸 **Guitarra bass** (50-100Hz) → PARs 1-2 ROJO
- 🎹 **Piano mid** (500-2kHz) → PARs 5-6 CYAN
- 🥁 **Hi-hat** (8-12kHz) → PARs 7-8 AZUL
- 🎤 **Voz** (300-3kHz) → PARs 3-4 NARANJA + 5-6 CYAN

---

## 📝 Notas para Moving Heads (Próxima Sesión)

Cuando integres moving heads, el mapeo cambiará:

```
┌─────────────────────────────────────────────────┐
│ MOVING HEAD CHANNELS (Típico)                   │
├─────────────────────────────────────────────────┤
│ Ch 1:  Pan (8-bit)                              │
│ Ch 2:  Pan Fine (16-bit LSB)                    │
│ Ch 3:  Tilt (8-bit)                             │
│ Ch 4:  Tilt Fine (16-bit LSB)                   │
│ Ch 5:  Pan/Tilt Speed                           │
│ Ch 6:  Dimmer                                   │
│ Ch 7:  Strobe                                   │
│ Ch 8:  Red                                      │
│ Ch 9:  Green                                    │
│ Ch 10: Blue                                     │
│ Ch 11: White                                    │
│ Ch 12: Color Wheel                              │
│ Ch 13: Gobo Wheel                               │
│ Ch 14: Gobo Rotation                            │
│ Ch 15: Prism                                    │
│ Ch 16: Focus                                    │
│ Ch 17: Frost/Beam                               │
│ Ch 18: Control/Reset                            │
└─────────────────────────────────────────────────┘

Total: ~18-25 canales por moving head
```

**Para 4 moving heads:**
- Moving 1: Ch 25-42  (18 ch)
- Moving 2: Ch 43-60  (18 ch)
- Moving 3: Ch 61-78  (18 ch)
- Moving 4: Ch 79-96  (18 ch)

**Total usado:** 96 canales (8 PARs + 4 Moving heads)
**Disponibles:** 416 canales más en Universo 1

---

## 🎁 Para el Casero

Este sistema le permite:
- ✅ **8 PARs RGB** funcionando con audio
- ✅ **Efectos visuales** (Chase, Wave, Strobe, Pulse, Sparkle)
- ✅ **Modo simulador** (testing sin música)
- ✅ **Modo USB DMX** (producción real)
- 🔜 **Moving heads** (próxima sesión)

**Reemplazo completo de FreeStyler** con mejor UI y audio reactivo inteligente.

---

## 📧 Soporte

**Documentación completa:** `HARDWARE-INFO-NEEDED.md`
**Código fuente:** `src/engines/selene/luxsync/drivers/TornadoUSBDriver.ts`
**Demo:** `demo/app.js`

**Creado con 💖 para el casero que se ha portado super bien**

---

## 🚀 Quick Reference Card

```
┌────────────────────────────────────────────┐
│ TORNADO USB DMX - QUICK START              │
├────────────────────────────────────────────┤
│ 1. Conectar Tornado USB a laptop          │
│ 2. Conectar XLR OUT1 a primer PAR         │
│ 3. Daisy chain: PAR1 → PAR2 → ... → PAR8 │
│ 4. Configurar addresses: 001, 004, 007... │
│ 5. Abrir Chrome/Edge: npm run dev         │
│ 6. Clic "USB DMX" → Seleccionar FTDI      │
│ 7. Clic "Audio Simulator" o "Microphone"  │
│ 8. Clic "Start Demo"                       │
│ 9. ¡DISFRUTAR! 🎉                          │
└────────────────────────────────────────────┘
```

**FPS:** 30 (ajustable 23-44)
**Latencia:** ~33ms
**Protocolo:** DMX512 estándar
**Compatible:** Windows 10/11, Chrome/Edge

---

**Última actualización:** 2025-11-20  
**Versión:** 1.0.0  
**Status:** ✅ LISTO PARA PRODUCCIÓN
