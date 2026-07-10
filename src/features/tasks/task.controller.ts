import { Request, Response } from "express";
import { asyncHandler } from "../../middleware/asyncHandler";
import { AppError } from "../../utils/AppError";

export const createTask = asyncHandler(async (req: Request, res: Response) => {
  const { title, projectId } = req.body;

  if (!title || !projectId) {
    throw new AppError(400, "title and projectId are required");
  }

  const { data, error } = await req
    .supabase!.from("tasks")
    .insert({
      title,
      project_id: projectId,
      organization_id: req.membership!.organizationId,
    })
    .select()
    .single();

  if (error) throw new AppError(500, error.message);
  return res.status(201).json({ task: data });
});

export const getTask = asyncHandler(async (req: Request, res: Response) => {
  const { data, error } = await req
    .supabase!.from("tasks")
    .select("*")
    .eq("organization_id", req.membership!.organizationId);

  if (error) throw new AppError(500, error.message);
  return res.json({ tasks: data });
});

export const updateTask = asyncHandler(async (req: Request, res: Response) => {
  const { taskId } = req.params;
  const { title, status } = req.body;

  const { data, error } = await req
    .supabase!.from("tasks")
    .update({ title, status })
    .eq("id", taskId)
    .eq("organization_id", req.membership!.organizationId)
    .select()
    .single();

  if (error) throw new AppError(500, error.message);
  return res.json({ task: data });
});

export const deleteTask = asyncHandler(async (req: Request, res: Response) => {
  const { taskId } = req.params;

  const { error } = await req
    .supabase!.from("tasks")
    .delete()
    .eq("id", taskId)
    .eq("organization_id", req.membership!.organizationId);

  if (error) throw new AppError(500, error.message);
  return res.status(204).send();
});
