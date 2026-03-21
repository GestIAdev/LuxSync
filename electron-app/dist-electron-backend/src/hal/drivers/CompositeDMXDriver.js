/**
 * 🔥 WAVE 2100: COMPOSITE DMX DRIVER — DUAL OUTPUT (USB + ArtNet)
 * ============================================================================
 *
 * El HAL solo soportaba UN driver. Este composite los fusiona:
 * → USB (UniversalDMX via Phantom Worker) para hardware serial
 * → ArtNet (UDP) para interfaces de red
 *
 * Ambos reciben los MISMOS packets DMX en paralelo.
 * isConnected = true si CUALQUIERA de los dos está conectado.
 *
 * ARQUITECTURA:
 * ┌─────────────────────────────────────────────┐
 * │         CompositeDMXDriver                   │
 * │  implements IDMXDriver                       │
 * │                                              │
 * │  ┌──────────────┐   ┌───────────────────┐   │
 * │  │ USBDMXDriver  │   │ ArtNetDriverAdapt │   │
 * │  │ (serial/FTDI) │   │ (UDP/Art-Net)     │   │
 * │  └──────────────┘   └───────────────────┘   │
 * │       ↑ send()            ↑ send()          │
 * │       └────────┬──────────┘                  │
 * │            send(packet) ← HAL               │
 * └─────────────────────────────────────────────┘
 *
 * @layer HAL
 * @pattern COMPOSITE
 */
export class CompositeDMXDriver {
    constructor(...drivers) {
        this.drivers = drivers.filter(Boolean);
    }
    // ═══════════════════════════════════════════════════════════════════════
    // LIFECYCLE
    // ═══════════════════════════════════════════════════════════════════════
    async connect() {
        const results = await Promise.allSettled(this.drivers.map(d => d.connect()));
        // Éxito si AL MENOS uno conecta
        return results.some(r => r.status === 'fulfilled' && r.value === true);
    }
    async close() {
        await Promise.allSettled(this.drivers.map(d => d.close()));
    }
    // ═══════════════════════════════════════════════════════════════════════
    // DATA TRANSMISSION — Fan-out a todos los drivers activos
    // ═══════════════════════════════════════════════════════════════════════
    send(packet) {
        let sent = false;
        for (const driver of this.drivers) {
            if (driver.isConnected) {
                const ok = driver.send(packet);
                if (ok)
                    sent = true;
            }
        }
        return sent;
    }
    sendUniverse(universe, data) {
        let sent = false;
        for (const driver of this.drivers) {
            if (driver.isConnected) {
                const ok = driver.sendUniverse(universe, data);
                if (ok)
                    sent = true;
            }
        }
        return sent;
    }
    async sendAll() {
        const results = await Promise.allSettled(this.drivers
            .filter(d => d.isConnected && d.sendAll)
            .map(d => d.sendAll()));
        return results.some(r => r.status === 'fulfilled' && r.value === true);
    }
    blackout() {
        for (const driver of this.drivers) {
            if (driver.isConnected) {
                driver.blackout();
            }
        }
    }
    // ═══════════════════════════════════════════════════════════════════════
    // STATUS — Conectado si CUALQUIERA está conectado
    // ═══════════════════════════════════════════════════════════════════════
    get isConnected() {
        return this.drivers.some(d => d.isConnected);
    }
    get state() {
        if (this.drivers.some(d => d.state === 'connected'))
            return 'connected';
        if (this.drivers.some(d => d.state === 'connecting'))
            return 'connecting';
        if (this.drivers.some(d => d.state === 'reconnecting'))
            return 'reconnecting';
        if (this.drivers.some(d => d.state === 'error'))
            return 'error';
        return 'disconnected';
    }
    getStatus() {
        // Priorizar el driver que esté conectado
        const active = this.drivers.find(d => d.isConnected);
        if (active)
            return active.getStatus();
        // Si ninguno conectado, devolver el status del primero
        if (this.drivers.length > 0)
            return this.drivers[0].getStatus();
        return {
            state: 'disconnected',
            type: 'usb',
            deviceName: 'Composite (no drivers)',
            framesSent: 0,
            lastSendTime: 0,
            errors: 0,
            avgLatency: 0,
        };
    }
}
