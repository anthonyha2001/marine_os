import "server-only";
import { createClient } from "@supabase/supabase-js";

const BUCKET = "product-images";
const ALLOWED = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 5 * 1024 * 1024;

export function storageConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SECRET_KEY);
}

function client() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { persistSession: false },
  });
}

/** Upload a product picture and return its public URL. */
export async function uploadProductImage(productId: string, file: File) {
  if (!storageConfigured()) {
    throw new Error("Picture upload isn't set up yet (SUPABASE_SECRET_KEY is missing).");
  }
  if (!ALLOWED.includes(file.type)) throw new Error("Picture must be JPG, PNG or WebP.");
  if (file.size > MAX_BYTES) throw new Error("Picture must be smaller than 5 MB.");

  const ext = file.type.split("/")[1];
  // New path per upload so browsers never show a stale cached picture.
  const path = `${productId}/${Date.now()}.${ext}`;
  const supabase = client();
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type });
  if (error) throw new Error(`Picture upload failed: ${error.message}`);

  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

/** Best-effort removal of a replaced picture. */
export async function deleteProductImage(publicUrl: string | null) {
  if (!publicUrl || !storageConfigured()) return;
  const marker = `/object/public/${BUCKET}/`;
  const index = publicUrl.indexOf(marker);
  if (index === -1) return;
  await client().storage.from(BUCKET).remove([publicUrl.slice(index + marker.length)]);
}
