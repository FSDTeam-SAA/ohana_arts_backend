import { asyncHandler } from "../utils/asyncHandler";
import { created, ok } from "../utils/ApiResponse";
import { Task } from "../models";

export const createTask = asyncHandler(async (req: any, res) => {
  const task = await Task.create({
    eventId: req.params.eventId,
    assignedTo: req.body.assignedTo,
    description: req.body.description
  });
  res.status(201).json(created(task));
});

export const toggleTask = asyncHandler(async (req: any, res) => {
  const t = await Task.findById(req.params.taskId);
  if (!t) return res.json(ok(null));
  t.status = t.status === "Completed" ? "Pending" : "Completed";
  await t.save();
  res.json(ok(t));
});

export const listTasks = asyncHandler(async (req, res) => {
  const list = await Task.find({ eventId: req.params.eventId });
  res.json(ok(list));
});
