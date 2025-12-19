import { v2 as cloudinary, UploadApiResponse } from "cloudinary";
import fs from "fs";
import dotenv from "dotenv";
import Logger from "./logger";

dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const uploadOnCloudinary = async (
  localFilePath: string
): Promise<UploadApiResponse | null> => {
  if (!localFilePath) return null;

  let response: UploadApiResponse | null = null;

  try {
    response = await cloudinary.uploader.upload(localFilePath, {
      resource_type: "auto",
    });
  } catch (error: any) {
    Logger.error(`Cloudinary upload failed: ${error.message}`);
    // Do NOT return null here yet, let finally run
  } finally {
    // 🛡️ SAFELY DELETE LOCAL FILE
    try {
      if (fs.existsSync(localFilePath)) {
        fs.unlinkSync(localFilePath);
      }
    } catch (unlinkError: any) {
      // Just log the warning. Do not throw or retry.
      Logger.warn(
        `Failed to delete local file ${localFilePath}: ${unlinkError.message}`
      );
    }
  }
  return response;
};
const deleteFromCloudinary = async (publicId: string): Promise<any> => {
  try {
    const result = await cloudinary.uploader.destroy(publicId);
    if (result.result !== "ok") {
      Logger.warn(
        `Cloudinary delete warning for ${publicId}: ${result.result}`
      );
    }
    return result;
  } catch (error: any) {
    Logger.error(`Error deleting from cloudinary: ${error}`);
    return null;
  }
};

export { uploadOnCloudinary, deleteFromCloudinary };
