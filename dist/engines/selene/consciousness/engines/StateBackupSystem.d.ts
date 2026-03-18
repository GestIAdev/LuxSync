/**
 * 🔄 STATE BACKUP SYSTEM - Backup y rollback automático de estado
 * Fase 0: Sistema de respaldo para recuperación de fallos
 *
 * Características: Backup automático, Rollback inteligente, Compresión, Integridad
 * Forged by PunkClaude + Claude 4.5
 */
import { BackupMetadata, RollbackResult } from './MetaEngineInterfaces.js';
export interface BackupConfig {
    backupDir: string;
    maxBackupsPerEngine: number;
    compressionEnabled: boolean;
    autoBackupIntervalMs: number;
    retentionPeriodMs: number;
    name: string;
}
export interface BackupResult {
    success: boolean;
    backupId: string;
    size: number;
    compressionRatio?: number;
    checksum: string;
    error?: Error;
}
/**
 * 🔄 State Backup Manager
 */
export declare class StateBackupManager {
    private config;
    private backupInterval?;
    private engineStates;
    constructor(config: BackupConfig);
    /**
     * 🚀 Start automatic backup system
     */
    startAutoBackup(): void;
    /**
     * 🛑 Stop automatic backup system
     */
    stopAutoBackup(): void;
    /**
     * 💾 Create backup of engine state
     */
    createBackup(engineId: string, state: any, metadata?: Partial<BackupMetadata>): Promise<BackupResult>;
    /**
     * 🔄 Rollback to backup
     */
    rollbackToBackup(backupId: string, targetEngineId?: string): Promise<RollbackResult>;
    /**
     * 📋 List available backups
     */
    listBackups(engineId?: string): Promise<BackupMetadata[]>;
    /**
     * 🗑️ Delete backup
     */
    deleteBackup(backupId: string): Promise<boolean>;
    /**
     * 🧹 Cleanup expired backups
     */
    cleanupExpiredBackups(): Promise<number>;
    /**
     * 🧹 Cleanup resources
     */
    cleanup(): void;
    private ensureBackupDirectory;
    private generateBackupId;
    private getBackupPath;
    private getMetadataPath;
    private mapReplacer;
    private mapReviver;
    private compressData;
    private loadBackup;
    private validateState;
    private performRollback;
    private performAutoBackup;
    private cleanupOldBackups;
}
/**
 * 🏭 State Backup Factory
 */
export declare class StateBackupFactory {
    private static defaultConfig;
    /**
     * 🛠️ Create backup manager with custom config
     */
    static create(config: BackupConfig): StateBackupManager;
    /**
     * ⚡ Create backup manager with defaults
     */
    static createDefault(name: string, backupDir: string): StateBackupManager;
    /**
     * 🔧 Create backup manager for engine
     */
    static createForEngine(engineId: string, backupDir: string): StateBackupManager;
    /**
     * 🌐 Create backup manager for orchestration
     */
    static createForOrchestration(orchestratorId: string, backupDir: string): StateBackupManager;
}
//# sourceMappingURL=StateBackupSystem.d.ts.map