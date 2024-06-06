import { v2 as cloudinary } from "cloudinary";
import dotenv from "dotenv";
import fs from "fs";
dotenv.config();
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const uploadOnCloudinary = async (localFilePath) => {
  try {
    if (!localFilePath) return null;
    const response = await cloudinary.uploader.upload(localFilePath, {
      resource_type: "auto",
      overwrite: false,
      unique_filename: true,
      use_filename: true,
      folder: "uploads",
    });
    fs.unlinkSync(localFilePath);
    return response;
  } catch (error) {
    console.log(error);
    fs.unlinkSync(localFilePath);
    return null;
  }
};

const deleteOldFileFromCloudinary = async (localFilePath) => {
  try {
    if (!localFilePath) return null;
    let splittedUrl = localFilePath.split("/");
    let folderName = splittedUrl[splittedUrl.length - 2];
    const filePath = splittedUrl[splittedUrl.length - 1];

    const lastDotIndex = filePath.lastIndexOf(".");
    const fileNameWithoutExtension =
      lastDotIndex !== -1 ? filePath.substring(0, lastDotIndex) : filePath;
    const response = await cloudinary.uploader.destroy(
      `${folderName}/${fileNameWithoutExtension}`
    );

    return response;
  } catch (error) {
    console.log(error);
    return null;
  }
};

export { uploadOnCloudinary, deleteOldFileFromCloudinary };
