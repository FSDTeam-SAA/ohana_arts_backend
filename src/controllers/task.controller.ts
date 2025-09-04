import { asyncHandler } from "../utils/asyncHandler";
import { created, ok } from "../utils/ApiResponse";
import { Task } from "../models";
import { Request, Response } from "express";

export const createTask = asyncHandler(async (req: any, res: Response) => {
  const task = await Task.create({
    eventId: req.params.eventId,
    assignedTo: req.body.assignedTo,
    description: req.body.description
  });
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
