import { cloudinary } from "../config/cloudinary";

/** Delete by public_id */
export async function deleteByPublicId(publicId?: string | null) {
  if (!publicId) return;
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (err) {
    console.warn("Cloudinary destroy failed", publicId, err);
  }
}

/** Best-effort: derive public_id from a Cloudinary url and delete */
export async function deleteByUrl(url?: string | null) {
  if (!url) return;
  try {
    const m = url.match(/\/upload\/(?:v\d+\/)?([^.#?]+)\.[a-z0-9]+(?:\?|#|$)/i);
    const publicId = m?.[1];
    if (publicId) await deleteByPublicId(publicId);
  } catch (err) {
    console.warn("Cloudinary url destroy failed", url, err);
  }
}
