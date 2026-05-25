export const LEGACY_CHAPTER_ID = "legacy";

export const sortChapters = (capitulos) =>
  [...capitulos].sort((a, b) => {
    const orderA = Number.isFinite(Number(a.orden)) ? Number(a.orden) : 0;
    const orderB = Number.isFinite(Number(b.orden)) ? Number(b.orden) : 0;

    if (orderA !== orderB) return orderA - orderB;

    return String(a.titulo || "").localeCompare(String(b.titulo || ""));
  });

export const getDisplayChapters = (historia, capitulos) => {
  const sortedChapters = sortChapters(capitulos);
  const legacyChapter = historia?.contenido
    ? {
        id: LEGACY_CHAPTER_ID,
        orden: 1,
        titulo: "Capítulo único",
        contenido: historia.contenido,
        legacy: true
      }
    : null;

  if (legacyChapter && sortedChapters.length > 0) {
    return [
      legacyChapter,
      ...sortedChapters.map((capitulo, index) => ({
        ...capitulo,
        orden: index + 2,
        titulo: capitulo.titulo || `Capítulo ${index + 2}`
      }))
    ];
  }

  if (sortedChapters.length > 0) {
    return sortedChapters.map((capitulo, index) => ({
      ...capitulo,
      orden: capitulo.orden || index + 1,
      titulo: capitulo.titulo || `Capítulo ${index + 1}`
    }));
  }

  if (legacyChapter) {
    return [legacyChapter];
  }

  return [];
};

export const getChapterPreview = (capitulo, length = 140) => {
  const text = capitulo?.descripcion || capitulo?.contenido || "";
  return text.length > length ? `${text.slice(0, length)}...` : text;
};
