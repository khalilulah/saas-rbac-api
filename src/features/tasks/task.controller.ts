import { Request, Response } from "express";

export async function createTask(req: Request, res: Response) {
  const { title, projectId } = req.body;

  const { data, error } = await req
    .supabase!.from("tasks")
    .insert({
      title,
      project_id: projectId,
      organization_id: req.membership!.organizationId,
    })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  return res.status(201).json({ task: data });
}

export async function getTask(req: Request, res: Response) {
  const { data, error } = await req
    .supabase!.from("tasks")
    .select("*")
    .eq("organization_id", req.membership!.organizationId);

  if (error) return res.status(500).json({ error: error.message });
  return res.json({ tasks: data });
}

export async function updateTask(req: Request, res: Response) {
  const { taskId } = req.params;
  const { title, status } = req.body;

  const { data, error } = await req
    .supabase!.from("tasks")
    .update({ title, status })
    .eq("id", taskId)
    .eq("organization_id", req.membership!.organizationId)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  return res.json({ task: data });
}

export async function deleteTask(req: Request, res: Response) {
  const { taskId } = req.params;

  const { error } = await req
    .supabase!.from("tasks")
    .delete()
    .eq("id", taskId)
    .eq("organization_id", req.membership!.organizationId);

  if (error) return res.status(500).json({ error: error.message });
  return res.status(204).send();
}
