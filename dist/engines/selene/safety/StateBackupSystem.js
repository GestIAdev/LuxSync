// 💾 STATE BACKUP SYSTEM - Stub for LuxSync
// Simplified version for fixture state backup
export class StateBackupSystem {
    backups = new Map();
    maxBackups = 10;
    constructor(maxBackups) {
        if (maxBackups !== undefined) {
            this.maxBackups = maxBackups;
        }
    }
    /**
     * Create a backup of current state
     */
    backup(key, data) {
        const backup = {
            id: `backup_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            timestamp: Date.now(),
            data: JSON.parse(JSON.stringify(data)), // Deep clone
        };
        if (!this.backups.has(key)) {
            this.backups.set(key, []);
        }
        const backupList = this.backups.get(key);
        backupList.push(backup);
        // Keep only last N backups
        if (backupList.length > this.maxBackups) {
            backupList.shift();
        }
    }
    /**
     * Restore last backup
     */
    restore(key) {
        const backupList = this.backups.get(key);
        if (!backupList || backupList.length === 0) {
            return null;
        }
        const lastBackup = backupList[backupList.length - 1];
        return JSON.parse(JSON.stringify(lastBackup.data)); // Deep clone
    }
    /**
     * Restore backup from specific timestamp
     */
    restoreFrom(key, timestamp) {
        const backupList = this.backups.get(key);
        if (!backupList)
            return null;
        // Find closest backup before or at timestamp
        const backup = backupList
            .filter(b => b.timestamp <= timestamp)
            .sort((a, b) => b.timestamp - a.timestamp)[0];
        return backup ? JSON.parse(JSON.stringify(backup.data)) : null;
    }
    /**
     * Clear all backups for a key
     */
    clear(key) {
        this.backups.delete(key);
    }
    /**
     * Clear all backups
     */
    clearAll() {
        this.backups.clear();
    }
    /**
     * Get backup count
     */
    getBackupCount(key) {
        return this.backups.get(key)?.length || 0;
    }
    /**
     * Create backup (alias for backup)
     */
    createBackup(key, data) {
        this.backup(key, data);
    }
    /**
     * List all backups for a key
     */
    listBackups(key) {
        return this.backups.get(key) || [];
    }
    /**
     * Restore backup (alias for restore)
     */
    restoreBackup(key) {
        return this.restore(key);
    }
    /**
     * Clear all backups (alias for clearAll)
     */
    clearAllBackups() {
        this.clearAll();
    }
}
//# sourceMappingURL=StateBackupSystem.js.map