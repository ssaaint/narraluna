import { STORY_TYPE_TRANSLATION, isTranslation } from "./storyUtils.js";

export const translationStates = ["pendiente", "aprobada", "rechazada"];

export const canUploadTranslatedChapter = (user, historia) =>
  Boolean(user && isTranslation(historia));

export const isTranslationType = (tipo) => tipo === STORY_TYPE_TRANSLATION;
