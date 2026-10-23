// Checks every 5 minutes whether the 18:00 (Baku) last-day reminders are due;
// the reminder itself makes sure nobody gets it twice.
import { runDeadlineRemindersIfDue } from "./lib/deadlineReminder";

const tick = () => {
  runDeadlineRemindersIfDue().catch((err) => console.error("Deadline reminder failed:", err));
};
setTimeout(tick, 30 * 1000);
setInterval(tick, 5 * 60 * 1000);
