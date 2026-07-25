/** Batas untuk akun terbatas (Trial & Demo). Ubah angka ini bila perlu. */
export const LIMITED_PRODUCT_MAX = 6;
export const LIMITED_CATEGORY_MAX = 2;

/** Akun Trial & Demo dibatasi fiturnya. */
export function isLimitedPlan(
  status?: string | null,
  plan?: string | null,
): boolean {
  return status === "trial" || plan === "demo";
}

/** Label untuk ditampilkan ke user. */
export function limitedLabel(status?: string | null, plan?: string | null): string {
  if (status === "trial") return "Trial";
  if (plan === "demo") return "Demo";
  return "";
}
