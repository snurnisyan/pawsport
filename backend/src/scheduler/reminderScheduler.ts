import { env } from "../config/env";

let reminderSchedulerTimer: NodeJS.Timeout | undefined;

const pollPendingReminders = async (): Promise<void> => {
  // Reminder selection and email delivery will be implemented with the domain logic.
};

export const startReminderScheduler = (): void => {
  if (!env.REMINDER_SCHEDULER_ENABLED || reminderSchedulerTimer) {
    return;
  }

  reminderSchedulerTimer = setInterval(() => {
    void pollPendingReminders();
  }, env.REMINDER_POLL_INTERVAL_MS);

  reminderSchedulerTimer.unref();
};

export const stopReminderScheduler = (): void => {
  if (!reminderSchedulerTimer) {
    return;
  }

  clearInterval(reminderSchedulerTimer);
  reminderSchedulerTimer = undefined;
};
