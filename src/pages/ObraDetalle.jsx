import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  orderBy,
  query,
  runTransaction,
  setDoc,
  updateDoc
} from "firebase/firestore";
import { auth, db } from "../firebase";
import { getChapterPreview, getDisplayChapters } from "../utils/chapterUtils";
import {
  TRANSLATION_STATUS_APPROVED,
  TRANSLATION_STATUS_PENDING,
  TRANSLATION_STATUS_REJECTED,
  TRANSLATOR_REQUIREMENT_MESSAGE,
  buildObraFromHistoria,
  getObraGenres,
  getObraStats,
  getObraTags,
  getObraTypeLabel,
  obraAllowsTranslations,
  userCanUploadTranslation
} from "../utils/obraUtils";
import {
  isAdmin,
  userCanDeleteWork,
  userCanManageStory
} from "../utils/permissionUtils";
import { getCreatorName } from "../utils/displayUtils";
import { safeFirestorePayload, textOrEmpty } from "../utils/firestoreSafe";

const sortByOrder = (items) =>
  [...items].sort((a, b) => {
    const orderA = Number(a.orden || a.numero || 0);
    const orderB = Number(b.orden || b.numero || 0);

    if (orderA || orderB) {
      return orderA - orderB;
    }

    return String(a.titulo || "").localeCompare(String(b.titulo || ""));
  });

const getStatusLabel = (estado) => {
  if (estado === TRANSLATION_STATUS_APPROVED || estado === "aprobado") {
    return "aprobada";
  }
  if (estado === TRANSLATION_STATUS_REJECTED || estado === "rechazado") {
    return "rechazada";
  }
  return TRANSLATION_STATUS_PENDING;
};

const getDateValue = (value) => {
  if (!value) return 0;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (typeof value.toDate === "function") return value.toDate().getTime();
  if (typeof value.seconds === "number") return value.seconds * 1000;

  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
};

const getTranslationLanguages = (traducciones) => [
  ...new Set(
    traducciones
      .map((traduccion) => String(traduccion.idiomaDestino || "").trim())
      .filter(Boolean)
  )
].sort((a, b) => a.localeCompare(b));

const getPersistableObra = (obra) => {
  const data = { ...obra };
  delete data.id;
  delete data.source;
  delete data.route;
  delete data.detailRoute;
  delete data.tipoLegible;
  return data;
};

const buildObraMirrorPayload = (obra) =>
  safeFirestorePayload({
    ...getPersistableObra(obra),
    tipo: obra.tipo || "original",
    autorId: obra.autorId || obra.creadoPor || "",
    creadoPor: obra.creadoPor || obra.autorId || "",
    colaboradoresPermitidos: Array.isArray(obra.colaboradoresPermitidos)
      ? obra.colaboradoresPermitidos
      : [],
    traductoresAutorizados: Array.isArray(obra.traductoresAutorizados)
      ? obra.traductoresAutorizados
      : [],
    permiteTraducciones: obra.permiteTraducciones === true,
    estadoTraducible: obra.estadoTraducible === true,
    vistas: Number(obra.vistas || obra.estadisticas?.vistas || 0) || 0,
    likesCount: Number(obra.likesCount || obra.estadisticas?.likesCount || 0) || 0,
    comentariosCount:
      Number(obra.comentariosCount || obra.estadisticas?.comentariosCount || 0) ||
      0,
    seguidoresCount:
      Number(obra.seguidoresCount || obra.estadisticas?.seguidoresCount || 0) || 0,
    estadisticas: {
      vistas: Number(obra.estadisticas?.vistas || obra.vistas || 0) || 0,
      likesCount: Number(obra.estadisticas?.likesCount || obra.likesCount || 0) || 0,
      comentariosCount:
        Number(obra.estadisticas?.comentariosCount || obra.comentariosCount || 0) ||
        0,
      seguidoresCount:
        Number(obra.estadisticas?.seguidoresCount || obra.seguidoresCount || 0) ||
        0,
      traduccionesCount:
        Number(obra.estadisticas?.traduccionesCount || obra.traduccionesCount || 0) ||
        0
    }
  });

