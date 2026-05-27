import {
  getCommentsCount,
  getLikesCount,
  getStoryDescription,
  getStoryGenres,
  getStoryTags,
  getStoryType,
  toList,
  uniqueList
} from "./storyUtils";
import { createSlug, getStorySlug } from "./slugUtils";
import {
  canTranslate,
  getAuthorizedTranslators
} from "./permissionUtils";

export const OBRA_TYPE_ORIGINAL = "original";
export const OBRA_TYPE_TRANSLATION = "traduccion";
export const OBRA_TYPE_MIXED = "mixta";
export const OBRA_TYPE_EXTERNAL = "obra_externa";

export const TRANSLATION_STATUS_PENDING = "pendiente";
export const TRANSLATION_STATUS_APPROVED = "aprobada";
export const TRANSLATION_STATUS_REJECTED = "rechazada";

export const MIN_CHAPTERS_TO_TRANSLATE = 100;

export const TRANSLATOR_REQUIREMENT_MESSAGE =
  "Necesitas haber leido al menos 100 capitulos o ser aprobado como traductor para subir traducciones.";

export const getObraGenres = (obra) => {
  const generos = uniqueList([
    ...toList(obra?.generos),
    ...toList(obra?.genero),
    ...toList(obra?.categoria)
  ]);

  return generos.length ? generos : ["Sin genero"];
};

export const getObraTags = (obra) =>
  uniqueList([
    ...toList(obra?.etiquetas),
    ...toList(obra?.tags),
    ...toList(obra?.tag)
  ]);

export const getObraStats = (obra = {}) => ({
  vistas: Number(obra.estadisticas?.vistas ?? obra.vistas ?? 0) || 0,
  likesCount:
    Number(
      obra.estadisticas?.likesCount ??
        obra.likesCount ??
        (Array.isArray(obra.likes) ? obra.likes.length : 0)
    ) || 0,
  comentariosCount:
    Number(
      obra.estadisticas?.comentariosCount ??
        obra.comentariosCount ??
        (Array.isArray(obra.comentarios) ? obra.comentarios.length : 0)
    ) || 0,
  seguidoresCount:
    Number(obra.estadisticas?.seguidoresCount ?? obra.seguidoresCount ?? 0) || 0,
  traduccionesCount:
    Number(obra.estadisticas?.traduccionesCount ?? obra.traduccionesCount ?? 0) ||
    0
});

export const getObraTypeLabel = (tipo = OBRA_TYPE_ORIGINAL) => {
  if (tipo === OBRA_TYPE_TRANSLATION) return "Traduccion";
  if (tipo === OBRA_TYPE_MIXED) return "Mixta";
  if (tipo === OBRA_TYPE_EXTERNAL) return "Obra externa";
  return "Original";
};

export const obraAllowsTranslations = (obra = {}) => {
  const tipo = obra.tipo || OBRA_TYPE_ORIGINAL;

  return (
    tipo === OBRA_TYPE_EXTERNAL ||
    obra.permiteTraducciones === true ||
    obra.estadoTraducible === true
  );
};

export const getManualTranslators = (obra = {}) =>
  uniqueList(getAuthorizedTranslators(obra));

export const userCanUploadTranslation = (user, perfil = {}, obra = {}) => {
  if (!user) return false;
  return canTranslate(obra, perfil, user);
};

export const buildObraFromHistoria = (historia = {}) => ({
  id: historia.id,
  titulo: historia.titulo || "Sin titulo",
  slug: getStorySlug(historia),
  descripcion: getStoryDescription(historia) || historia.contenido || "",
  generos: getStoryGenres(historia),
  etiquetas: getStoryTags(historia),
  portada: historia.portadaUrl || historia.portada || "",
  portadaUrl: historia.portadaUrl || historia.portada || "",
  contenido: historia.contenido || "",
  tipo: [OBRA_TYPE_EXTERNAL, OBRA_TYPE_MIXED].includes(historia.tipo)
    ? historia.tipo
    : OBRA_TYPE_ORIGINAL,
  autorId: historia.autorId || historia.creadoPor || "",
  creadoPor: historia.creadoPor || historia.autorId || "",
  autor: historia.autor || historia.autorNombre || "Autor desconocido",
  autorNombre: historia.autorNombre || historia.autor || "",
  autorFoto: historia.autorFoto || historia.fotoAutor || "",
  creadoPorNombre: historia.creadoPorNombre || historia.autorNombre || historia.autor || "",
  creadoPorFoto: historia.creadoPorFoto || historia.autorFoto || historia.fotoAutor || "",
  colaboradoresPermitidos: historia.colaboradoresPermitidos || [],
  traductoresAutorizados: historia.traductoresAutorizados || [],
  permiteTraducciones: historia.permiteTraducciones === true,
  estadoTraducible: historia.estadoTraducible === true,
  historiaLegacyId: historia.id,
  legacySource: "historias",
  estadisticas: {
    vistas: Number(historia.vistas || historia.views || 0) || 0,
    likesCount: getLikesCount(historia),
    comentariosCount: getCommentsCount(historia),
    seguidoresCount: Number(historia.seguidoresCount || 0) || 0,
    traduccionesCount: 0
  },
  fecha: historia.fecha || new Date(),
  updatedAt: historia.updatedAt || new Date(),
  tipoLegible: getStoryType(historia)
});

export const buildObraSlug = (value) => createSlug(value);
