import { Request, Response, NextFunction } from "express";
import { ZodObject, ZodError } from "zod";
import { ApiError } from "../utils/ApiError";
import multer from "multer";

export const validate =
  (schema: ZodObject) => (req: Request, res: Response, next: NextFunction) => {
    try {
      // 1. Combine body with file data so Zod can validate everything together
      const dataToValidate = { ...req.body };

      // Handle "upload.fields()" or "upload.array()"
      if (req.files) {
        if (Array.isArray(req.files)) {
          // If it's an array (upload.array), usually under a specific field name isn't implicit
          // But multer attaches it to req.files. We might need the fieldname if possible,
          // but strictly speaking, upload.array puts them in req.files
          // For safety in Zod, we might usually look for specific keys.
          // Let's iterate object keys if it's an object (upload.fields)
        } else {
          // It is an object: { fieldName: [file1, file2] }
          Object.keys(req.files).forEach((key) => {
            // @ts-ignore - We know req.files is an object here
            dataToValidate[key] = req.files[key];
          });
        }
      }

      // Handle "upload.single()"
      if (req.file) {
        dataToValidate[req.file.fieldname] = req.file;
      }

      // 2. Validate using Zod
      schema.parse(dataToValidate);

      // 3. Move to next middleware if successful
      next();
    } catch (err: any) {
      // A. Handle Multer Errors (File size, missing field, etc.)
      if (err instanceof multer.MulterError || err.name === "MulterError") {
        return res
          .status(400)
          .json(new ApiError(400, `File Upload Error: ${err.message}`));
      }

      // B. Handle Zod Validation Errors
      if (err instanceof ZodError) {
        const errors = err.issues.map((e) => ({
          field: e.path.join("."), // Joins nested paths like "address.zip"
          message: e.message,
        }));

        return res
          .status(400)
          .json(new ApiError(400, "Validation Error", errors));
      }

      // C. Handle unexpected errors
      next(err);
    }
  };
