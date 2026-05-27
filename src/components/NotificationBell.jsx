import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  writeBatch
} from "firebase/firestore";
import { db } from "../firebase";
import { NOTIFICATION_TYPES } from "../utils/notificationUtils";

const notificationLabels = {
  [NOTIFICATION_TYPES.NEW_CHAPTER]: "Capitulo",
  [NOTIFICATION_TYPES.NEW_COMMENT]: "Comentario",
  [NOTIFICATION_TYPES.NEW_LIKE]: "Like",
  [NOTIFICATION_TYPES.NEW_TRANSLATED_CHAPTER]: "Traduccion",
  [NOTIFICATION_TYPES.TRANSLATION_PENDING]: "Pendiente",
  [NOTIFICATION_TYPES.TRANSLATION_APPROVED]: "Aprobada"
};

const formatNotificationDate = (value) => {
  const date = value?.toDate?.();

  if (!date) {
    return "Ahora";
  }

  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
};

export default function NotificationBell({ user }) {
  const [open, setOpen] = useState(false);
  const [notificationsState, setNotificationsState] = useState({
    items: [],
    userId: ""
  });
  const wrapperRef = useRef(null);

  useEffect(() => {
    if (!user?.uid) {
      return undefined;
    }

    const notificationsQuery = query(
      collection(db, "usuarios", user.uid, "notificaciones"),
      orderBy("createdAt", "desc"),
      limit(20)
    );

    const unsubscribe = onSnapshot(
      notificationsQuery,
      (snapshot) => {
        setNotificationsState({
          userId: user.uid,
          items: snapshot.docs.map((notificationDoc) => ({
            id: notificationDoc.id,
            ...notificationDoc.data()
          }))
        });
      },
      (error) => {
        console.error(error);
      }
    );

    return () => unsubscribe();
  }, [user?.uid]);

  useEffect(() => {
    if (!open) return undefined;

    const handleOutsideClick = (event) => {
      if (!wrapperRef.current?.contains(event.target)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [open]);

  const notifications = useMemo(
    () =>
      notificationsState.userId === user?.uid ? notificationsState.items : [],
    [notificationsState.items, notificationsState.userId, user?.uid]
  );
  const loading = Boolean(user?.uid && notificationsState.userId !== user.uid);
  const unreadCount = useMemo(
    () => notifications.filter((notification) => !notification.leida).length,
    [notifications]
  );

  const markAsRead = async (notification) => {
    if (!user?.uid || !notification?.id || notification.leida) return;

    try {
      await updateDoc(
        doc(db, "usuarios", user.uid, "notificaciones", notification.id),
        {
          leida: true,
          leidaEn: serverTimestamp(),
          updatedAt: serverTimestamp()
        }
      );
    } catch (error) {
      console.error(error);
    }
  };

  const markAllAsRead = async () => {
    if (!user?.uid) return;

    const unreadNotifications = notifications.filter(
      (notification) => !notification.leida
    );

    if (unreadNotifications.length === 0) return;

    try {
      const batch = writeBatch(db);

      unreadNotifications.forEach((notification) => {
        batch.update(
          doc(db, "usuarios", user.uid, "notificaciones", notification.id),
          {
            leida: true,
            leidaEn: serverTimestamp(),
            updatedAt: serverTimestamp()
          }
        );
      });

      await batch.commit();
    } catch (error) {
      console.error(error);
    }
  };

  if (!user) {
    return null;
  }

  return (
    <div className="notification-wrapper" ref={wrapperRef}>
      <button
        type="button"
        className="notification-trigger"
        onClick={() => setOpen((current) => !current)}
        aria-label="Notificaciones"
        aria-expanded={open}
      >
        <span aria-hidden="true">&#128276;</span>
        {unreadCount > 0 && (
          <span className="notification-count">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="notifications-menu">
          <div className="notifications-header">
            <div>
              <strong>Notificaciones</strong>
              <span>{unreadCount} sin leer</span>
            </div>

            <button
              type="button"
              className="notification-read-all"
              onClick={markAllAsRead}
              disabled={unreadCount === 0}
            >
              Marcar leidas
            </button>
          </div>

          {loading ? (
            <p className="notification-empty">Cargando...</p>
          ) : notifications.length > 0 ? (
            <div className="notifications-list">
              {notifications.map((notification) => (
                <article
                  key={notification.id}
                  className={`notification-item ${
                    notification.leida ? "" : "notification-item-unread"
                  }`}
                >
                  <div className="notification-item-header">
                    <span>
                      {notificationLabels[notification.tipo] || "Aviso"}
                    </span>
                    <time>{formatNotificationDate(notification.createdAt)}</time>
                  </div>

                  <strong>{notification.titulo || "Notificacion"}</strong>
                  <p>{notification.mensaje}</p>

                  <div className="notification-actions">
                    {notification.link && (
                      <Link
                        to={notification.link}
                        onClick={() => {
                          markAsRead(notification);
                          setOpen(false);
                        }}
                      >
                        Abrir
                      </Link>
                    )}

                    {!notification.leida && (
                      <button
                        type="button"
                        onClick={() => markAsRead(notification)}
                      >
                        Leida
                      </button>
                    )}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className="notification-empty">No hay notificaciones.</p>
          )}
        </div>
      )}
    </div>
  );
}
