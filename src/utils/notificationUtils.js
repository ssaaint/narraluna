import {
  addDoc,
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch
} from "firebase/firestore";
import { db } from "../firebase";

export const NOTIFICATION_TYPES = {
  NEW_CHAPTER: "nuevo_capitulo",
  NEW_COMMENT: "nuevo_comentario",
  NEW_LIKE: "nuevo_like",
  NEW_TRANSLATED_CHAPTER: "nuevo_capitulo_traducido",
  TRANSLATION_PENDING: "traduccion_pendiente",
  TRANSLATION_APPROVED: "traduccion_aprobada"
};

const getActorName = (actor) =>
  actor?.displayName || actor?.email || "Alguien";

const getStoryTitle = (historia) => historia?.titulo || "una historia";

const buildNotification = ({
  type,
  title,
  message,
  link,
  historiaId,
  historiaTitulo,
  actor,
  capituloId = "",
  capituloTitulo = ""
}) => ({
  tipo: type,
  titulo: title,
  mensaje: message,
  link,
  historiaId,
  historiaTitulo,
  capituloId,
  capituloTitulo,
  actorId: actor?.uid || "",
  actorEmail: actor?.email || "",
  leida: false,
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp()
});

export const createNotification = async (userId, notification, options = {}) => {
  if (!userId) return null;

  const notificationData = buildNotification(notification);

  if (options.id) {
    const notificationRef = doc(
      db,
      "usuarios",
      userId,
      "notificaciones",
      options.id
    );
    await setDoc(notificationRef, notificationData, { merge: true });
    return notificationRef;
  }

  return addDoc(
    collection(db, "usuarios", userId, "notificaciones"),
    notificationData
  );
};

export const notifyStoryOwnerOfLike = async ({ historiaId, historia, actor }) => {
  if (!historia?.autorId || historia.autorId === actor?.uid) return null;

  return createNotification(
    historia.autorId,
    {
      type: NOTIFICATION_TYPES.NEW_LIKE,
      title: "Nuevo like",
      message: `${getActorName(actor)} le dio like a ${getStoryTitle(historia)}.`,
      link: `/historia/${historiaId}`,
      historiaId,
      historiaTitulo: getStoryTitle(historia),
      actor
    },
    { id: `like_${historiaId}_${actor?.uid || "anon"}` }
  );
};

export const notifyStoryOwnerOfComment = async ({
  historiaId,
  historia,
  actor
}) => {
  if (!historia?.autorId || historia.autorId === actor?.uid) return null;

  return createNotification(historia.autorId, {
    type: NOTIFICATION_TYPES.NEW_COMMENT,
    title: "Nuevo comentario",
    message: `${getActorName(actor)} comento en ${getStoryTitle(historia)}.`,
    link: `/historia/${historiaId}`,
    historiaId,
    historiaTitulo: getStoryTitle(historia),
    actor
  });
};

export const notifyFollowersOfNewChapter = async ({
  historiaId,
  historia,
  capituloId,
  capitulo,
  actor
}) => {
  if (!historiaId || !capituloId) return 0;

  const followersSnap = await getDocs(
    query(
      collection(db, "usuarios"),
      where("historiasSeguidas", "array-contains", historiaId)
    )
  );
  const batch = writeBatch(db);
  let notificationCount = 0;

  followersSnap.forEach((userDoc) => {
    if (userDoc.id === actor?.uid) return;

    const notificationRef = doc(
      db,
      "usuarios",
      userDoc.id,
      "notificaciones",
      `chapter_${historiaId}_${capituloId}`
    );

    batch.set(
      notificationRef,
      buildNotification({
        type: NOTIFICATION_TYPES.NEW_CHAPTER,
        title: "Nuevo capitulo",
        message: `Nuevo capitulo en ${getStoryTitle(historia)}: ${
          capitulo?.titulo || "un nuevo capitulo"
        }.`,
        link: `/historia/${historiaId}/capitulo/${capituloId}`,
        historiaId,
        historiaTitulo: getStoryTitle(historia),
        capituloId,
        capituloTitulo: capitulo?.titulo || "",
        actor
      }),
      { merge: true }
    );
    notificationCount += 1;
  });

  if (notificationCount > 0) {
    await batch.commit();
  }

  return notificationCount;
};
