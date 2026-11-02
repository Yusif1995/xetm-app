// Checks every 5 minutes whether the 18:00 (Baku) last-day reminders are due, and every 30 seconds
// whether the 23:55 / 23:59 "start the next distribution" nudge is; each reminder makes sure
// nobody gets it twice.
import { runDeadlineRemindersIfDue } from "./lib/deadlineReminder";
import { runNextDistributionNudgesIfDue } from "./lib/nextDistributionReminder";

const tick = () => {
  runDeadlineRemindersIfDue().catch((err) => console.error("Deadline reminder failed:", err));
};
setTimeout(tick, 30 * 1000);
setInterval(tick, 5 * 60 * 1000);

setInterval(() => {
  runNextDistributionNudgesIfDue().catch((err) => console.error("Next distribution nudge failed:", err));
}, 30 * 1000);
