/**
 * 🔥 SELENE SONG CORE PUBSUB SYSTEM
 * By PunkClaude & RaulVisionario - September 23, 2025
 *
 * MISSION: Real-time PubSub system for GraphQL subscriptions
 * TARGET: WebSocket-based real-time updates with Veritas protection
 */
import { PubSub } from "graphql-subscriptions";
// import { SeleneVeritas } from "../Veritas/Veritas.js";
// import { MonitoringOrchestrator } from "../Monitoring/MonitoringOrchestrator.js";
export class SelenePubSub {
    pubsub; // PubSub instance
    veritas; // SeleneVeritas;
    monitoring; // MonitoringOrchestrator;
    activeSubscriptions = new Map();
    connectionCount = 0;
    constructor(veritas, monitoring) {
        console.log("🔥 INITIALIZING SELENE PUBSUB SYSTEM...");
        this.pubsub = new PubSub();
        this.veritas = veritas;
        this.monitoring = monitoring;
        console.log("✅ SELENE PUBSUB SYSTEM INITIALIZED");
    }
    /**
     * 📡 Publish event with Veritas validation
     */
    async publish(topic, _payload) {
        try {
            console.log(`📡 PUBLISHING EVENT: ${topic}`);
            // Apply Veritas validation to payload if it's critical data
            const validatedPayload = await this.applyVeritasValidation(topic, _payload);
            // Publish the event
            await this.pubsub.publish(topic, validatedPayload);
            // Update metrics
            this.updateMetrics(topic);
            console.log(`✅ EVENT PUBLISHED: ${topic}`);
        }
        catch (error) {
            console.error(`💥 PUBSUB PUBLISH ERROR for ${topic}:`, error);
            this.monitoring.logError(`PubSub publish failed: ${topic}`, error);
        }
    }
    /**
     * 🔔 Get async iterator for subscriptions
     */
    asyncIterator(topics) {
        const topicArray = Array.isArray(topics) ? topics : [topics];
        // Track active subscriptions
        topicArray.forEach((topic) => {
            const current = this.activeSubscriptions.get(topic) || 0;
            this.activeSubscriptions.set(topic, current + 1);
        });
        console.log(`🔔 SUBSCRIPTION CREATED for topics: ${topicArray.join(", ")}`);
        console.log(`📊 Active subscriptions:`, Object.fromEntries(this.activeSubscriptions));
        return this.pubsub.asyncIterator(topicArray);
    }
    /**
     * 🔐 Apply Veritas validation to subscription payloads
     */
    async applyVeritasValidation(topic, payload) {
        // Define critical topics that need Veritas validation
        const criticalTopics = [
            "MEDICAL_RECORD_V3_CREATED",
            "MEDICAL_RECORD_V3_UPDATED",
            "DOCUMENT_V3_CREATED",
            "DOCUMENT_V3_UPDATED",
            "PATIENT_CREATED",
            "PATIENT_UPDATED",
            "APPOINTMENT_V3_CREATED",
            "APPOINTMENT_V3_UPDATED",
        ];
        if (criticalTopics.includes(topic)) {
            console.log(`🛡️ APPLYING VERITAS VALIDATION for ${topic}`);
            try {
                // Extract the main data object from payload
                const dataKey = Object.keys(payload)[0];
                const data = payload[dataKey];
                if (data && typeof data === "object" && data.id) {
                    // Determine data type from topic
                    const dataType = this.getDataTypeFromTopic(topic);
                    // Apply Veritas verification
                    const verification = await this.veritas.verifyDataIntegrity(data, dataType, data.id);
                    // Add Veritas metadata to payload
                    const enrichedPayload = {
                        ...payload,
                        [dataKey]: {
                            ...data,
                            _veritas: {
                                verified: verification.isValid,
                                confidence: verification.confidence,
                                level: this.getVeritasLevelFromTopic(topic),
                                certificate: verification.certificate || null,
                                verifiedAt: new Date().toISOString(),
                                algorithm: "quantum-veritas-v3",
                            },
                        },
                    };
                    console.log(`✅ VERITAS VALIDATION APPLIED: verified=${verification.isValid}, confidence=${verification.confidence}`);
                    return enrichedPayload;
                }
            }
            catch (error) {
                console.error(`💥 VERITAS VALIDATION FAILED for ${topic}:`, error);
                // Return payload with error metadata
                const dataKey = Object.keys(payload)[0];
                return {
                    ...payload,
                    [dataKey]: {
                        ...payload[dataKey],
                        _veritas: {
                            verified: false,
                            confidence: 0,
                            level: this.getVeritasLevelFromTopic(topic),
                            certificate: null,
                            error: error instanceof Error ? error.message : "Verification failed",
                            verifiedAt: new Date().toISOString(),
                            algorithm: "quantum-veritas-v3",
                        },
                    },
                };
            }
        }
        // Return original payload for non-critical topics
        return payload;
    }
    /**
     * 📊 Update subscription metrics
     */
    updateMetrics(topic) {
        // Update active subscription counts
        const current = this.activeSubscriptions.get(topic) || 0;
        this.activeSubscriptions.set(topic, current);
        // Log metrics to monitoring
        this.monitoring.logMetric("pubsub_events_published", 1, {
            topic,
            timestamp: new Date().toISOString(),
        });
    }
    /**
     * 🔍 Get data type from topic
     */
    getDataTypeFromTopic(_topic) {
        const topicMap = {
            MEDICAL_RECORD_V3_CREATED: "medical_records",
            MEDICAL_RECORD_V3_UPDATED: "medical_records",
            DOCUMENT_V3_CREATED: "documents",
            DOCUMENT_V3_UPDATED: "documents",
            PATIENT_CREATED: "patients",
            PATIENT_UPDATED: "patients",
            APPOINTMENT_V3_CREATED: "appointments",
            APPOINTMENT_V3_UPDATED: "appointments",
        };
        return topicMap[_topic] || "unknown";
    }
    /**
     * 🛡️ Get Veritas level from topic
     */
    getVeritasLevelFromTopic(topic) {
        const criticalTopics = [
            "MEDICAL_RECORD_V3_CREATED",
            "MEDICAL_RECORD_V3_UPDATED",
            "DOCUMENT_V3_CREATED",
            "DOCUMENT_V3_UPDATED",
        ];
        const highTopics = [
            "PATIENT_CREATED",
            "PATIENT_UPDATED",
            "APPOINTMENT_V3_CREATED",
            "APPOINTMENT_V3_UPDATED",
        ];
        if (criticalTopics.includes(topic))
            return "CRITICAL";
        if (highTopics.includes(topic))
            return "HIGH";
        return "MEDIUM";
    }
    /**
     * 📈 Get subscription statistics
     */
    getStats() {
        return {
            activeSubscriptions: Object.fromEntries(this.activeSubscriptions),
            totalActiveSubscriptions: Array.from(this.activeSubscriptions.values()).reduce((_sum, _count) => _sum + _count, 0),
            connectionCount: this.connectionCount,
            topics: Array.from(this.activeSubscriptions.keys()),
            timestamp: new Date().toISOString(),
        };
    }
    /**
     * 🔌 Track WebSocket connection
     */
    trackConnection(_connected) {
        if (_connected) {
            this.connectionCount++;
            console.log(`🔌 WebSocket connection established. Total: ${this.connectionCount}`);
        }
        else {
            this.connectionCount = Math.max(0, this.connectionCount - 1);
            console.log(`🔌 WebSocket connection closed. Total: ${this.connectionCount}`);
        }
    }
    /**
     * 🧹 Cleanup inactive subscriptions
     */
    cleanup() {
        console.log("🧹 CLEANING UP PUBSUB SYSTEM...");
        // Reset subscription counts (they will be rebuilt as clients reconnect)
        this.activeSubscriptions.clear();
        console.log("✅ PUBSUB CLEANUP COMPLETED");
    }
}
export default SelenePubSub;
//# sourceMappingURL=PubSub.js.map