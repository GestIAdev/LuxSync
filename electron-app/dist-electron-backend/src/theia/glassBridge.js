/**
 * 🌊 WAVE 8215 — GLASS BRIDGE RELAY (page-world side)
 *
 * Puente `window.postMessage` entre el preload (isolated world) y el mundo
 * de página. `contextBridge` NO puede transportar `MessagePort` — los
 * puertos cruzan la frontera de mundos únicamente como objetos
 * transferibles en `window.postMessage(msg, '*', [port])`.
 *
 * Contrato (espejado en `electron/preload.ts`):
 *
 *   página  ──{ __luxTheiaReq: 'video-port' | 'telemetry-port' }──▶ preload
 *           pull: solicita un port kind. Una vez pedido, TODOS los links
 *           futuros de ese kind se auto-entregan (re-link safe).
 *
 *   preload ──{ __luxTheia: 'video-port',      role } + [port]───▶ página
 *   preload ──{ __luxTheia: 'telemetry-port'         } + [port]───▶ página
 *   preload ──{ __luxTheia: 'video-unlink'           }──────────▶ página
 *           (notify de lifecycle — la ventana de salida murió)
 *
 * ZERO-ALLOC: el relay no toca payloads — solo mueve el puntero del port.
 * Los `ArrayBuffer` de 8.3MB (Modo A) ping-ponguean por el port con
 * ownership transfer renderer↔renderer. En Modo B (256B) la pierna
 * main→renderer sale por clone —`MessagePortMain` no transfiere buffers
 * (WAVE 8216)— y el ack de vuelta SÍ transfiere (DOM MessagePort).
 */
/** Key del mensaje preload→página. */
const GLASS_MSG_KEY = '__luxTheia';
/** Key del mensaje página→preload (pull request). */
const GLASS_REQ_KEY = '__luxTheiaReq';
/**
 * Pull request: pide al preload la entrega del port `kind`. Si el link ya
 * existía (port buffered), llega en el siguiente tick de la event loop; si
 * aún no existe, queda armada la entrega automática para cuando el main
 * brokeree el `MessageChannelMain`. Idempotente — llamar en cada mount.
 */
export function requestTheiaPort(kind) {
    window.postMessage({ [GLASS_REQ_KEY]: kind }, '*');
}
/**
 * Suscribe un handler a los mensajes Glass Bridge del preload. Devuelve el
 * unsubscribe. Filtra por `ev.source === window` y por la key del protocolo
 * — el resto del tráfico `window.postMessage` de la app pasa de largo.
 */
export function onTheiaGlassMessage(handler) {
    const listener = (ev) => {
        if (ev.source !== window)
            return;
        const data = ev.data;
        const kind = data?.[GLASS_MSG_KEY];
        if (kind !== 'video-port' && kind !== 'telemetry-port' && kind !== 'video-unlink') {
            return;
        }
        handler({ kind, role: data?.role, port: ev.ports?.[0] ?? null });
    };
    window.addEventListener('message', listener);
    return () => window.removeEventListener('message', listener);
}
