import { cloudinary } from "../config/cloudinary";
import stream from "stream";

export async function uploadBufferToCloudinary(
  buffer: Buffer,
  folder = "rally",
  opts?: { filenameOverride?: string }
): Promise<{ url: string; public_id: string }> {
  return new Promise((resolve, reject) => {
    const passthrough = new stream.PassThrough();
    passthrough.end(buffer);

    const uploadStream = cloudinary.uploader.upload_stream(
      { folder, public_id: opts?.filenameOverride },
      (err, result) => {
        if (err || !result) return reject(err || new Error("Cloudinary upload failed"));
        resolve({ url: result.secure_url, public_id: result.public_id });
      }
    );
    passthrough.pipe(uploadStream);
  });
}
