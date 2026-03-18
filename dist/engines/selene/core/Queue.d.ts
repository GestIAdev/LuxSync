/**
 * 📨 SELENE QUEUE - MESSAGE QUEUE INTEGRATION MODULE
 * By PunkClaude & RaulVisionario - September 18, 2025
 *
 * MISSION: Integrated message queue system
 * STRATEGY: Bull-powered job processing with Redis
 */
import { Job } from "bull";
interface QueueJob {
    id: string;
    name: string;
    data: any;
    priority?: number;
    delay?: number;
    attempts?: number;
}
/**
 * 📨 SELENE QUEUE - THE MESSAGE GOD
 * Integrated message queue with job processing
 */
export declare class SeleneQueue {
    private queues;
    private config;
    private isRunning;
    constructor();
    /**
     * 🚀 Connect to Redis for queues
     */
    connect(): Promise<void>;
    /**
     * 🔌 Disconnect from queues
     */
    disconnect(): Promise<void>;
    /**
     * ➕ Create a new queue
     */
    createQueue(name: string): Promise<any>;
    /**
     * 📋 Add job to queue
     */
    addJob(queueName: string, job: QueueJob): Promise<Job>;
    /**
     * 📊 Get queue status
     */
    getQueueStatus(queueName: string): Promise<any>;
    /**
     * ⏸️ Pause queue
     */
    pauseQueue(queueName: string): Promise<void>;
    /**
     * ▶️ Resume queue
     */
    resumeQueue(queueName: string): Promise<void>;
    /**
     * ⚙️ Process job based on queue type
     */
    private processJob;
    /**
     * 📧 Process email job
     */
    private processEmailJob;
    /**
     * 🔔 Process notification job
     */
    private processNotificationJob;
    /**
     * 📊 Process report job
     */
    private processReportJob;
    /**
     * 🤖 Process AI job
     */
    private processAIJob;
    /**
     * 💾 Process backup job
     */
    private processBackupJob;
    /**
     * 📋 Process default job
     */
    private processDefaultJob;
    /**
     * 📊 Get all queues status
     */
    getAllQueuesStatus(): Promise<any>;
    /**
     * 📈 Get queue statistics
     */
    getQueueStatistics(queueName: string): Promise<any>;
    /**
     * 🧹 Clean old jobs
     */
    cleanQueue(queueName: string, grace?: number): Promise<void>;
    /**
     * 📋 Get job by ID
     */
    getJob(_queueName: string, _jobId: string): Promise<any>;
    /**
     * 🗑️ Remove job
     */
    removeJob(queueName: string, jobId: string): Promise<void>;
    /**
     * 📊 Get queue status
     */
    getStatus(): Promise<any>;
}
export {};
//# sourceMappingURL=Queue.d.ts.map