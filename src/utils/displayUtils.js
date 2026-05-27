export const cleanDisplayName = (value = "Usuario") => {
  const raw = String(value || "").trim();
  const withoutEmailDomain = raw.includes("@") ? raw.split("@")[0] : raw;
  const normalized = withoutEmailDomain
    .replace(/[._-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) return "Usuario";

  return normalized
    .split(" ")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
};

export const getCreatorName = (obra = {}) =>
  cleanDisplayName(
    obra.creadoPorNombre ||
      obra.autorNombre ||
      obra.autor ||
      obra.creador ||
      obra.traductorPrincipalNombre ||
      "Usuario"
  );