export default function ObraDetalle() {
  const { obraId } = useParams();
  const navigate = useNavigate();

  const [obra, setObra] = useState(null);
  const [capitulos, setCapitulos] = useState([]);
  const [traducciones, setTraducciones] = useState([]);
  const [perfil, setPerfil] = useState({});
  const [loading, setLoading] = useState(true);
  const [legacyMode, setLegacyMode] = useState(false);
  const [likedByUser, setLikedByUser] = useState(false);
  const [siguiendo, setSiguiendo] = useState(false);
  const [comentarios, setComentarios] = useState([]);
  const [nuevoComentario, setNuevoComentario] = useState("");
  const [idiomaSeleccionado, setIdiomaSeleccionado] = useState("");
  const [actionBusy, setActionBusy] = useState(false);

  useEffect(() => {
    const cargarObra = async () => {
      try {
        const obraRef = doc(db, "obras", obraId);
        let obraSnap = null;
        let obraData = null;
        let capitulosPath = ["obras", obraId, "capitulos"];
        let isLegacy = false;

        try {
          obraSnap = await getDoc(obraRef);
        } catch {
          obraSnap = null;
        }

        if (obraSnap?.exists()) {
          const data = obraSnap.data();

          if (data.estado === "eliminada") {
            setObra(null);
            setCapitulos([]);
            setTraducciones([]);
            return;
          }

          obraData = {
            id: obraSnap.id,
            ...data
          };
        } else {
          const historiaSnap = await getDoc(doc(db, "historias", obraId));

          if (historiaSnap.exists()) {
            const data = historiaSnap.data();

            if (data.estado === "eliminada") {
              setObra(null);
              setCapitulos([]);
              setTraducciones([]);
              return;
            }

            obraData = buildObraFromHistoria({
              id: historiaSnap.id,
              ...data
            });
            capitulosPath = ["historias", obraId, "capitulos"];
            isLegacy = true;
          }
        }

        if (!obraData) {
          setObra(null);
          setCapitulos([]);
          setTraducciones([]);
          return;
        }

        const capitulosSnap = await getDocs(collection(db, ...capitulosPath));
        const capitulosData = getDisplayChapters(
          obraData,
          capitulosSnap.docs.map((capituloDoc) => ({
            id: capituloDoc.id,
            ...capituloDoc.data()
          }))
        );

        let traduccionesData = [];

        try {
          const traduccionesSnap = await getDocs(
            collection(db, "obras", obraId, "traducciones")
          );
          traduccionesData = await Promise.all(
            traduccionesSnap.docs.map(async (traduccionDoc) => {
              const capitulosTraduccionSnap = await getDocs(
                collection(
                  db,
                  "obras",
                  obraId,
                  "traducciones",
                  traduccionDoc.id,
                  "capitulos"
                )
              );

              return {
                id: traduccionDoc.id,
                ...traduccionDoc.data(),
                capitulos: sortByOrder(
                  capitulosTraduccionSnap.docs.map((capituloDoc) => ({
                    id: capituloDoc.id,
                    ...capituloDoc.data()
                  }))
                )
              };
            })
          );
        } catch {
          traduccionesData = [];
        }

        let perfilData = {};

        if (auth.currentUser) {
          try {
            const perfilSnap = await getDoc(doc(db, "usuarios", auth.currentUser.uid));
            perfilData = perfilSnap.exists() ? perfilSnap.data() : {};
          } catch {
            perfilData = {};
          }
        }

        let comentariosData = [];
        try {
          const comentariosSnap = await getDocs(
            query(collection(db, "obras", obraId, "comentarios"), orderBy("fecha", "asc"))
          );
          comentariosData = comentariosSnap.docs.map((comentarioDoc) => ({
            id: comentarioDoc.id,
            ...comentarioDoc.data()
          }));
        } catch {
          comentariosData = [];
        }

        let hasLike = false;
        let isFollowing = false;

        if (auth.currentUser) {
          try {
            const likeSnap = await getDoc(
              doc(db, "obras", obraId, "likes", auth.currentUser.uid)
            );
            hasLike = likeSnap.exists();
          } catch {
            hasLike = false;
          }

          try {
            const followedSnap = await getDoc(
              doc(db, "usuarios", auth.currentUser.uid, "seguidas", obraId)
            );
            isFollowing = followedSnap.exists();
          } catch {
            isFollowing = false;
          }
        }

        setObra(obraData);
        setCapitulos(capitulosData);
        setTraducciones(
          traduccionesData.sort(
            (a, b) => getDateValue(b.updatedAt || b.fecha) - getDateValue(a.updatedAt || a.fecha)
          )
        );
        setPerfil(perfilData);
        setComentarios(comentariosData);
        setLikedByUser(hasLike);
        setSiguiendo(isFollowing);
        setLegacyMode(isLegacy);

        const idiomas = getTranslationLanguages(traduccionesData);
        setIdiomaSeleccionado((current) => current || idiomas[0] || "");
      } catch (error) {
        console.error("Error completo:", error);
      } finally {
        setLoading(false);
      }
    };

    if (obraId) {
      cargarObra();
    }
  }, [obraId]);

  const stats = useMemo(() => getObraStats(obra || {}), [obra]);
  const statsWithLocal = useMemo(
    () => ({
      ...stats,
      comentariosCount: comentarios.length || stats.comentariosCount
    }),
    [comentarios.length, stats]
  );
  const permiteTraducciones = obraAllowsTranslations(obra || {});
  const canUploadTranslation = userCanUploadTranslation(
    auth.currentUser,
    perfil,
    obra || {}
  );
  const puedeEditar = userCanManageStory(auth.currentUser, obra || {}, perfil);
  const puedeBorrar = userCanDeleteWork(auth.currentUser, obra || {}, perfil);
  const admin = isAdmin(perfil);
  const generos = getObraGenres(obra || {});
  const etiquetas = getObraTags(obra || {});
  const idiomasTraduccion = useMemo(
    () => getTranslationLanguages(traducciones),
    [traducciones]
  );
  const traduccionesVisibles = useMemo(
    () =>
      idiomaSeleccionado
        ? traducciones.filter(
            (traduccion) => traduccion.idiomaDestino === idiomaSeleccionado
          )
        : traducciones,
    [idiomaSeleccionado, traducciones]
  );

  const ensureObraDocument = async () => {
    const obraRef = doc(db, "obras", obraId);
    const obraSnap = await getDoc(obraRef);

    if (!obraSnap.exists() && obra) {
      await setDoc(obraRef, buildObraMirrorPayload(obra), { merge: true });
    }

    return obraRef;
  };

  const toggleLikeObra = async () => {
    const currentUser = auth.currentUser;

    if (!currentUser) {
      alert("Tenes que iniciar sesion");
      return;
    }

    try {
      setActionBusy(true);
      const obraRef = await ensureObraDocument();
      const likeRef = doc(db, "obras", obraId, "likes", currentUser.uid);
      const nextLiked = await runTransaction(db, async (transaction) => {
        const likeSnap = await transaction.get(likeRef);

        if (likeSnap.exists()) {
          transaction.delete(likeRef);
          transaction.set(
            obraRef,
            {
              likesCount: increment(-1),
              "estadisticas.likesCount": increment(-1),
              fechaActualizacion: new Date(),
              updatedAt: new Date()
            },
            { merge: true }
          );
          return false;
        }

        transaction.set(
          likeRef,
          safeFirestorePayload({
            userId: currentUser.uid,
            email: currentUser.email || "",
            fecha: new Date()
          })
        );
        transaction.set(
          obraRef,
          {
            likesCount: increment(1),
            "estadisticas.likesCount": increment(1),
            fechaActualizacion: new Date(),
            updatedAt: new Date()
          },
          { merge: true }
        );
        return true;
      });

      setLikedByUser(nextLiked);
      setObra((current) => {
        if (!current) return current;
        const currentLikes = Number(
          current.likesCount || current.estadisticas?.likesCount || 0
        );
        const nextLikes = Math.max(0, currentLikes + (nextLiked ? 1 : -1));

        return {
          ...current,
          likesCount: nextLikes,
          estadisticas: {
            ...(current.estadisticas || {}),
            likesCount: nextLikes
          }
        };
      });
    } catch (error) {
      console.error("Error completo:", error);
      alert(error.message || "Error desconocido");
    } finally {
      setActionBusy(false);
    }
  };

  const toggleSeguirObra = async () => {
    const currentUser = auth.currentUser;

    if (!currentUser) {
      alert("Tenes que iniciar sesion");
      return;
    }

    try {
      setActionBusy(true);
      const obraRef = await ensureObraDocument();
      const followedRef = doc(db, "usuarios", currentUser.uid, "seguidas", obraId);
      const followerRef = doc(db, "obras", obraId, "seguidores", currentUser.uid);
      const nextFollowing = await runTransaction(db, async (transaction) => {
        const followedSnap = await transaction.get(followedRef);

        if (followedSnap.exists()) {
          transaction.delete(followedRef);
          transaction.delete(followerRef);
          transaction.set(
            obraRef,
            {
              seguidoresCount: increment(-1),
              "estadisticas.seguidoresCount": increment(-1),
              fechaActualizacion: new Date(),
              updatedAt: new Date()
            },
            { merge: true }
          );
          return false;
        }

        const followedPayload = safeFirestorePayload({
          obraId,
          titulo: obra?.titulo || "",
          portadaUrl: obra?.portadaUrl || obra?.portada || "",
          tipo: obra?.tipo || "original",
          ruta: `/obra/${obraId}`,
          fecha: new Date()
        });

        transaction.set(followedRef, followedPayload, { merge: true });
        transaction.set(
          followerRef,
          safeFirestorePayload({
            userId: currentUser.uid,
            email: currentUser.email || "",
            fecha: new Date()
          }),
          { merge: true }
        );
        transaction.set(
          obraRef,
          {
            seguidoresCount: increment(1),
            "estadisticas.seguidoresCount": increment(1),
            fechaActualizacion: new Date(),
            updatedAt: new Date()
          },
          { merge: true }
        );
        return true;
      });

      setSiguiendo(nextFollowing);
      setObra((current) => {
        if (!current) return current;
        const currentFollowers = Number(
          current.seguidoresCount || current.estadisticas?.seguidoresCount || 0
        );
        const nextFollowers = Math.max(
          0,
          currentFollowers + (nextFollowing ? 1 : -1)
        );

        return {
          ...current,
          seguidoresCount: nextFollowers,
          estadisticas: {
            ...(current.estadisticas || {}),
            seguidoresCount: nextFollowers
          }
        };
      });
    } catch (error) {
      console.error("Error completo:", error);
      alert(error.message || "Error desconocido");
    } finally {
      setActionBusy(false);
    }
  };

  const publicarComentario = async () => {
    const currentUser = auth.currentUser;
    const texto = textOrEmpty(nuevoComentario);

    if (!currentUser) {
      alert("Tenes que iniciar sesion");
      return;
    }

    if (!texto) {
      alert("El comentario no puede estar vacio.");
      return;
    }

    try {
      setActionBusy(true);
      const obraRef = await ensureObraDocument();
      const perfilSnap = await getDoc(doc(db, "usuarios", currentUser.uid));
      const perfilData = perfilSnap.exists() ? perfilSnap.data() : {};
      const nombre =
        textOrEmpty(perfilData.nombre) || currentUser.displayName || currentUser.email || "Usuario";
      const foto = textOrEmpty(perfilData.fotoUrl || perfilData.foto);
      const now = new Date();
      const comentarioPayload = safeFirestorePayload({
        texto,
        autorId: currentUser.uid,
        autorNombre: nombre,
        autorFoto: foto,
        fecha: now
      });
      const comentarioRef = await addDoc(
        collection(db, "obras", obraId, "comentarios"),
        comentarioPayload
      );

      await setDoc(
        obraRef,
        {
          comentariosCount: increment(1),
          "estadisticas.comentariosCount": increment(1),
          fechaActualizacion: now,
          updatedAt: now
        },
        { merge: true }
      );

      setComentarios((current) => [
        ...current,
        {
          id: comentarioRef.id,
          ...comentarioPayload
        }
      ]);
      setNuevoComentario("");
      setObra((current) => {
        if (!current) return current;
        const nextCount =
          Number(current.comentariosCount || current.estadisticas?.comentariosCount || 0) +
          1;

        return {
          ...current,
          comentariosCount: nextCount,
          estadisticas: {
            ...(current.estadisticas || {}),
            comentariosCount: nextCount
          }
        };
      });
    } catch (error) {
      console.error("Error completo:", error);
      alert(error.message || "Error desconocido");
    } finally {
      setActionBusy(false);
    }
  };

  const eliminarComentario = async (comentario) => {
    const currentUser = auth.currentUser;

    if (!currentUser) return;

    const puedeEliminar =
      admin || comentario.autorId === currentUser.uid;

    if (!puedeEliminar) return;

    try {
      setActionBusy(true);
      await deleteDoc(doc(db, "obras", obraId, "comentarios", comentario.id));
      await setDoc(
        doc(db, "obras", obraId),
        {
          comentariosCount: increment(-1),
          "estadisticas.comentariosCount": increment(-1),
          fechaActualizacion: new Date(),
          updatedAt: new Date()
        },
        { merge: true }
      );
      setComentarios((current) =>
        current.filter((item) => item.id !== comentario.id)
      );
      setObra((current) => {
        if (!current) return current;
        const nextCount = Math.max(
          0,
          Number(current.comentariosCount || current.estadisticas?.comentariosCount || 0) - 1
        );

        return {
          ...current,
          comentariosCount: nextCount,
          estadisticas: {
            ...(current.estadisticas || {}),
            comentariosCount: nextCount
          }
        };
      });
    } catch (error) {
      console.error("Error completo:", error);
      alert(error.message || "Error desconocido");
    } finally {
      setActionBusy(false);
    }
  };

  const actualizarEstadoTraduccion = async (traduccionId, estado) => {
    if (!admin) return;

    try {
      setActionBusy(true);
      await updateDoc(doc(db, "obras", obraId, "traducciones", traduccionId), {
        estado,
        updatedAt: new Date(),
        moderadoPor: auth.currentUser?.uid || ""
      });
      setTraducciones((current) =>
        current.map((traduccion) =>
          traduccion.id === traduccionId
            ? {
                ...traduccion,
                estado
              }
            : traduccion
        )
      );
    } catch (error) {
      console.error("Error completo:", error);
      alert(error.message || "Error desconocido");
    } finally {
      setActionBusy(false);
    }
  };

  const eliminarObra = async () => {
    const currentUser = auth.currentUser;

    if (!currentUser || !puedeBorrar) {
      alert("No tenes permisos para eliminar esta obra.");
      return;
    }

    const confirmed = window.confirm(
      "¿Seguro que querés eliminar esta obra? Esta acción no se puede deshacer."
    );

    if (!confirmed) return;

    try {
      setActionBusy(true);
      const now = new Date();
      await setDoc(
        doc(db, "obras", obraId),
        {
          estado: "eliminada",
          deletedAt: now,
          deletedBy: currentUser.uid,
          fechaActualizacion: now,
          updatedAt: now
        },
        { merge: true }
      );

      if (legacyMode) {
        try {
          await updateDoc(doc(db, "historias", obraId), {
            estado: "eliminada",
            deletedAt: now,
            deletedBy: currentUser.uid,
            updatedAt: now
          });
        } catch (legacyError) {
          console.error("No se pudo marcar la historia antigua como eliminada:", legacyError);
        }
      }

      navigate("/explorar");
    } catch (error) {
      console.error("Error completo:", error);
      alert(error.message || "Error desconocido");
    } finally {
      setActionBusy(false);
    }
  };

  if (loading) {
    return <p className="page">Cargando obra...</p>;
  }

  if (!obra) {
    return (
      <main className="page page-empty-state">
        <section className="empty-state empty-state-large">
          <p className="section-kicker">Biblioteca</p>
          <h1>Obra no encontrada</h1>
          <p>
            Puede haber sido eliminada, migrada o corresponder a datos antiguos
            que todavia no estan disponibles en esta vista.
          </p>
          <div className="hero-actions">
            <Link to="/explorar" className="btn-link btn-link-primary">
              Explorar biblioteca
            </Link>
            <Link to="/" className="btn-link btn-link-ghost">
              Ir al inicio
            </Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="page page-obra-detail">
      <section className="obra-hero">
        <div className="obra-cover">
          {obra.portadaUrl || obra.portada ? (
            <img
              src={obra.portadaUrl || obra.portada}
              alt={obra.titulo || "Portada"}
            />
          ) : (
            <span>{(obra.titulo || "U").slice(0, 1).toUpperCase()}</span>
          )}
        </div>

        <div className="obra-hero-main">
          <Link to="/explorar" className="text-link">
            Volver a explorar
          </Link>

          <p className="section-kicker">
            Obra / serie {legacyMode ? "compatibilidad" : getObraTypeLabel(obra.tipo)}
          </p>
          <h1>{obra.titulo || "Sin titulo"}</h1>
          <p className="story-detail-author">
            Ficha creada por {getCreatorName(obra)}
          </p>
          {obra.autorOriginal && (
            <p className="story-detail-author">
              Autor original: {obra.autorOriginal}
              {obra.idiomaOriginal ? ` - idioma original: ${obra.idiomaOriginal}` : ""}
              {obra.paisOrigen ? ` - ${obra.paisOrigen}` : ""}
            </p>
          )}
          <p className="story-detail-description">
            {obra.descripcion || "Esta obra todavia no tiene descripcion."}
          </p>

          <div className="story-detail-tags">
            <span>/{obra.slug || obra.id}</span>
            <span>{getObraTypeLabel(obra.tipo)}</span>
            {generos.map((genero) => (
              <span key={genero}>{genero}</span>
            ))}
            {etiquetas.map((etiqueta) => (
              <span key={etiqueta}>#{etiqueta}</span>
            ))}
          </div>

          {legacyMode && (
            <p className="permission-note">
              Esta vista se genera desde la coleccion historias para mantener
              compatibilidad con contenido anterior.
            </p>
          )}
        </div>

        <aside className="story-stats-card obra-stats-card">
          <span>
            <strong>{statsWithLocal.vistas}</strong>
            vistas
          </span>
          <span>
            <strong>{statsWithLocal.likesCount}</strong>
            likes
          </span>
          <span>
            <strong>{statsWithLocal.comentariosCount}</strong>
            comentarios
          </span>
          <span>
            <strong>{statsWithLocal.seguidoresCount}</strong>
            seguidores
          </span>

          {auth.currentUser && (
            <>
              <button
                type="button"
                className="btn-link btn-link-ghost"
                onClick={toggleLikeObra}
                disabled={actionBusy}
              >
                {likedByUser ? "Quitar like" : "Dar like"}
              </button>

              <button
                type="button"
                className="btn-link btn-follow-story"
                onClick={toggleSeguirObra}
                disabled={actionBusy}
              >
                {siguiendo ? "Siguiendo" : "Seguir"}
              </button>
            </>
          )}

          {puedeEditar && (
            <Link
              to={`/obra/${obra.id}/editar`}
              className="btn-link btn-link-ghost"
            >
              Editar obra
            </Link>
          )}

          {puedeBorrar && (
            <button
              type="button"
              className="btn-danger"
              onClick={eliminarObra}
              disabled={actionBusy}
            >
              Eliminar obra
            </button>
          )}

          {permiteTraducciones && canUploadTranslation ? (
            <Link
              to={`/obra/${obra.id}/subir-traduccion`}
              className="btn-link btn-link-primary"
            >
              Subir capitulo traducido
            </Link>
          ) : permiteTraducciones ? (
            <p className="translation-eligibility">
              {TRANSLATOR_REQUIREMENT_MESSAGE}
            </p>
          ) : null}
        </aside>
      </section>

      <section className="home-section">
        <div className="section-heading">
          <p className="section-kicker">Original</p>
          <h2>Capitulos originales</h2>
        </div>

        {capitulos.length > 0 ? (
          <div className="chapter-list">
            {capitulos.map((capitulo) => (
              <Link
                key={capitulo.id}
                to={`/obra/${obra.id}/capitulo/${capitulo.id}`}
                className="chapter-item"
              >
                <span>Capitulo {capitulo.numero || capitulo.orden || "?"}</span>
                <strong>{capitulo.titulo || "Sin titulo"}</strong>
                <p>{getChapterPreview(capitulo) || "Sin vista previa."}</p>
              </Link>
            ))}
          </div>
        ) : (
          <p className="empty-state">Todavia no hay capitulos originales.</p>
        )}
      </section>

      <section className="home-section">
        <div className="section-heading translation-heading-row">
          <div>
            <p className="section-kicker">Traducciones</p>
            <h2>Traducciones por idioma</h2>
          </div>

          {idiomasTraduccion.length > 0 && (
            <label className="filter-field translation-language-select">
              <span>Idioma</span>
              <select
                value={idiomaSeleccionado}
                onChange={(event) => setIdiomaSeleccionado(event.target.value)}
              >
                {idiomasTraduccion.map((idioma) => (
                  <option key={idioma} value={idioma}>
                    {idioma}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>

        {traduccionesVisibles.length > 0 ? (
          <div className="translation-grid">
            {traduccionesVisibles.map((traduccion) => (
              <article key={traduccion.id} className="translation-card">
                <div className="story-card-topline">
                  <span
                    className={`story-pill story-status story-status-${getStatusLabel(
                      traduccion.estado
                    )}`}
                  >
                    {getStatusLabel(traduccion.estado)}
                  </span>
                  {traduccion.idiomaDestino && (
                    <span className="story-pill story-pill-muted">
                      {traduccion.idiomaOrigen || "origen"} -{" "}
                      {traduccion.idiomaDestino}
                    </span>
                  )}
                </div>

                <h3>{traduccion.titulo || "Traduccion sin titulo"}</h3>
                <p>
                  Traductor:{" "}
                  {traduccion.traductorPrincipalNombre ||
                    traduccion.traductorEmail ||
                    "Usuario registrado"}
                </p>

                {admin && (
                  <div className="admin-actions">
                    <button
                      type="button"
                      className="btn-filter-reset"
                      onClick={() =>
                        actualizarEstadoTraduccion(
                          traduccion.id,
                          TRANSLATION_STATUS_APPROVED
                        )
                      }
                      disabled={actionBusy}
                    >
                      Aprobar
                    </button>
                    <button
                      type="button"
                      className="btn-danger btn-danger-soft"
                      onClick={() =>
                        actualizarEstadoTraduccion(
                          traduccion.id,
                          TRANSLATION_STATUS_REJECTED
                        )
                      }
                      disabled={actionBusy}
                    >
                      Rechazar
                    </button>
                  </div>
                )}

                {traduccion.capitulos?.length > 0 ? (
                  <div className="translated-chapter-list">
                    {traduccion.capitulos.map((capitulo) => (
                      <Link
                        key={capitulo.id}
                        to={`/obra/${obra.id}/traducciones/${traduccion.id}/capitulo/${capitulo.id}`}
                        className="translated-chapter-item"
                      >
                        <strong>{capitulo.titulo || "Capitulo traducido"}</strong>
                        <span>{getStatusLabel(capitulo.estado)}</span>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <p className="empty-state">Sin capitulos traducidos.</p>
                )}
              </article>
            ))}
          </div>
        ) : (
          <p className="empty-state">Todavia no hay traducciones para esta obra.</p>
        )}
      </section>

      <section className="home-section comments-section">
        <div className="section-heading">
          <p className="section-kicker">Comunidad</p>
          <h2>Comentarios</h2>
        </div>

        {auth.currentUser ? (
          <div className="comment-form">
            <textarea
              className="form-field full-width"
              rows={3}
              value={nuevoComentario}
              onChange={(event) => setNuevoComentario(event.target.value)}
              placeholder="Escribi un comentario sobre esta obra..."
            />
            <button
              type="button"
              onClick={publicarComentario}
              disabled={actionBusy}
            >
              Comentar
            </button>
          </div>
        ) : (
          <p className="empty-state">Inicia sesion para comentar esta obra.</p>
        )}

        {comentarios.length > 0 ? (
          <div className="comments-list obra-comments-list">
            {comentarios.map((comentario) => (
              <article key={comentario.id} className="comment-card obra-comment-card">
                <div className="comment-author-row">
                  <div className="story-author-avatar">
                    {comentario.autorFoto ? (
                      <img
                        src={comentario.autorFoto}
                        alt={comentario.autorNombre || "Usuario"}
                      />
                    ) : (
                      <span>
                        {(comentario.autorNombre || "U").slice(0, 1).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div>
                    <strong>{comentario.autorNombre || "Usuario"}</strong>
                    <p className="comment-author">
                      {getDateValue(comentario.fecha)
                        ? new Date(getDateValue(comentario.fecha)).toLocaleDateString()
                        : "Sin fecha"}
                    </p>
                  </div>
                </div>
                <p>{comentario.texto}</p>

                {(admin || comentario.autorId === auth.currentUser?.uid) && (
                  <button
                    type="button"
                    className="btn-danger btn-danger-soft"
                    onClick={() => eliminarComentario(comentario)}
                    disabled={actionBusy}
                  >
                    Eliminar comentario
                  </button>
                )}
              </article>
            ))}
          </div>
        ) : (
          <p className="empty-state">Todavia no hay comentarios en esta obra.</p>
        )}
      </section>
    </main>
  );
}
