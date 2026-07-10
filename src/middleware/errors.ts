// src/middleware/errors.ts
import { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/AppError";

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ error: err.message });
  }

  // Anything else is unexpected — log it fully for us to investigate,
  // but never leak internal details (stack traces, raw DB errors) to the client.
  console.error("Unhandled error:", err);
  return res.status(500).json({ error: "Something went wrong" });
}
