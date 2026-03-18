import { BaseDatabase } from './BaseDatabase.js';
export declare class SubscriptionsDatabase extends BaseDatabase {
    getSubscriptionPlansV3(args: {
        clinicId?: string;
        isActive?: boolean;
        limit?: number;
        offset?: number;
    }): Promise<any[]>;
    getSubscriptionPlanV3ById(id: string): Promise<any>;
    createSubscriptionPlanV3(input: any): Promise<any>;
    updateSubscriptionPlanV3(id: string, input: any): Promise<any>;
    deleteSubscriptionPlanV3(id: string): Promise<void>;
    getSubscriptionsV3(args: {
        userId?: string;
        status?: string;
        limit?: number;
        offset?: number;
    }): Promise<any[]>;
    getSubscriptionV3ById(id: string): Promise<any>;
    createSubscriptionV3(input: any): Promise<any>;
    updateSubscriptionV3(id: string, input: any): Promise<any>;
    cancelSubscriptionV3(id: string, immediate?: boolean): Promise<any>;
    reactivateSubscriptionV3(id: string): Promise<any>;
    deleteSubscriptionV3(id: string): Promise<void>;
    getBillingCyclesV3(args: {
        subscriptionId?: string;
        status?: string;
        limit?: number;
        offset?: number;
    }): Promise<any[]>;
    getBillingCycleV3ById(id: string): Promise<any>;
    createBillingCycleV3(input: any): Promise<any>;
    updateBillingCycleV3(id: string, input: any): Promise<any>;
    processBillingCycleV3(id: string): Promise<any>;
    deleteBillingCycleV3(id: string): Promise<void>;
    getUsageTrackingV3(args: {
        subscriptionId?: string;
        metric?: string;
        startDate?: Date;
        endDate?: Date;
        limit?: number;
        offset?: number;
    }): Promise<any[]>;
    trackServiceUsageV3(input: any): Promise<any>;
    getUsageSummaryV3(subscriptionId: string, startDate: Date, endDate: Date): Promise<any>;
    getUserActiveSubscriptionV3(userId: string): Promise<any>;
    checkSubscriptionLimitsV3(subscriptionId: string): Promise<any>;
    getSubscriptionRevenueV3(args: {
        startDate?: Date;
        endDate?: Date;
        planId?: string;
    }): Promise<any>;
    getTrialExpiringSubscriptionsV3(daysAhead?: number): Promise<any[]>;
    getExpiredTrialsV3(): Promise<any[]>;
    convertTrialToPaidV3(subscriptionId: string): Promise<any>;
    getSubscriptionPlanFeaturesV3(planId: string): Promise<any[]>;
}
//# sourceMappingURL=SubscriptionsDatabase.d.ts.map