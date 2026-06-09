# ⚡ WAVE-6018: GLASS BRIDGE RESURRECTION

> *"El Espejo Fluido ha vuelto. 44Hz. Cero pérdidas."*

---

## 🩸 SÍNTOMAS INICIALES

- La UI se actualizaba a **1Hz** en lugar de **44Hz**.
- `GlassCanvas` no registraba ni un solo frame.
- El backend (`TickEngine`) empujaba datos a `BufferPoolManager` correctamente.
- `useSeleneTruth` recibía `selene:truth` a ~7Hz (canal IPC legacy), confirmando que el proceso main estaba vivo.

---

## 🔍 CADENA DEL BUG

### EMPALME 1: El Origen (Main Process) — LIMPIO

`electron/main.ts` enviaba el `MessagePort` tras `did-finish-load`:

```typescript
mainWindow.webContents.on('did-finish-load', () => {
  const { port1, port2 } = new MessageChannelMain()
  glassPoolManager.attach(port1)
  mainWindow.webContents.postMessage('glass:port', null, [port2])
})
```

**Veredicto:** El puerto se enviaba correctamente y en el momento adecuado.

---

### EMPALME 2: El Puente (Preload) — LIMPIO

`electron/glassPreload.ts` recibía el puerto, lo iniciaba con `port.start()`, y exponía `window.glass` vía `contextBridge`.

**Veredicto:** El puerto llegaba, se iniciaba, y la API era accesible.

---

### EMPALME 3: El Destino (GlassCanvas.tsx) — **FUGA CONFIRMADA**

El componente `GlassCanvas` usaba un `useRef` mutable (`isSubscribedRef`) para evitar doble-subscripción. **El cleanup del `useEffect` nunca reseteaba este flag**:

```typescript
// ❌ BUG: El flag quedaba 'true' para siempre tras el primer unmount
return () => {
  if (unsubscribe) unsubscribe()
  window.removeEventListener('glass:ready', connect)
  cancelAnimationFrame(rafId.current)
  // FALTABA: isSubscribedRef.current = false
}
```

### ¿Por qué explotó ahora?

React **StrictMode** (y hot-reloads de Vite en desarrollo) provocan un ciclo de montaje/desmontaje/remontaje en el arranque:

1. **Primer montaje:** `GlassCanvas` monta → `isSubscribedRef.current = true` → suscripción activa. Todo funciona.
2. **React remonta** (StrictMode unmount + remount).
3. **Cleanup del primer efecto:** `unsubscribe()` borra el listener del preload. `isSubscribedRef` sigue en `true`.
4. **Segundo montaje:** `connect()` ejecuta → `if (isSubscribedRef.current) return` → **silencio absoluto**.

**Resultado:** `listeners= 0` en el preload. El backend envía frames al vacío.

---

## 🛠️ EL FIX

**Archivo:** `src/components/GlassCanvas.tsx`

```typescript
return () => {
  if (unsubscribe) unsubscribe()
  window.removeEventListener('glass:ready', connect)
  cancelAnimationFrame(rafId.current)
  // ✅ CRÍTICO: Permitir re-suscripción tras remounts de React
  isSubscribedRef.current = false
}
```

**Líneas modificadas:** 133-138

---

## 🧪 VALIDACIÓN

Logs del renderer post-fix:

```
[GlassCanvas] Frame #1   bass=0.00 len=32768
[GlassCanvas] Frame #2   bass=0.00 len=32768
...
[GlassCanvas] Frame #44  bass=0.00 len=32768
[GlassCanvas] Frame #88  bass=0.00 len=32768
[GlassCanvas] Frame #132 bass=0.00 len=32768
```

**El Espejo Fluido respira a 44Hz.** La UI reacciona en tiempo real. Los movers bailan al compás. La fisura del Aether ha sido sellada.

---

## 📁 ARCHIVOS TOCADOS

| Archivo | Cambio |
|---------|--------|
| `src/components/GlassCanvas.tsx` | Reset de `isSubscribedRef.current = false` en cleanup |
| `electron/glassPreload.ts` | Emite `CustomEvent('glass:ready')` al recibir el puerto (resiliencia) |
| `src/AppCommander.tsx` | Renderiza `<GlassCanvas />` en el árbol React |

---

## 🏛️ LECCIÓN ARQUITECTÓNICA

> **Un `useRef` mutable es un estado invisible.** Si representa un estado de suscripción, su lifecycle debe estar **acoplado al lifecycle del efecto** que lo modifica. Nunca asumas que un componente React solo se monta una vez.

---

*Resuelto por el Equipo de Ingeniería Core — WAVE-6018*
*"Lo que no se limpia, se rompe."*
