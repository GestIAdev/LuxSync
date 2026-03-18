export interface BackupState {
    id?: string;
    timestamp: number;
    data: any;
    checksum?: string;
}
export declare class StateBackupSystem {
    private backups;
    private maxBackups;
    constructor(maxBackups?: number);
    /**
     * Create a backup of current state
     */
    backup(key: string, data: any): void;
    /**
     * Restore last backup
     */
    restore(key: string): any | null;
    /**
     * Restore backup from specific timestamp
     */
    restoreFrom(key: string, timestamp: number): any | null;
    /**
     * Clear all backups for a key
     */
    clear(key: string): void;
    /**
     * Clear all backups
     */
    clearAll(): void;
    /**
     * Get backup count
     */
    getBackupCount(key: string): number;
    /**
     * Create backup (alias for backup)
     */
    createBackup(key: string, data: any): void;
    /**
     * List all backups for a key
     */
    listBackups(key: string): BackupState[];
    /**
     * Restore backup (alias for restore)
     */
    restoreBackup(key: string): any | null;
    /**
     * Clear all backups (alias for clearAll)
     */
    clearAllBackups(): void;
}
//# sourceMappingURL=StateBackupSystem.d.ts.map