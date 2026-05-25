export const ALL_FILTER = "todos";

export const normalizeText = (value = "") =>
  String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

export const toList = (value) => {
  if (!value) return [];

  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }

  return String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
};

export const uniqueList = (items) =>
  [...new Set(items.filter(Boolean))].sort((a, b) => a.localeCompare(b));

export const getLikesCount = (historia) =>
  Array.isArray(historia.likes) ? historia.likes.length : 0;

export const getStoryGenres = (historia) => {
  const generos = [
    ...toList(historia.generos),
    ...toList(historia["géneros"]),
    ...toList(historia.genero),
    ...toList(historia["género"]),
    ...toList(historia.categoria),
    ...toList(historia["categoría"])
  ];

  const uniqueGenres = uniqueList(generos);
  return uniqueGenres.length ? uniqueGenres : ["Sin género"];
};

export const getStoryType = (historia) =>
  historia.tipo || historia.formato || "Historia";

export const getStoryTags = (historia) =>
  uniqueList([
    ...toList(historia.etiquetas),
    ...toList(historia.tags),
    ...toList(historia.tag)
  ]);

export const getStoryDescription = (historia) =>
  historia.descripcion ||
  historia["descripción"] ||
  historia.sinopsis ||
  historia.resumen ||
  "";

export const getStoryPreview = (historia) =>
  getStoryDescription(historia) || historia.contenido || "";

export const getStoryDateValue = (historia) => {
  const fecha = historia.fecha || historia.createdAt || historia.creado;

  if (!fecha) return 0;
  if (typeof fecha.toMillis === "function") return fecha.toMillis();
  if (typeof fecha.toDate === "function") return fecha.toDate().getTime();
  if (typeof fecha.seconds === "number") return fecha.seconds * 1000;

  const parsed = Date.parse(fecha);
  return Number.isNaN(parsed) ? 0 : parsed;
};

export const storyMatchesSearch = (historia, busqueda) => {
  const term = normalizeText(busqueda);
  if (!term) return true;

  const searchableFields = [
    historia.titulo,
    historia.autor,
    getStoryDescription(historia),
    ...getStoryGenres(historia),
    ...getStoryTags(historia)
  ];

  return searchableFields.some((field) => normalizeText(field).includes(term));
};

export const storyMatchesFilters = (historia, filtros) => {
  const storyGenres = getStoryGenres(historia).map(normalizeText);
  const storyType = normalizeText(getStoryType(historia));
  const likes = getLikesCount(historia);

  const matchesGenre =
    filtros.genero === ALL_FILTER ||
    storyGenres.includes(normalizeText(filtros.genero));

  const matchesType =
    filtros.tipo === ALL_FILTER || storyType === normalizeText(filtros.tipo);

  const matchesPopularity =
    filtros.popularidad === ALL_FILTER ||
    filtros.popularidad === "populares" ||
    (filtros.popularidad === "con-likes" && likes > 0) ||
    (filtros.popularidad === "sin-likes" && likes === 0);

  return matchesGenre && matchesType && matchesPopularity;
};

export const sortByLikes = (historias) =>
  [...historias].sort((a, b) => getLikesCount(b) - getLikesCount(a));

export const sortByDate = (historias) =>
  [...historias].sort((a, b) => getStoryDateValue(b) - getStoryDateValue(a));
