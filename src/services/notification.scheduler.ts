import cron from "node-cron";
import dayjs from "dayjs";
import { Event, Notification, IEventAttendee } from "../models";
import { SocketHelpers } from "../socket";
import { NotificationType, RSVPStatus } from "../types/enums";
import { Types } from "mongoose"; // <-- 1. IMPORT MONGOOSE TYPES

let io: SocketHelpers;

/**
 * Checks for events starting soon and sends notifications.
 */
async function checkAndNotifyEvents() {
  const now = dayjs();
  // Find events starting between now and 5 minutes from now
  // that we haven't notified yet.
  const upcomingEvents = await Event.find({
    dateTime: {
      $gte: now.toDate(),
      $lte: now.add(5, "minutes").toDate(),
    },
    isStartNotified: false, // Ensure we only notify once
  }).select("title attendees");

  if (!upcomingEvents.length) {
    // No events starting soon, do nothing.
    return;
  }

  console.log(
    `[Scheduler] Found ${upcomingEvents.length} event(s) starting soon.`
  );

  // Use a loop to process each event individually
  for (const event of upcomingEvents) {
    // 1. Find all attendees who RSVP'd "Yes"
    const attendingUsers = event.attendees
      .filter((a: IEventAttendee) => a.status === RSVPStatus.Yes)
      .map((a: IEventAttendee) => a.userId);

    if (!attendingUsers.length) {
      // No one is attending, just mark as notified and skip
      await Event.updateOne({ _id: event._id }, { isStartNotified: true });
      continue;
    }

    // 2. Create the notification payload for all attendees
    const title = "Event Starting Soon!";
    const body = `Your event "${event.title}" is starting in 5 minutes!`;

    // --- 2. ADD THE TYPE TO THE PARAMETER ---
    const notifications = attendingUsers.map((userId: Types.ObjectId) => ({
      userId: userId,
      type: NotificationType.EventStarting,
      title: title,
      body: body,
      data: {
        eventId: event._id,
      },
    }));

    // 3. Save all notifications to the database
    const createdNotifications = await Notification.insertMany(notifications);

    // 4. Send real-time socket notifications
    for (const notif of createdNotifications) {
      if (io) {
        // Send the new notification doc to the user
        io.notifyUser(notif.userId.toString(), notif.toJSON());
      }
    }

    // 5. Mark the event as notified so we don't send again
    await Event.updateOne({ _id: event._id }, { isStartNotified: true });

    console.log(
      `[Scheduler] Sent ${createdNotifications.length} 'Event Starting' notifications for: ${event.title}`
    );
  }
}

/**
 * Initializes and starts the cron job.
 * @param ioHelpers - The socket helpers for real-time notifications.
 */
export function startEventNotificationScheduler(ioHelpers: SocketHelpers) {
  io = ioHelpers;
  console.log("⏰ Event notification scheduler starting...");

  // Schedule to run every minute
  const task = cron.schedule("* * * * *", () => {
    // console.log("[Scheduler] Checking for upcoming events..."); // Uncomment for verbose logging
    checkAndNotifyEvents().catch((err) => {
      console.error("[Scheduler] Error checking for events:", err);
    });
  });

  task.start();

  // Run a check immediately on startup
  checkAndNotifyEvents().catch((err) => {
    console.error("[Scheduler] Error on initial event check:", err);
  });
}
