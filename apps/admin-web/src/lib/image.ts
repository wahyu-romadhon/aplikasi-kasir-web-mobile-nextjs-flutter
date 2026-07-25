/**
 * Kompres gambar di browser: resize ke sisi terpanjang `maxSize` px lalu
 * encode WebP kualitas `quality`. Hasilnya jauh lebih kecil (puluhan KB)
 * untuk menghemat storage Supabase.
 */
export async function compressImage(
  file: File,
  { maxSize = 500, quality = 0.7 }: { maxSize?: number; quality?: number } = {},
): Promise<File> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Gagal membaca file"));
    reader.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Gagal memuat gambar"));
    image.src = dataUrl;
  });

  let { width, height } = img;
  if (width >= height && width > maxSize) {
    height = Math.round((height * maxSize) / width);
    width = maxSize;
  } else if (height > maxSize) {
    width = Math.round((width * maxSize) / height);
    height = maxSize;
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas tidak didukung");
  ctx.drawImage(img, 0, 0, width, height);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/webp", quality),
  );
  if (!blob) throw new Error("Kompresi gagal");

  return new File([blob], file.name.replace(/\.\w+$/, "") + ".webp", {
    type: "image/webp",
  });
}

/** Upload gambar produk lewat API route (server memakai service_role). */
export async function uploadProductImage(file: File): Promise<string> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch("/api/products/upload", { method: "POST", body: form });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || "Upload gambar gagal");
  }
  const { url } = await res.json();
  return url as string;
}
