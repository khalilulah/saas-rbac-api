// src/features/organizations/organizations.controller.ts
import { Request, Response } from "express";
import { asyncHandler } from "../../middleware/asyncHandler";
import { AppError } from "../../utils/AppError";

export const createOrganization = asyncHandler(
  async (req: Request, res: Response) => {
    const { name } = req.body;

    if (!name) {
      throw new AppError(400, "name is required");
    }

    const { data, error } = await req.supabase!.rpc(
      "create_organization_with_admin",
      {
        org_name: name,
      },
    );

    if (error) throw new AppError(500, error.message);

    return res.status(201).json({ organizationId: data[0].organization_id });
  },
);
