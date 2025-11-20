// 🎯 PM2 CLUSTER MANAGER - ORCHESTRATOR
// By PunkClaude & RaulVisionario - October 11, 2025
// "Control the swarm, achieve consensus, survive Byzantine"

import pm2 from 'pm2';
import { promisify } from 'util';


export interface PM2NodeInfo {
    pm_id: number;
    name: string;
    pid: number;
    status: string;
    cpu: number;
    memory: number;
    uptime: number;
    restarts: number;
}

export interface PM2ClusterStatus {
    totalNodes: number;
    runningNodes: number;
    stoppedNodes: number;
    nodes: PM2NodeInfo[];
    loadBalancer: PM2NodeInfo | null;
    consensusAchieved: boolean;
    byzantineTolerance: number;
}

/**
 * 🎯 PM2 CLUSTER MANAGER
 * 
 * Responsibilities:
 * - Start/stop PM2 cluster (3 Selene nodes + 1 load balancer)
 * - Health monitoring of all nodes
 * - Dynamic kill/restart for Byzantine fault testing
 * - Consensus validation across nodes
 * - Memory/CPU tracking per node
 * - Emergency shutdown procedures
 */
export class PM2ClusterManager {
    private pm2Connected: boolean = false;

    constructor() {
        // No auto-connect, call connect() manually
    }

    /**
     * Connect to PM2 daemon
     */
    public async connect(): Promise<void> {
        if (this.pm2Connected) {
            console.log('⚠️ Already connected to PM2');
            return;
        }

        return new Promise((resolve, reject) => {
            pm2.connect((err) => {
                if (err) {
                    console.error('❌ Failed to connect to PM2:', err);
                    reject(err);
                    return;
                }

                console.log('✅ Connected to PM2 daemon');
                this.pm2Connected = true;
                resolve();
            });
        });
    }

    /**
     * Disconnect from PM2 daemon
     */
    public async disconnect(): Promise<void> {
        if (!this.pm2Connected) {
            console.log('⚠️ Not connected to PM2');
            return;
        }

        pm2.disconnect();
        this.pm2Connected = false;
        console.log('✅ Disconnected from PM2');
    }

    /**
     * Start entire cluster (3 nodes + load balancer)
     */
    public async startCluster(ecosystemPath: string): Promise<void> {
        if (!this.pm2Connected) {
            throw new Error('Not connected to PM2. Call connect() first.');
        }

        console.log('🚀 Starting PM2 cluster from ecosystem file...');
        console.log(`📄 Ecosystem path: ${ecosystemPath}`);

        return new Promise((resolve, reject) => {
            pm2.start(ecosystemPath, (err, apps) => {
                if (err) {
                    console.error('❌ Failed to start cluster:', err);
                    reject(err);
                    return;
                }

                const processCount = Array.isArray(apps) ? apps.length : 1;
                console.log(`✅ Cluster started: ${processCount} processes`);
                resolve();
            });
        });
    }

    /**
     * Stop entire cluster
     */
    public async stopCluster(): Promise<void> {
        if (!this.pm2Connected) {
            throw new Error('Not connected to PM2. Call connect() first.');
        }

        console.log('🛑 Stopping entire PM2 cluster...');

        const processes = await this.listProcesses();
        const clusterProcesses = processes.filter(p => 
            p.name.startsWith('selene-') || p.name === 'load-balancer'
        );

        for (const proc of clusterProcesses) {
            await this.stopProcess(proc.name);
        }

        console.log('✅ Cluster stopped');
    }

    /**
     * List all PM2 processes
     */
    public async listProcesses(): Promise<PM2NodeInfo[]> {
        if (!this.pm2Connected) {
            throw new Error('Not connected to PM2. Call connect() first.');
        }

        return new Promise((resolve, reject) => {
            pm2.list((err, list) => {
                if (err) {
                    console.error('❌ Failed to list processes:', err);
                    reject(err);
                    return;
                }

                const processes: PM2NodeInfo[] = list.map(proc => ({
                    pm_id: proc.pm_id || 0,
                    name: proc.name || 'unknown',
                    pid: proc.pid || 0,
                    status: proc.pm2_env?.status || 'unknown',
                    cpu: proc.monit?.cpu || 0,
                    memory: proc.monit?.memory || 0,
                    uptime: proc.pm2_env?.pm_uptime ? Date.now() - proc.pm2_env.pm_uptime : 0,
                    restarts: proc.pm2_env?.restart_time || 0
                }));

                resolve(processes);
            });
        });
    }

