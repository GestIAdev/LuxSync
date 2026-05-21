# Manual KeyForge para Operadores

Versión: 1.0
Fecha: 2026-05-20
Producto: LuxSync

---

## 1. Qué es KeyForge

KeyForge es la cabina de control por teclado de LuxSync.
No es un atajo suelto: es un sistema por capas, con mapeos, perfiles y acciones en vivo.

En la práctica, te permite:
- Disparar efectos, cues y vibras sin tocar el mouse.
- Seleccionar grupos de fixtures al vuelo.
- Controlar movimiento pan/tilt con capa cinética.
- Guardar y cargar perfiles de teclado para distintos shows.

---

## 2. Antes de empezar

Para usar KeyForge sin sustos:
- Abre la pestaña KEYFORGE desde la barra principal.
- Activa el botón Master Arm en estado ARMED.
- Si queda en SAFE, KeyForge no intercepta teclas.

Punto clave:
- Al reiniciar la app, Master Arm vuelve a SAFE por seguridad.

---

## 3. Encendido rápido en 60 segundos

1. Ve a KEYFORGE.
2. Cambia de SAFE a ARMED.
3. Prueba teclas base:
   - Espacio: blackout
   - 1 a 9: selección de grupos
   - 0: seleccionar todo
   - F: strobe en hold
4. Si quieres remapear:
   - Activa LEARN
   - Elige acción (desde tecla ya mapeada o paleta derecha)
   - Pulsa la tecla física destino

---

## 4. Cómo crear un grupo (paso a paso)

Esta era la parte crítica: un grupo NO se crea desde KeyForge.
Se crea en BUILD (Stage Constructor).

### Método visual (recomendado)

1. Abre BUILD.
2. Selecciona fixtures en el stage.
3. Ve al panel Groups.
4. Clic en Create from Selection.
5. Escribe nombre o deja automático.
6. Confirma Create.

Resultado:
- El grupo queda guardado en el show.
- Ya lo puedes llamar con acciones de selección de grupo.

### Método teclado (rápido)

En BUILD:
- Selecciona fixtures.
- Presiona Ctrl+G (o Cmd+G en macOS).

Si no hay selección, no crea grupo.

### Gestión del grupo

Desde el mismo panel Groups:
- Doble clic para renombrar.
- Botón de teclado para asignar hotkey 1-9.
- Botón papelera para borrar.

---

## 5. Relación entre grupos y teclas 1-9

Por defecto, KeyForge trae acciones sel-group-1 a sel-group-9 en la capa base.

Y además, en capa CMD:
- Ctrl+1 a Ctrl+9 (Cmd+1..9 en macOS) asigna la selección actual al grupo N.
- Si el grupo N no existe, se crea.
- Si ya existe, se reemplaza su contenido con la selección actual.

Importante para evitar confusión:
- La selección de grupos usa primero `hotkey` del grupo (si existe) y, como fallback, el índice en la lista.
- Los grupos no se guardan dentro del teclado ni del perfil `.kf.json`.
- Los grupos viven en el show cargado (`showFile.groups`).

Resumen mental correcto:
- Perfil KeyForge (`.kf.json`) = qué tecla dispara qué acción.
- Show (`.lux` / show activo) = qué fixtures contiene cada grupo.

Recomendación operativa:
- Mantén orden claro de grupos.
- Nombres directos: FRONT PAR, MOVERS STAGE LEFT, BLINDERS, etc.

---

## 5.1 Dónde se guardan tus grupos (respuesta corta)

Si creas o reasignas grupos con Ctrl+N:
- Se actualiza el Stage Store (en memoria) en `groups`.
- Se marca el show como dirty.
- LuxSync persiste el show con autosave (debounce ~2s) y/o al guardar show.

No verás esos grupos como "teclas pintadas" en BASE, porque BASE solo muestra bindings.
Lo que cambió es el contenido de los grupos del show, no el mapa de teclas.

Para verlo visualmente:
- Ve a LIVE > Sidebar > GROUPS.
- Verás los grupos de usuario y su badge numérico cuando tengan hotkey.

---

## 5.2 Flujo recomendado para tu caso (movers/front/etc.)

1. En LIVE, selecciona fixtures (por ejemplo movers).
2. Pulsa Ctrl+1 para guardar esa selección en Grupo 1.
3. Selecciona otro bloque (por ejemplo front).
4. Pulsa Ctrl+2 para guardar en Grupo 2.
5. Abre GROUPS y renombra los grupos (MOVERS, FRONT, etc.).
6. Guarda el show.
7. Si además quieres reutilizar atajos en otro show, exporta KeyForge.

Regla de oro:
- Si quieres conservar "quién está en cada grupo", guarda show.
- Si quieres conservar "qué hace cada tecla", exporta KeyForge.

---

## 6. Capas de KeyForge

KeyForge usa capas activas. La misma tecla puede hacer cosas distintas según capa.

Capas disponibles:
- BASE
- ALT
- CMD
- SELECT
- KINETIC
- FORGE

Prioridad interna de capas:
- FORGE manda sobre todas.
- Luego KINETIC, SELECT, CMD, ALT, BASE.

