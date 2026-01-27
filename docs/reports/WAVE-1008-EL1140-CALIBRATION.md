# 🔬 WAVE 1008: EL-1140 HARDWARE CALIBRATION LOG

**Fecha**: 2026-01-26
**Fixture**: EL-1140 (Moving Head Chino)
**DMX Address**: 50
**Universe**: 0
**Conexión**: ArtNet ✅

---

## 📊 ESTADO DE CANALES

### Según el JSON actual:
```
Index | Name       | Type       | DMX Address | Status
------|------------|------------|-------------|--------
  0   | Pan        | pan        | 50          | ✅ FUNCIONA
  1   | Tilt       | tilt       | 51          | ❌ NO FUNCIONA
  2   | Pan Fine   | pan_fine   | 52          | ❓ No probado
  3   | Tilt Fine  | tilt_fine  | 53          | ❓ No probado
  4   | Speed      | speed      | 54          | ❓ No probado
  5   | Dimmer     | dimmer     | 55          | ✅ FUNCIONA
  6   | Strobe     | strobe     | 56          | ❓ No probado
  7   | Color Wheel| color_wheel| 57          | ❓ No probado
  8   | Gobo       | gobo       | 58          | ❓ No probado
  9   | Gobo Rot   | gobo_rot   | 59          | ❓ No probado
 10   | Prism      | prism      | 60          | ❓ No probado
 11   | Focus      | focus      | 61          | ❓ No probado
```

---

## 🔍 HIPÓTESIS

### Hipótesis 1: Orden de canales incorrecto
Muchos moving heads chinos usan este orden:
```
CH1: Pan
CH2: Pan Fine   ← No Tilt!
CH3: Tilt
CH4: Tilt Fine
```

**TEST**: Probar CH3 (DMX 52) para ver si es realmente Tilt

### Hipótesis 2: Modo de canal diferente
El fixture puede estar en modo diferente (8ch vs 13ch vs 16ch)
- Verificar display del fixture
- Buscar menú de configuración

### Hipótesis 3: Tilt bloqueado por otro canal
Algunos fixtures requieren:
- Speed > 0 para permitir movimiento
- Un canal de "Control" o "Mode" específico

---

## 🧪 TESTS PENDIENTES

- [ ] Probar CH2 (DMX 51) → ¿Mueve algo?
- [ ] Probar CH3 (DMX 52) → ¿Es el Tilt real?
- [ ] Probar CH4 (DMX 53) → ¿Es Tilt Fine?
- [ ] Verificar modo del fixture en el display
- [ ] Buscar manual PDF del EL-1140

---

## 📝 NOTAS

- Audio reactivity funciona (responde al micro)
- Pan se mueve correctamente con valores 0-255
- Dimmer responde bien
- El problema parece ser de MAPEO, no de conexión

---

## 🎯 PRÓXIMOS PASOS

1. Usar DMX Scanner para identificar qué hace cada canal físicamente
2. Actualizar el JSON con el mapeo correcto
3. Probar Color Wheel para calibrar colores
4. Documentar el mapeo real del EL-1140

