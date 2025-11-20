# 🎪 HARDWARE INFO NEEDED - Moving Heads & Fixtures

## 📋 **PARA INVESTIGAR EN EL TRABAJO**

Este documento te guía para recopilar **TODA** la info técnica que necesito sobre los equipos de tu casero. Llévalo impreso o en el móvil y ve rellenando durante los ratos libres.

---

## 🎯 **OBJETIVO:**

Integrar **moving heads** (cabezas móviles) y otros fixtures avanzados en LuxSync, para que Selene controle:
- ✅ Movimiento Pan/Tilt (X/Y)
- ✅ Gobo rotation (patrones giratorios)
- ✅ Focus (haz concentrado/difuso)
- ✅ Prism effects
- ✅ Color wheels
- ✅ Shutter/strobe speed
- ✅ Y todo lo que tengan!

---

## 🔍 **INFORMACIÓN A RECOPILAR:**

### 1. **INVENTARIO DE EQUIPOS** 📦

Haz una lista de **TODOS** los fixtures que tienen:

```
EJEMPLO:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Fixture 1:
- Marca/Modelo: Chauvet Intimidator Spot 355
- Tipo: Moving Head Spot
- Cantidad: 4 unidades
- DMX Channels: 14 canales (modo extendido)
- Manual: ¿Tienen el manual físico o PDF?
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Fixture 2:
- Marca/Modelo: _________________________
- Tipo: (PAR, Moving Head, Wash, Beam, etc.)
- Cantidad: ___ unidades
- DMX Channels: ___ canales
- Manual: Sí / No
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Fixture 3:
- Marca/Modelo: _________________________
- Tipo: _________________________________
- Cantidad: ___ unidades
- DMX Channels: ___ canales
- Manual: Sí / No
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

(Añade todas las que tengan...)
```

---

### 2. **ESPECIFICACIONES DMX** 🎛️

Para **cada tipo de fixture**, necesito saber:

#### **A) Número de canales DMX:**
```
¿Cuántos canales usa? (ej: 8, 14, 16, 24...)
¿Tiene modos diferentes? (ej: Basic 8ch, Extended 16ch)
```

#### **B) Mapa de canales (CRÍTICO):**

Necesito saber **qué controla cada canal**. Ejemplo:

```
EJEMPLO: Chauvet Intimidator Spot 355 (14 canales)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Canal 1:  Pan (movimiento horizontal) → 0-255
Canal 2:  Pan Fine (precisión) → 0-255
Canal 3:  Tilt (movimiento vertical) → 0-255
Canal 4:  Tilt Fine (precisión) → 0-255
Canal 5:  Pan/Tilt Speed → 0-255 (0=rápido, 255=lento)
Canal 6:  Dimmer → 0-255
Canal 7:  Shutter/Strobe → 0-10=closed, 11-255=strobe speed
Canal 8:  Color Wheel → 0-9=white, 10-19=red, 20-29=yellow...
Canal 9:  Gobo Wheel → 0-9=open, 10-19=gobo 1, 20-29=gobo 2...
Canal 10: Gobo Rotation → 0-60=stop, 61-150=slow→fast CW, 151-255=fast→slow CCW
Canal 11: Prism → 0-10=out, 11-255=in
Canal 12: Prism Rotation → Similar a Gobo Rotation
Canal 13: Focus → 0-255 (0=near, 255=far)
Canal 14: Control/Reset → Funciones especiales
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**TU TAREA:** Busca el **manual del fixture** o en **FreeStyler** (tiene los perfiles de fixtures). Anota el mapa de canales de cada uno.

---

### 3. **CAPABILITIES (Capacidades)** 🎨

Para cada fixture, marca qué puede hacer:

```
EJEMPLO:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Fixture: Chauvet Intimidator Spot 355