    /**
     * Get cluster status (nodes + load balancer + consensus)
     */
    public async getClusterStatus(): Promise<PM2ClusterStatus> {
        const processes = await this.listProcesses();

        const seleneNodes = processes.filter(p => p.name.startsWith('selene-node-'));
        const loadBalancer = processes.find(p => p.name === 'load-balancer') || null;

        const runningNodes = seleneNodes.filter(n => n.status === 'online').length;
        const stoppedNodes = seleneNodes.filter(n => n.status !== 'online').length;

        // Byzantine Fault Tolerance: Can tolerate (N-1)/3 faults for N nodes
        // For 3 nodes: (3-1)/3 = 0.66 → can tolerate 0 faults (need all 3)
        // Actually for BFT: N = 3f + 1, so 3 = 3(0) + 1 → f=0 (need 3 for consensus)
        // Better formula: For N nodes, need (N+1)/2 for simple majority
        // For BFT: need 2f+1 out of 3f+1 → for 3 nodes, need 2 online
        const byzantineTolerance = Math.floor((seleneNodes.length - 1) / 3); // 0 for 3 nodes
        const consensusAchieved = runningNodes >= Math.ceil((seleneNodes.length + 1) / 2); // Need majority

        return {
            totalNodes: seleneNodes.length,
            runningNodes,
            stoppedNodes,
            nodes: seleneNodes,
            loadBalancer,
            consensusAchieved,
            byzantineTolerance
        };
    }

    /**
     * Stop a specific process by name
     */
    public async stopProcess(name: string): Promise<void> {
        if (!this.pm2Connected) {
            throw new Error('Not connected to PM2. Call connect() first.');
        }

        console.log(`🛑 Stopping process: ${name}`);

        return new Promise((resolve, reject) => {
            pm2.stop(name, (err) => {
                if (err) {
                    console.error(`❌ Failed to stop ${name}:`, err);
                    reject(err);
                    return;
                }

                console.log(`✅ Process ${name} stopped`);
                resolve();
            });
        });
    }

    /**
     * Restart a specific process by name
     */
    public async restartProcess(name: string): Promise<void> {
        if (!this.pm2Connected) {
            throw new Error('Not connected to PM2. Call connect() first.');
        }

        console.log(`🔄 Restarting process: ${name}`);

        return new Promise((resolve, reject) => {
            pm2.restart(name, (err) => {
                if (err) {
                    console.error(`❌ Failed to restart ${name}:`, err);
                    reject(err);
                    return;
                }

                console.log(`✅ Process ${name} restarted`);
                resolve();
            });
        });
    }

    /**
     * Kill a specific process by name (for Byzantine testing)
     */
    public async killProcess(name: string): Promise<void> {
        if (!this.pm2Connected) {
            throw new Error('Not connected to PM2. Call connect() first.');
        }

        console.log(`💀 Killing process (Byzantine test): ${name}`);

        return new Promise((resolve, reject) => {
            pm2.delete(name, (err) => {
                if (err) {
                    console.error(`❌ Failed to kill ${name}:`, err);
                    reject(err);
                    return;
                }

                console.log(`✅ Process ${name} killed`);
                resolve();
            });
        });
    }

    /**
     * Get memory usage for all Selene nodes
     */
    public async getMemoryUsage(): Promise<{[nodeName: string]: number}> {
        const processes = await this.listProcesses();
        const seleneNodes = processes.filter(p => p.name.startsWith('selene-node-'));

        const memoryMap: {[nodeName: string]: number} = {};

        for (const node of seleneNodes) {
            memoryMap[node.name] = Math.round(node.memory / 1024 / 1024); // Convert to MB
        }

        return memoryMap;
    }

