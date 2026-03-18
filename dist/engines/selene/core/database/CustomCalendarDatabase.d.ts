import { BaseDatabase } from './BaseDatabase.js';
export declare class CustomCalendarDatabase extends BaseDatabase {
    getCustomCalendarViewsV3(args: {
        userId?: string;
        isPublic?: boolean;
        limit?: number;
        offset?: number;
    }): Promise<any[]>;
    getCustomCalendarViewV3ById(id: string): Promise<any>;
    createCustomCalendarViewV3(input: any): Promise<any>;
    updateCustomCalendarViewV3(id: string, input: any): Promise<any>;
    deleteCustomCalendarViewV3(id: string): Promise<void>;
    getCalendarEventsV3(args: {
        userId?: string;
        viewId?: string;
        startDate?: Date;
        endDate?: Date;
        eventType?: string;
        limit?: number;
        offset?: number;
    }): Promise<any[]>;
    getCalendarEventV3ById(id: string): Promise<any>;
    createCalendarEventV3(input: any): Promise<any>;
    updateCalendarEventV3(id: string, input: any): Promise<any>;
    deleteCalendarEventV3(id: string): Promise<void>;
    getCalendarFiltersV3(args: {
        userId?: string;
        viewId?: string;
        limit?: number;
        offset?: number;
    }): Promise<any[]>;
    getCalendarFilterV3ById(id: string): Promise<any>;
    createCalendarFilterV3(input: any): Promise<any>;
    updateCalendarFilterV3(id: string, input: any): Promise<any>;
    deleteCalendarFilterV3(id: string): Promise<void>;
    getCalendarSettingsV3(userId: string): Promise<any>;
    updateCalendarSettingsV3(userId: string, input: any): Promise<any>;
    getUserDefaultCalendarViewV3(userId: string): Promise<any>;
    getCalendarEventsByDateRangeV3(args: {
        userId: string;
        startDate: Date;
        endDate: Date;
        eventTypes?: string[];
    }): Promise<any[]>;
    getUpcomingCalendarEventsV3(args: {
        userId: string;
        limit?: number;
        daysAhead?: number;
    }): Promise<any[]>;
    getCalendarEventsWithRemindersV3(userId: string): Promise<any[]>;
    duplicateCalendarViewV3(viewId: string, newName: string, userId: string): Promise<any>;
    applyCalendarFilterV3(viewId: string, filterId: string): Promise<any[]>;
    getCalendarViewStatsV3(viewId: string): Promise<any>;
    bulkUpdateCalendarEventsV3(eventIds: string[], updates: any): Promise<any[]>;
    getCalendarConflictsV3(args: {
        userId: string;
        startDate: Date;
        endDate: Date;
    }): Promise<any[]>;
    setDefaultCalendarViewV3(userId: string, viewId: string): Promise<void>;
    getCalendarAvailabilityV3(userId: string, date: string): Promise<any[]>;
    toggleCalendarFilterV3(filterId: string): Promise<any>;
}
//# sourceMappingURL=CustomCalendarDatabase.d.ts.map