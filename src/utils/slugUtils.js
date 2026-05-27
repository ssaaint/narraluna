export const createSlug = (value = "") =>
  String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export const getStorySlug = (historia) =>
  historia?.slug || createSlug(historia?.titulo || "");

export const createUniqueSlug = (baseValue, existingSlugs = []) => {
  const baseSlug = createSlug(baseValue);

  if (!baseSlug) return "";

  const normalizedExisting = new Set(
    existingSlugs.map((slug) => createSlug(slug)).filter(Boolean)
  );

  if (!normalizedExisting.has(baseSlug)) {
    return baseSlug;
  }

  let suffix = 2;
  let candidate = `${baseSlug}-${suffix}`;

  while (normalizedExisting.has(candidate)) {
    suffix += 1;
    candidate = `${baseSlug}-${suffix}`;
  }

  return candidate;
};