✅ Pan (0-540°)
✅ Tilt (0-270°)
✅ Dimmer (0-100%)
✅ Shutter/Strobe
✅ Color Wheel (8 colores fijos)
❌ Color Mixing RGB (no tiene RGB, solo wheel)
✅ Gobo Wheel (7 gobos + open)
✅ Gobo Rotation
✅ Prism (3-facet)
✅ Prism Rotation
✅ Focus
❌ Zoom (no tiene zoom)
❌ Frost (no tiene frost)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**Lista completa de posibles capabilities:**
- [ ] Pan (movimiento horizontal)
- [ ] Tilt (movimiento vertical)
- [ ] Dimmer (intensidad)
- [ ] Shutter/Strobe (parpadeo)
- [ ] Color Wheel (rueda de colores fijos)
- [ ] Color Mixing RGB (mezcla de colores)
- [ ] Gobo Wheel (patrones estáticos)
- [ ] Gobo Rotation (rotación de patrones)
- [ ] Prism (prisma)
- [ ] Prism Rotation (rotación de prisma)
- [ ] Focus (enfoque)
- [ ] Zoom (ampliar/reducir haz)
- [ ] Frost (difusor)
- [ ] Iris (apertura)
- [ ] CMY Mixing (color sustractivo)
- [ ] CTO (corrección de temperatura)

---

### 4. **RANGOS DE MOVIMIENTO** 📐

Para moving heads, necesito:

```
Pan Range: ___° (ej: 540°, 630°)
Tilt Range: ___° (ej: 270°, 360°)
Pan Speed: ___ segundos para 360° (ej: 2.5s)
Tilt Speed: ___ segundos para 360° (ej: 1.8s)
```

---

### 5. **MODOS DE OPERACIÓN** ⚙️

```
¿Tiene modo standalone (sin DMX)?  Sí / No
¿Tiene modo master/slave?          Sí / No
¿Tiene modo sound-active?          Sí / No
¿Soporta RDM (Remote Device Mgmt)? Sí / No
```

---

### 6. **CONFIGURACIÓN ACTUAL EN FREESTYLER** 🖥️

Si ya están configurados en FreeStyler:

```
1. Abre FreeStyler
2. Ve a "Setup" → "Patch Fixtures"
3. Anota:
   - Universe: ___ (ej: Universe 1, Universe 2...)
   - Start Address: ___ (ej: DMX 1, DMX 17, DMX 33...)
   - Fixture Profile usado: _________________________
4. Haz screenshot de la pantalla de patch
```

---

### 7. **FOTOS DEL EQUIPO** 📸

Saca fotos de:
- ✅ Los fixtures (frente y atrás)
- ✅ Panel trasero (donde se ven los switches DMX address)
- ✅ Display LCD (si tiene menú, foto del menú mostrando settings)
- ✅ Etiqueta con modelo/serial number

---

### 8. **PREGUNTAS CLAVE PARA TU CASERO** 🎤

```
1. ¿Cuántos universos DMX usan?
   □ 1 universo (512 canales)
   □ 2 universos (1024 canales)
   □ Más: ___ universos

2. ¿Qué interface DMX tienen?
   □ Art-Net (Ethernet/WiFi)
   □ sACN (E1.31)
   □ USB-DMX (Enttec, etc.)
   □ Otro: ___________________

3. ¿Qué marca/modelo es el interface?
   Marca: _____________________
   Modelo: ____________________

4. ¿Los moving heads son todos iguales o hay diferentes modelos?
   □ Todos iguales (8x mismo modelo)
   □ Mezclados (especificar cuántos de cada)

5. ¿Qué efectos usan MÁS en los shows?
   □ Movimiento sincronizado (todos juntos)
   □ Chase/secuencias (uno tras otro)
   □ Simetría (mitad espejo de la otra)
   □ Random/caos
   □ Círculos/figuras geométricas

6. ¿Qué NO le gusta de FreeStyler?
   (Esto es ORO para saber qué mejorar)
   ___________________________________________
   ___________________________________________
```

---

### 9. **MANUALES Y RECURSOS** 📚

