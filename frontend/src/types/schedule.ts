export type ScheduleType = "ONCE_PER_WEEK" | "DAILY" | "TEMPERATURE_TRIGGER";

export interface Schedule {
  id: string;
  origin: string;
  destination: string;

  scheduleType: ScheduleType;
  // scheduleConfig is stored as JSON on backend; keep it flexible but typed.
  scheduleConfig: Record<string, unknown>;
  note?: string | null;

  isActive: boolean;
  lastGeneratedAt?: string | null;
}

export type ScheduleEventType = "SCHEDULE.CREATED" | "SCHEDULE.UPDATED";

export interface ScheduleEvent {
  event_id: string;
  timestamp: string;
  ownerEmail: string;
  eventType: ScheduleEventType;
  schedule: Schedule;
}


