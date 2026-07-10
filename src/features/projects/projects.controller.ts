// src/features/projects/projects.controller.ts
import { Request, Response } from "express";
import { AppError } from "../../utils/AppError";
import { asyncHandler } from "../../middleware/asyncHandler";

export const listProjects = asyncHandler(
  async (req: Request, res: Response) => {
    const { data, error } = await req
      .supabase!.from("projects")
      .select("*")
      .eq("organization_id", req.membership!.organizationId);

    if (error) throw new AppError(500, error.message);
    return res.json({ projects: data });
  },
);

export const createProject = asyncHandler(
  async (req: Request, res: Response) => {
    const { name } = req.body;
    if (!name) {
      throw new AppError(400, "name is required");
    }

    const { data, error } = await req
      .supabase!.from("projects")
      .insert({ name, organization_id: req.membership!.organizationId })
      .select()
      .single();

    if (error) throw new AppError(500, error.message);
    return res.status(201).json({ project: data });
  },
);

export const updateProject = asyncHandler(
  async (req: Request, res: Response) => {
    const { projectId } = req.params;
    const { name } = req.body;

    const { data, error } = await req
      .supabase!.from("projects")
      .update({ name })
      .eq("id", projectId)
      .eq("organization_id", req.membership!.organizationId)
      .select()
      .single();

    if (error) throw new AppError(500, error.message);
    return res.json({ project: data });
  },
);

export const deleteProject = asyncHandler(
  async (req: Request, res: Response) => {
    const { projectId } = req.params;

    const { error } = await req
      .supabase!.from("projects")
      .delete()
      .eq("id", projectId)
      .eq("organization_id", req.membership!.organizationId);

    if (error) throw new AppError(500, error.message);
    return res.status(204).send();
  },
);