Busca y descarga:
- ✅ Manual del fabricante (PDF)
- ✅ Fixture profile de FreeStyler (archivo .fix o .fixture)
- ✅ Videos de YouTube mostrando el fixture en acción

**Dónde buscar:**
- Sitio web del fabricante (ej: chauvetdj.com, adj.com)
- FreeStyler forum (tienen biblioteca de fixtures)
- Google: "[Modelo fixture] DMX channel map"

---

## 🎯 **TEMPLATE DE FIXTURE COMPLETO:**

Copia este template para cada fixture:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FIXTURE INFO SHEET
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

IDENTIFICACIÓN:
- Marca: _________________________________
- Modelo: ________________________________
- Tipo: (Moving Head Spot/Wash/Beam/PAR/etc.)
- Cantidad total: ___ unidades
- Precio aprox: $_______ (si lo sabes)

ESPECIFICACIONES DMX:
- Modos disponibles: ______________________
- Canales en modo usado: ____ canales
- DMX addresses actuales: ________________

MAPA DE CANALES (anota TODOS):
Canal 1:  _____________ → Rango: _______
Canal 2:  _____________ → Rango: _______
Canal 3:  _____________ → Rango: _______
Canal 4:  _____________ → Rango: _______
Canal 5:  _____________ → Rango: _______
Canal 6:  _____________ → Rango: _______
Canal 7:  _____________ → Rango: _______
Canal 8:  _____________ → Rango: _______
(continúa si tiene más...)

CAPABILITIES (marca con ✅):
[ ] Pan             [ ] Tilt
[ ] Dimmer          [ ] Strobe
[ ] Color Wheel     [ ] RGB Mixing
[ ] Gobo Wheel      [ ] Gobo Rotation
[ ] Prism           [ ] Focus
[ ] Zoom            [ ] Frost
[ ] Otros: _______________________________

RANGOS:
- Pan: ___° (ej: 540°)
- Tilt: ___° (ej: 270°)
- Pan Speed: ___ s/360°
- Tilt Speed: ___ s/360°

RECURSOS:
- Manual: [ ] Sí  [ ] No  URL: __________
- Fixture Profile: [ ] Sí  [ ] No
- Videos: _________________________________

NOTAS ADICIONALES:
___________________________________________
___________________________________________
___________________________________________
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## 🚀 **FIXTURES COMUNES EN DJ/DISCOTECAS:**

Aquí están los fixtures más comunes para que sepas qué buscar:

### **Moving Heads Populares:**
- **Chauvet Intimidator Spot/Wash** (8-16 canales)
- **ADJ Inno Spot/Beam/Wash** (12-16 canales)
- **Martin MAC Aura/Viper** (profesional, 18+ canales)
- **Elation Design Spot/Wash** (16-24 canales)

### **PAR LED (básicos):**
- **Chauvet SlimPAR** (4-7 canales: RGB + Dimmer + Strobe)
- **ADJ Mega Par Profile** (7 canales)
- **American DJ Flat Par** (3-7 canales)

### **Wash/Beam:**
- **Chauvet Q-Wash** (7-13 canales)
- **ADJ Focus Spot** (8-11 canales)

---

## 📸 **EJEMPLO DE FOTOS ÚTILES:**

```
FOTO 1: Panel trasero
┌─────────────────────────────────┐
│  [POWER] [DMX IN] [DMX OUT]     │
│                                  │
│  DMX Address: [↑] [↓]           │
│  Display: 001                    │
│                                  │
│  Model: Intimidator Spot 355    │
│  Serial: ABC123456789            │
└─────────────────────────────────┘

FOTO 2: Menú LCD
┌─────────────────────────────────┐
│  Mode: 14Ch Extended             │
│  Address: 001                    │
│  Pan: 540°                       │
│  Tilt: 270°                      │
└─────────────────────────────────┘
```

---

## ✅ **CHECKLIST FINAL:**

Antes de volver, verifica que tienes:

