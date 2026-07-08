// src/features/projects/projects.controller.ts
import { Request, Response } from "express";

export async function listProjects(req: Request, res: Response) {
  const { data, error } = await req
    .supabase!.from("projects")
    .select("*")
    .eq("organization_id", req.membership!.organizationId);

  if (error) return res.status(500).json({ error: error.message });
  return res.json({ projects: data });
}

export async function createProject(req: Request, res: Response) {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: "name is required" });

  const { data, error } = await req
    .supabase!.from("projects")
    .insert({ name, organization_id: req.membership!.organizationId })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  return res.status(201).json({ project: data });
}

export async function updateProject(req: Request, res: Response) {
  const { projectId } = req.params;
  const { name } = req.body;

  const { data, error } = await req
    .supabase!.from("projects")
    .update({ name })
    .eq("id", projectId)
    .eq("organization_id", req.membership!.organizationId)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  return res.json({ project: data });
}

export async function deleteProject(req: Request, res: Response) {
  const { projectId } = req.params;

  const { error } = await req
    .supabase!.from("projects")
    .delete()
    .eq("id", projectId)
    .eq("organization_id", req.membership!.organizationId);

  if (error) return res.status(500).json({ error: error.message });
  return res.status(204).send();
}
