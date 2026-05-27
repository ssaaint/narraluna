import {
  STORY_TYPE_ORIGINAL,
  STORY_TYPE_TRANSLATION,
  STORY_TYPE_EXTERNAL_WORK,
  getCommentsCount,
  getLikesCount,
  getStoryDescription,
  getStoryGenres,
  getStoryTags,
  getViewsCount
} from "./storyUtils";
import { getStorySlug } from "./slugUtils";

const normalizeContentType = (tipo) => {
  if (tipo === STORY_TYPE_TRANSLATION) return STORY_TYPE_TRANSLATION;
  if (tipo === STORY_TYPE_EXTERNAL_WORK) return STORY_TYPE_EXTERNAL_WORK;
  return STORY_TYPE_ORIGINAL;
};

export const normalizeObraItem = (id, data = {}) => ({
  id,
  source: "obras",
  ...data,
  route: `/obra/${id}`,
  titulo: data.titulo || "Sin titulo",
  slug: data.slug || getStorySlug(data),
  tipo: normalizeContentType(data.tipo),
  descripcion: getStoryDescription(data),
  generos: getStoryGenres(data),
  etiquetas: getStoryTags(data),
  portada: data.portadaUrl || data.portada || "",
  portadaUrl: data.portadaUrl || data.portada || "",
  autor: data.autor || data.autorNombre || data.creadoPorNombre || "Autor desconocido",
  autorId: data.autorId || data.creadoPor || "",
  creadoPor: data.creadoPor || data.autorId || "",
  autorNombre: data.autorNombre || data.autor || data.creadoPorNombre || "",
  autorFoto: data.autorFoto || data.fotoAutor || data.creadoPorFoto || "",
  fotoAutor: data.fotoAutor || data.autorFoto || data.creadoPorFoto || "",
  colaboradoresPermitidos: data.colaboradoresPermitidos || [],
  traductoresAutorizados: data.traductoresAutorizados || [],
  permiteTraducciones: data.permiteTraducciones === true,
  estadoTraducible: data.estadoTraducible === true,
  historiaLegacyId: data.historiaLegacyId || "",
  autorOriginal: data.autorOriginal || "",
  idiomaOriginal: data.idiomaOriginal || "",
  paisOrigen: data.paisOrigen || "",
  fecha: data.fecha || data.fechaCreacion || null,
  fechaCreacion: data.fechaCreacion || data.fecha || null,
  fechaActualizacion: data.fechaActualizacion || data.updatedAt || data.fecha || null,
  updatedAt: data.updatedAt || data.fechaActualizacion || null,
  vistas: getViewsCount(data),
  likesCount: getLikesCount(data),
  comentariosCount: getCommentsCount(data),
  seguidoresCount:
    Number(data.seguidoresCount ?? data.estadisticas?.seguidoresCount ?? 0) || 0,
  estadisticas: {
    vistas: getViewsCount(data),
    likesCount: getLikesCount(data),
    comentariosCount: getCommentsCount(data),
    seguidoresCount:
      Number(data.seguidoresCount ?? data.estadisticas?.seguidoresCount ?? 0) || 0,
    traduccionesCount:
      Number(data.traduccionesCount ?? data.estadisticas?.traduccionesCount ?? 0) ||
      0
  },
  legacySource: data.legacySource || ""
});

export const normalizeLegacyHistoriaItem = (id, data = {}) => ({
  id,
  source: "historias",
  ...data,
  route: `/obra/${id}`,
  titulo: data.titulo || "Sin titulo",
  slug: data.slug || getStorySlug(data),
  tipo: normalizeContentType(data.tipo),
  descripcion: getStoryDescription(data) || data.contenido || "",
  generos: getStoryGenres(data),
  etiquetas: getStoryTags(data),
  portada: data.portadaUrl || data.portada || "",
  portadaUrl: data.portadaUrl || data.portada || "",
  autor: data.autor || data.autorNombre || "Autor desconocido",
  autorId: data.autorId || data.creadoPor || "",
  creadoPor: data.creadoPor || data.autorId || "",
  autorNombre: data.autorNombre || data.autor || "",
  autorFoto: data.autorFoto || data.fotoAutor || "",
  fotoAutor: data.fotoAutor || data.autorFoto || "",
  colaboradoresPermitidos: data.colaboradoresPermitidos || [],
  traductoresAutorizados: data.traductoresAutorizados || [],
  permiteTraducciones: data.permiteTraducciones === true,
  estadoTraducible: data.estadoTraducible === true,
  historiaLegacyId: id,
  legacySource: "historias",
  fecha: data.fecha || data.fechaCreacion || null,
  fechaCreacion: data.fechaCreacion || data.fecha || null,
  fechaActualizacion: data.fechaActualizacion || data.updatedAt || data.fecha || null,
  updatedAt: data.updatedAt || data.fechaActualizacion || null,
  vistas: getViewsCount(data),
  likesCount: getLikesCount(data),
  comentariosCount: getCommentsCount(data),
  seguidoresCount:
    Number(data.seguidoresCount ?? data.estadisticas?.seguidoresCount ?? 0) || 0,
  estadisticas: {
    vistas: getViewsCount(data),
    likesCount: getLikesCount(data),
    comentariosCount: getCommentsCount(data),
    seguidoresCount:
      Number(data.seguidoresCount ?? data.estadisticas?.seguidoresCount ?? 0) || 0,
    traduccionesCount:
      Number(data.traduccionesCount ?? data.estadisticas?.traduccionesCount ?? 0) ||
      0
  }
});

export const buildLibraryItems = (obrasDocs = [], historiasDocs = []) => {
  const obras = obrasDocs.map((obraDoc) =>
    normalizeObraItem(obraDoc.id, obraDoc.data())
  ).filter((obra) => obra.estado !== "eliminada");
  const obraIds = new Set(obras.map((obra) => obra.id));
  const migratedLegacyIds = new Set(
    obras.map((obra) => obra.historiaLegacyId).filter(Boolean)
  );
  const legacyHistorias = historiasDocs
    .filter(
      (historiaDoc) =>
        !obraIds.has(historiaDoc.id) && !migratedLegacyIds.has(historiaDoc.id)
    )
    .map((historiaDoc) =>
      normalizeLegacyHistoriaItem(historiaDoc.id, historiaDoc.data())
    )
    .filter((historia) => historia.estado !== "eliminada");

  return [...obras, ...legacyHistorias];
};