    /**
     * Check if <300MB bet is won
     */
    public async checkMemoryBet(maxMB: number = 300): Promise<{won: boolean, peakNode: string, peakMB: number}> {
        const memoryUsage = await this.getMemoryUsage();

        let peakNode = '';
        let peakMB = 0;

        for (const [nodeName, memoryMB] of Object.entries(memoryUsage)) {
            if (memoryMB > peakMB) {
                peakMB = memoryMB;
                peakNode = nodeName;
            }
        }

        const won = peakMB < maxMB;

        return { won, peakNode, peakMB };
    }

    /**
     * Emergency shutdown: kill all Selene processes immediately
     */
    public async emergencyShutdown(): Promise<void> {
        console.log('🚨 EMERGENCY SHUTDOWN INITIATED');

        try {
            const processes = await this.listProcesses();
            const seleneProcesses = processes.filter(p => 
                p.name.startsWith('selene-') || p.name === 'load-balancer'
            );

            for (const proc of seleneProcesses) {
                try {
                    await this.killProcess(proc.name);
                } catch (error) {
                    console.error(`⚠️ Failed to kill ${proc.name} during emergency:`, error as Error);
                    // Continue killing other processes
                }
            }

            console.log('✅ Emergency shutdown complete');
        } catch (error) {
            console.error('❌ Emergency shutdown failed:', error as Error);
            throw error;
        }
    }

    /**
     * Watch cluster health in real-time (returns interval ID)
     */
    public watchClusterHealth(intervalSeconds: number = 5): NodeJS.Timeout {
        console.log(`👁️ Watching cluster health every ${intervalSeconds} seconds...`);

        return setInterval(async () => {
            try {
                const status = await this.getClusterStatus();
                const memoryUsage = await this.getMemoryUsage();

                console.log('\n📊 CLUSTER STATUS:');
                console.log(`   Nodes: ${status.runningNodes}/${status.totalNodes} online`);
                console.log(`   Consensus: ${status.consensusAchieved ? '✅ Achieved' : '❌ Lost'}`);
                console.log(`   Byzantine Tolerance: ${status.byzantineTolerance} faults`);
                console.log(`   Load Balancer: ${status.loadBalancer?.status || '❌ Not running'}`);

                console.log('\n💾 MEMORY USAGE:');
                for (const [nodeName, memoryMB] of Object.entries(memoryUsage)) {
                    const emoji = memoryMB < 300 ? '✅' : '⚠️';
                    console.log(`   ${emoji} ${nodeName}: ${memoryMB} MB`);
                }

                // Check bet
                const bet = await this.checkMemoryBet(300);
                if (bet.won) {
                    console.log(`\n🎰 APUESTA GANADA: Peak ${bet.peakMB}MB en ${bet.peakNode} < 300MB ✅`);
                } else {
                    console.log(`\n⚠️ APUESTA EN RIESGO: Peak ${bet.peakMB}MB en ${bet.peakNode} > 300MB`);
                }

            } catch (error) {
                console.error('❌ Health check failed:', error as Error);
            }
        }, intervalSeconds * 1000);
    }

    /**
     * Stop health watching
     */
    public stopWatching(intervalId: NodeJS.Timeout): void {
        clearInterval(intervalId);
        console.log('✅ Stopped watching cluster health');
    }
}

// 🎯 EXAMPLE USAGE (uncomment to test standalone)
/*
async function main() {
    const manager = new PM2ClusterManager();

    try {
        // Connect to PM2
        await manager.connect();

        // Start cluster
        await manager.startCluster('./ecosystem.config.cjs');

        // Wait 5 seconds for startup
        await new Promise(resolve => setTimeout(resolve, 5000));

        // Get status
        const status = await manager.getClusterStatus();
        console.log('Cluster status:', status);

        // Watch health for 60 seconds
        const watchId = manager.watchClusterHealth(5);

        await new Promise(resolve => setTimeout(resolve, 60000));

        // Stop watching
        manager.stopWatching(watchId);

        // Stop cluster
        await manager.stopCluster();

        // Disconnect
        await manager.disconnect();

    } catch (error) {
        console.error('Test failed:', error as Error);
        await manager.disconnect();
        process.exit(1);
    }
}

// main();
*/