Activación típica:
- ALT: mantener Alt.
- CMD: mantener Control o Meta.
- SELECT: mantener S y otra tecla.
- KINETIC: mantener K + Shift.
- FORGE: modo Learn/Forge activado.

---

## 7. Modo LEARN (remapeo)

### Forma A: aprender desde una acción existente

1. Activa LEARN.
2. Clic en una tecla que ya tenga acción.
3. Queda armada la acción.
4. Pulsa la nueva tecla física.

### Forma B: aprender desde paleta de acciones (columna derecha)

1. Busca una acción en Action Palette.
2. Pulsa Learn en esa acción.
3. Pulsa tecla física destino.

### Desmapear una tecla

- En LEARN, clic derecho sobre la tecla para quitar binding.

### Drag and drop

- Arrastra acción desde la paleta y suéltala sobre una tecla.
- Reemplaza binding de forma directa.

Notas:
- Teclas modificadoras puras (Shift, Ctrl, Alt, Meta) no se usan como acciones directas.
- Si hay colisión de mapeo, KeyForge avisa y rechaza.

---

## 8. Botones clave del header de KeyForge

En la cabecera del panel:
- EXPORT: guarda perfil en archivo .kf.json.
- IMPORT: carga perfil desde .kf.json.
- RESET: vuelve al estadio por defecto.
- ARMED/SAFE: habilita o bloquea el control por teclado.
- LEARN: activa/desactiva modo aprendizaje.
- CLR LAYER: limpia solo la capa visible.

---

## 9. Perfil por defecto (stadium-default)

Cuando no hay bindings previos, LuxSync carga un perfil base automáticamente.

Incluye, entre otros:
- Espacio: blackout.
- 1-9: selección de grupos.
- 0: seleccionar todo.
- F: strobe hold.
- Flechas y PageUp/PageDown: transporte de cues.
- F2/F3/F4: navegación UI (Build/Live/Chronos).
- Capa kinetic para pan/tilt en WASD.
- Chords especiales como 1+F y 2+F con scope por grupo.

---

## 10. Exportar e importar perfiles

### Exportar

1. Pulsa EXPORT.
2. Escribe nombre de perfil.
3. Elige destino y guarda.
4. Se crea un .kf.json.

### Importar

1. Pulsa IMPORT.
2. Selecciona archivo .kf.json válido.
3. El perfil reemplaza bindings y chords actuales.

Consejo de operación:
- Crea un perfil por show o por venue.
- Haz backup de perfiles en carpeta de proyecto.

---

## 11. Flujo recomendado para montar show desde cero

1. En BUILD, patch de fixtures.
2. Crea grupos operativos (frente, movers, blinder, backline, etc.).
3. Verifica selección de grupos con 1-9.
4. En KEYFORGE, ajusta bindings de efectos que usarás en vivo.
5. Prueba transporte de cues.
6. Exporta perfil final del show.

---

## 12. Errores típicos y solución

### No responde ninguna tecla en KeyForge

Causa probable:
- Master Arm en SAFE.

Solución:
- Cambiar a ARMED.

### Aprendo una tecla y parece no disparar

Causas probables:
- Quedó en FORGE/LEARN y no salió.
- Acción asignada no está cableada para ese contexto.

Solución:
- Salir de LEARN.
- Probar acción conocida (ejemplo cue-next o sel-group-1).

### Teclas no entran porque estoy escribiendo en un input

Comportamiento esperado:
- KeyForge no secuestra escritura en campos editables.

### 1-9 no selecciona lo que espero

Causas probables:
- Orden de grupos distinto al que imaginabas.
- Grupo vacío o mal armado.

Solución:
- Revisa panel Groups en BUILD.
- Reordena/renombra lógica de grupos.

### Perdí configuración de teclado

Prevención:
- Exportar perfiles regularmente.
- Mantener copia de seguridad por show.

---

## 13. Buenas prácticas para clientes

- Define una convención de nombres de grupo antes del ensayo.
- Reserva teclas de pánico (blackout/kill) y no las remapees sin motivo.
- Evita sobrecargar una sola capa: separa Base para operación y Alt para color/effect.
- Documenta perfil por artista con fecha y versión.
- Exporta perfil después de cada sesión importante.

---

## 14. Mini chuleta de operación

Arranque:
- Alt+7 para ir a KEYFORGE
- SAFE a ARMED

Selección:
- 1-9 grupos
- 0 todo

Urgencias:
- Espacio blackout

Edición:
- LEARN ON
- Elegir acción
- Pulsar tecla destino
- LEARN OFF

Persistencia:
- EXPORT para guardar
- IMPORT para recuperar

---

## 15. Cierre

KeyForge te da velocidad real en vivo cuando el setup de grupos está limpio.
Si el show está bien agrupado en BUILD, KeyForge se vuelve un instrumento, no una lotería.

Para operación profesional:
- Ordena grupos primero.
- Mapea segundo.
- Exporta tercero.

Con ese ciclo, quedas listo para ensayo, show y gira con consistencia.
