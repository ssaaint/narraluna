export const normalizeIdentity = (value = "") =>
  String(value).trim().includes("@")
    ? String(value).trim().toLowerCase()
    : String(value).trim();

export const isAdmin = (profile = {}) => profile?.rol === "admin";

export const normalizeCollaborators = (value) => {
  if (!value) return [];

  const items = Array.isArray(value)
    ? value
    : String(value)
        .split(/[\n,;]/)
        .map((item) => item.trim());

  return [...new Set(items.map(normalizeIdentity).filter(Boolean))];
};

export const getCollaborators = (historia) =>
  normalizeCollaborators([
    ...(Array.isArray(historia?.colaboradoresPermitidos)
      ? historia.colaboradoresPermitidos
      : []),
    ...(Array.isArray(historia?.colaboradores)
      ? historia.colaboradores
      : [])
  ]);

export const userCanManageStory = (user, historia, profile = {}) => {
  if (!user || !historia) return false;
  if (isAdmin(profile)) return true;
  if (historia.autorId === user.uid) return true;
  if (historia.creadoPor === user.uid) return true;

  const collaborators = getCollaborators(historia);
  return collaborators.includes(normalizeIdentity(user.uid)) ||
    collaborators.includes(normalizeIdentity(user.email));
};

export const userCanEditCollaborators = (user, historia) =>
  Boolean(
    user && (historia?.autorId === user.uid || historia?.creadoPor === user.uid)
  );

export const userCanDeleteWork = (user, obra, profile = {}) =>
  Boolean(
    user &&
      obra &&
      (isAdmin(profile) || obra.autorId === user.uid || obra.creadoPor === user.uid)
  );