- [ ] Lista de TODOS los fixtures (marca/modelo)
- [ ] Cantidad de cada tipo
- [ ] Mapa de canales DMX de cada uno
- [ ] Capabilities de cada uno
- [ ] Fotos de los equipos (frente/atrás/panel)
- [ ] Interface DMX (Art-Net/sACN/USB)
- [ ] Manuales PDF o links
- [ ] Respuestas a las 6 preguntas clave
- [ ] Direcciones DMX actuales
- [ ] Screenshots de FreeStyler (si aplica)

---

## 💡 **TIPS PARA INVESTIGAR:**

### **En FreeStyler:**
1. Abre FreeStyler
2. Setup → Patch Fixtures
3. Busca el fixture en la lista
4. Click derecho → "Properties" o "Edit"
5. Ahí verás el channel map completo
6. Haz screenshot

### **En Google:**
```
Busca:
- "[Modelo] DMX channel map"
- "[Modelo] user manual PDF"
- "[Modelo] fixture profile"
```

### **En YouTube:**
```
Busca:
- "[Modelo] DMX programming"
- "[Modelo] tutorial"
- "[Modelo] setup guide"
```

### **En el Panel del Fixture:**
1. Presiona MENU
2. Busca "DMX Settings" o "Channel Mode"
3. Anota el modo actual (8ch, 14ch, 16ch, etc.)
4. Busca "DMX Address" y anótala

---

## 🎯 **PRIORIDADES:**

Si tienes poco tiempo, enfócate en:

**CRÍTICO (no puedo avanzar sin esto):**
1. ✅ Marca/Modelo exacto de los moving heads
2. ✅ Número de canales DMX que usan
3. ✅ Manual PDF o link

**MUY IMPORTANTE:**
4. ✅ Mapa de canales (qué hace cada canal)
5. ✅ Capabilities (Pan, Tilt, Gobo, etc.)
6. ✅ Interface DMX (Art-Net, sACN, USB)

**ÚTIL (pero no bloqueante):**
7. ⚠️ Rangos de movimiento
8. ⚠️ Speeds
9. ⚠️ Fotos
10. ⚠️ Configuración actual

---

## 📝 **ESPACIO PARA NOTAS:**

```
Día 1 (Trabajo):
___________________________________________
___________________________________________
___________________________________________

Día 2 (Trabajo):
___________________________________________
___________________________________________
___________________________________________

Día 3 (Trabajo):
___________________________________________
___________________________________________
___________________________________________

Día 4 (Trabajo):
___________________________________________
___________________________________________
___________________________________________
```

---

## 🚀 **CUANDO VUELVAS CON LA INFO:**

Mándame:
1. Este documento rellenado
2. Fotos de los equipos
3. Manuales PDF (si los conseguiste)
4. Screenshots de FreeStyler

Y yo te armo:
- ✅ Fixture profiles para LuxSync
- ✅ Control inteligente de moving heads
- ✅ Mapeo audio → movimiento
- ✅ Efectos coordinados Pan/Tilt
- ✅ Gobo rotations síncronas
- ✅ Lo que sea que tengan! 🎪

---

## 💰 **RECORDATORIO:**

Este software no es solo para pagarle a tu casero.  
Es para que él **venda** LuxSync a sus compañeros DJ.  
**FreeStyler es de los 90. LuxSync es del 2025.** 🚀

Con IA Selene, moving heads inteligentes, y efectos que NINGÚN software tiene.

**¡Vamos a revolucionar el mercado!** 💪

---

**Cualquier duda, anótala aquí y me preguntas cuando vuelvas:**

```
PREGUNTAS PENDIENTES:
1. _______________________________________
2. _______________________________________
3. _______________________________________
```

---

**¡ÉXITO EN EL TRABAJO!** 🎉

*Recuerda: No te estreses. Lo importante es marca/modelo/canales DMX. Con eso ya puedo empezar. Lo demás lo vamos afinando.* 😊
