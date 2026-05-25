export const normalizeIdentity = (value = "") =>
  String(value).trim().includes("@")
    ? String(value).trim().toLowerCase()
    : String(value).trim();

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
  normalizeCollaborators(historia?.colaboradoresPermitidos || []);

export const userCanManageStory = (user, historia) => {
  if (!user || !historia) return false;
  if (historia.autorId === user.uid) return true;

  const collaborators = getCollaborators(historia);
  return collaborators.includes(normalizeIdentity(user.uid)) ||
    collaborators.includes(normalizeIdentity(user.email));
};

export const userCanEditCollaborators = (user, historia) =>
  Boolean(user && historia?.autorId === user.uid);
