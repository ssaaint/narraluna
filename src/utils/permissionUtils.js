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

export const getCollaborators = (obra) =>
  normalizeCollaborators([
    ...(Array.isArray(obra?.colaboradoresPermitidos)
      ? obra.colaboradoresPermitidos
      : []),
    ...(Array.isArray(obra?.colaboradores) ? obra.colaboradores : [])
  ]);

export const getAuthorizedTranslators = (obra) =>
  normalizeCollaborators([
    ...(Array.isArray(obra?.traductoresAutorizados)
      ? obra.traductoresAutorizados
      : []),
    ...(Array.isArray(obra?.traductoresPermitidos)
      ? obra.traductoresPermitidos
      : [])
  ]);

export const isOwner = (obra, user) =>
  Boolean(
    user &&
      obra &&
      (obra.autorId === user.uid || obra.creadoPor === user.uid)
  );

export const isCollaborator = (obra, user) => {
  if (!user || !obra) return false;

  const collaborators = getCollaborators(obra);
  return (
    collaborators.includes(normalizeIdentity(user.uid)) ||
    collaborators.includes(normalizeIdentity(user.email))
  );
};

export const canEditWork = (obra, profile = {}, user) =>
  Boolean(user && obra && (isAdmin(profile) || isOwner(obra, user) || isCollaborator(obra, user)));

export const canManageCollaborators = (obra, profile = {}, user) =>
  Boolean(user && obra && (isAdmin(profile) || isOwner(obra, user)));

export const canDeleteWork = (obra, profile = {}, user) =>
  Boolean(user && obra && (isAdmin(profile) || isOwner(obra, user)));

export const canTranslate = (obra, profile = {}, user) => {
  if (!user || !obra) return false;

  const readChapters = Number(profile.capitulosLeidos || 0);
  const authorizedTranslators = getAuthorizedTranslators(obra);
  const manuallyAuthorized =
    authorizedTranslators.includes(normalizeIdentity(user.uid)) ||
    authorizedTranslators.includes(normalizeIdentity(user.email));
  const ownerCanTranslate =
    isOwner(obra, user) &&
    (obra.tipo === "obra_externa" ||
      obra.permiteTraducciones === true ||
      obra.estadoTraducible === true);

  return (
    isAdmin(profile) ||
    readChapters >= 100 ||
    profile.puedeTraducir === true ||
    manuallyAuthorized ||
    ownerCanTranslate
  );
};

export const canDeleteChapter = (obra, chapter, profile = {}, user) =>
  Boolean(
    user &&
      obra &&
      chapter &&
      (isAdmin(profile) ||
        isOwner(obra, user) ||
        isCollaborator(obra, user) ||
        chapter.autorId === user.uid ||
        chapter.creadoPor === user.uid ||
        chapter.traductorId === user.uid)
  );

// Backwards-compatible names used by older pages.
export const userCanManageStory = (user, historia, profile = {}) =>
  canEditWork(historia, profile, user);

export const userCanEditCollaborators = (user, historia, profile = {}) =>
  canManageCollaborators(historia, profile, user);

export const userCanDeleteWork = (user, obra, profile = {}) =>
  canDeleteWork(obra, profile, user);
