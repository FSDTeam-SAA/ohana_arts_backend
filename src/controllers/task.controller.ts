import { asyncHandler } from "../utils/asyncHandler";
import { created, ok } from "../utils/ApiResponse";
import { Task, Event, Notification, User } from "../models"; // <-- 1. IMPORT MODELS
import { Request, Response } from "express";
import { NotificationType } from "../types/enums"; // <-- 2. IMPORT ENUM

export const createTask = asyncHandler(async (req: any, res: Response) => {
  const task = await Task.create({
    eventId: req.params.eventId,
    assignedTo: req.body.assignedTo,
    description: req.body.description,
  }); // --- 3. START NEW NOTIFICATION LOGIC ---

  const event = await Event.findById(req.params.eventId).select("title");
  const creator = await User.findById(req.user.id).select("name");

  const creatorName = creator ? creator.name : "The host";
  const eventTitle = event ? event.title : "an event"; // Only send a notification if not assigning task to self

  if (req.body.assignedTo !== req.user.id) {
    await Notification.create({
      userId: req.body.assignedTo, // The user the task is assigned to
      type: NotificationType.Task,
      title: "New Task Assigned",
      body: `${creatorName} assigned you a new task for: ${eventTitle}`,
      data: {
        eventId: req.params.eventId,
        taskId: task._id,
      },
    });
  } // --- END NEW NOTIFICATION LOGIC ---
  res.status(201).json(created(task));
});

export const toggleTask = asyncHandler(async (req: any, res: Response) => {
  const t = await Task.findById(req.params.taskId);
  if (!t) return res.json(ok(null));
  t.status = t.status === "Completed" ? "Pending" : "Completed";
  await t.save();
  res.json(ok(t));
});

export const listTasks = asyncHandler(async (req: Request, res: Response) => {
  const list = await Task.find({ eventId: req.params.eventId });
  res.json(ok(list));
});
