/**
 * 🔌 USBDMXDriverAdapter.ts — WAVE: ADAPTADOR HYDRA USB (DEUDA TÉCNICA SALDADA)
 *
 * Implementa la interfaz estricta `IDMXDriver` (idioma del HAL)
 * envolviendo `universalDMX` (idioma de la Hydra: buffers + universos).
 */
import { universalDMX } from './UniversalDMXDriver';
export class USBDMXDriverAdapter {
    get isConnected() {
        return universalDMX.isConnected;
    }
    get state() {
        return this.isConnected ? 'connected' : 'disconnected';
    }
    getStatus() {
        return {
            state: this.state,
            type: 'usb',
            deviceName: this.isConnected ? 'UniversalDMX (USB)' : 'UniversalDMX (disconnected)',
            framesSent: 0,
            lastSendTime: 0,
            errors: 0,
            avgLatency: 0,
        };
    }
    /**
     * UniversalDMX tiene autoConnect en backend; si HAL lo llama, forzamos autoConnect.
     */
    async connect() {
        if (!this.isConnected) {
            await universalDMX.autoConnect();
        }
        return this.isConnected;
    }
    async close() {
        await universalDMX.disconnect();
    }
    /**
     * 🔥 TRADUCTOR OFICIAL: DMXPacket -> Hydra
     */
    send(packet) {
        try {
            universalDMX.setUniverse(packet.channels, packet.universe);
            return true;
        }
        catch {
            return false;
        }
    }
    sendUniverse(universe, data) {
        try {
            universalDMX.setUniverse(data, universe);
            return true;
        }
        catch {
            return false;
        }
    }
    async sendAll() {
        return await universalDMX.sendAll();
    }
    blackout() {
        universalDMX.blackout();
    }
}
