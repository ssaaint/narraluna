import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  arrayRemove,
  arrayUnion,
  collection,
  doc,
  getCountFromServer,
  getDoc,
  getDocs,
  orderBy,
  query,
  runTransaction,
  setDoc,
  updateDoc
} from "firebase/firestore";
import { auth, db } from "../firebase";
import {
  LEGACY_CHAPTER_ID,
  getChapterPreview,
  getDisplayChapters
} from "../utils/chapterUtils";
import {
  getCommentsCount,
  getLikesCount,
  getStoryDescription,
  getStoryGenres,
  getStoryStatus,
  getStoryTags,
  getStoryType,
  isTranslation
} from "../utils/storyUtils";
import { getStorySlug } from "../utils/slugUtils";
import {
  getCollaborators,
  normalizeCollaborators,
  userCanEditCollaborators,
  userCanManageStory
} from "../utils/permissionUtils";
import { canUploadTranslatedChapter } from "../utils/translationUtils";
import {
  notifyStoryOwnerOfComment,
  notifyStoryOwnerOfLike
} from "../utils/notificationUtils";

const getCommentDateValue = (comentario) => {
  const fecha = comentario?.fecha || comentario?.createdAt;

  if (!fecha) return 0;
  if (typeof fecha.toMillis === "function") return fecha.toMillis();
  if (typeof fecha.toDate === "function") return fecha.toDate().getTime();
  if (typeof fecha.seconds === "number") return fecha.seconds * 1000;

  const parsed = Date.parse(fecha);
  return Number.isNaN(parsed) ? 0 : parsed;
};

const sortComments = (comentarios) =>
  [...comentarios].sort(
    (a, b) => getCommentDateValue(a) - getCommentDateValue(b)
  );

const getLegacyComments = (historia) =>
  Array.isArray(historia.comentarios)
    ? historia.comentarios.map((comentario, index) => ({
        id: `legacy-${index}`,
        legacy: true,
        scope: "historia",
        ...comentario
      }))
    : [];

export default function HistoriaDetalle() {
  const { id } = useParams();

  const [historia, setHistoria] = useState(null);
  const [capitulos, setCapitulos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [likesCount, setLikesCount] = useState(0);
  const [likedByUser, setLikedByUser] = useState(false);
  const [comentarios, setComentarios] = useState([]);
  const [comentariosCount, setComentariosCount] = useState(0);
  const [nuevoComentario, setNuevoComentario] = useState("");
  const [colaboradoresInput, setColaboradoresInput] = useState("");
  const [siguiendo, setSiguiendo] = useState(false);

  useEffect(() => {
    const cargarHistoria = async () => {
      try {
        const historiaRef = doc(db, "historias", id);
        const historiaSnap = await getDoc(historiaRef);

        if (!historiaSnap.exists()) {
          setHistoria(null);
          return;
        }

        const historiaData = {
          id: historiaSnap.id,
          ...historiaSnap.data()
        };

        const capitulosSnap = await getDocs(
          collection(db, "historias", id, "capitulos")
        );

        const capitulosData = capitulosSnap.docs.map((capituloDoc) => ({
          id: capituloDoc.id,
          ...capituloDoc.data()
        }));
        const legacyLikes = Array.isArray(historiaData.likes)
          ? historiaData.likes
          : [];
        const legacyComments = getLegacyComments(historiaData);
        let likesSubcollectionCount = 0;
        let commentsSubcollectionCount = 0;
        let storyComments = [];
        let userLiked = false;

        try {
          const likesCountSnap = await getCountFromServer(
            collection(db, "historias", id, "likes")
          );
          likesSubcollectionCount = likesCountSnap.data().count;
        } catch {
          likesSubcollectionCount = 0;
        }

        try {
          const commentsCountSnap = await getCountFromServer(
            collection(db, "historias", id, "comentarios")
          );
          commentsSubcollectionCount = commentsCountSnap.data().count;
        } catch {
          commentsSubcollectionCount = 0;
        }

        try {
          const commentsSnap = await getDocs(
            query(
              collection(db, "historias", id, "comentarios"),
              orderBy("fecha", "asc")
            )
          );
          storyComments = commentsSnap.docs
            .map((comentarioDoc) => ({
              id: comentarioDoc.id,
              ...comentarioDoc.data()
            }))
            .filter((comentario) => !comentario.capituloId);
        } catch {
          storyComments = [];
        }

        if (auth.currentUser) {
          try {
            const likeSnap = await getDoc(
              doc(db, "historias", id, "likes", auth.currentUser.uid)
            );
            userLiked =
              likeSnap.exists() || legacyLikes.includes(auth.currentUser.uid);
          } catch {
            userLiked = legacyLikes.includes(auth.currentUser.uid);
          }
        }

        setHistoria(historiaData);
        setCapitulos(getDisplayChapters(historiaData, capitulosData));
        setLikesCount(
          Math.max(getLikesCount(historiaData), likesSubcollectionCount)
        );
        setLikedByUser(userLiked);
        setComentarios(sortComments([...legacyComments, ...storyComments]));
        setComentariosCount(
          Math.max(
            getCommentsCount(historiaData),
            legacyComments.length + commentsSubcollectionCount
          )
        );
        setColaboradoresInput(getCollaborators(historiaData).join("\n"));

        if (auth.currentUser) {
          const perfilSnap = await getDoc(doc(db, "usuarios", auth.currentUser.uid));
          const perfilData = perfilSnap.exists() ? perfilSnap.data() : {};
          setSiguiendo((perfilData.historiasSeguidas || []).includes(id));
        } else {
          setSiguiendo(false);
        }
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      cargarHistoria();
    }
  }, [id]);

  const toggleLike = async () => {
    if (!auth.currentUser) {
      alert("Tenes que iniciar sesion");
      return;
    }

    const userId = auth.currentUser.uid;
    const historiaRef = doc(db, "historias", id);
    const likeRef = doc(db, "historias", id, "likes", userId);

    try {
      const resultado = await runTransaction(db, async (transaction) => {
        const historiaTransactionSnap = await transaction.get(historiaRef);
        const likeSnap = await transaction.get(likeRef);

        if (!historiaTransactionSnap.exists()) {
          throw new Error("La historia ya no existe");
        }

        const historiaActual = historiaTransactionSnap.data();
        const legacyLikes = Array.isArray(historiaActual.likes)
          ? historiaActual.likes
          : [];
        const yaDioLike = likeSnap.exists() || legacyLikes.includes(userId);
        const conteoActual = Math.max(getLikesCount(historiaActual), likesCount);
        const siguienteConteo = yaDioLike
          ? Math.max(conteoActual - 1, 0)
          : conteoActual + 1;

        if (yaDioLike) {
          if (likeSnap.exists()) {
            transaction.delete(likeRef);
          }

          transaction.update(historiaRef, {
            likes: arrayRemove(userId),
            likesCount: siguienteConteo,
            updatedAt: new Date()
          });
        } else {
          transaction.set(likeRef, {
            userId,
            userEmail: auth.currentUser.email,
            fecha: new Date()
          });
          transaction.update(historiaRef, {
            likesCount: siguienteConteo,
            updatedAt: new Date()
          });
        }

        return {
          liked: !yaDioLike,
          likesCount: siguienteConteo,
          shouldNotify: !yaDioLike
        };
      });

      setLikedByUser(resultado.liked);
      setLikesCount(resultado.likesCount);

      if (resultado.shouldNotify) {
        try {
          await notifyStoryOwnerOfLike({
            historiaId: id,
            historia,
            actor: auth.currentUser
          });
        } catch (notificationError) {
          console.error(notificationError);
        }
      }
    } catch (error) {
      console.error(error);
    }
  };

  const agregarComentario = async () => {
    if (!auth.currentUser) {
      alert("Tenes que iniciar sesion");
      return;
    }

    const texto = nuevoComentario.trim();

    if (!texto) return;

    const comentario = {
      texto,
      autorId: auth.currentUser.uid,
      autor: auth.currentUser.email,
      scope: "historia",
      capituloId: "",
      capituloTitulo: "",
      fecha: new Date()
    };

    try {
      const historiaRef = doc(db, "historias", id);
      const comentarioRef = doc(collection(db, "historias", id, "comentarios"));

      const siguienteConteo = await runTransaction(db, async (transaction) => {
        const historiaTransactionSnap = await transaction.get(historiaRef);

        if (!historiaTransactionSnap.exists()) {
          throw new Error("La historia ya no existe");
        }

        const historiaActual = historiaTransactionSnap.data();
        const conteoActual = Math.max(
          getCommentsCount(historiaActual),
          comentariosCount
        );

        transaction.set(comentarioRef, comentario);
        transaction.update(historiaRef, {
          comentariosCount: conteoActual + 1,
          updatedAt: new Date()
        });

        return conteoActual + 1;
      });

      setComentarios((current) =>
        sortComments([...current, { id: comentarioRef.id, ...comentario }])
      );
      setComentariosCount(siguienteConteo);
      setNuevoComentario("");

      try {
        await notifyStoryOwnerOfComment({
          historiaId: id,
          historia,
          actor: auth.currentUser
        });
      } catch (notificationError) {
        console.error(notificationError);
      }
    } catch (error) {
      console.error(error);
    }
  };

  const guardarColaboradores = async () => {
    if (!userCanEditCollaborators(auth.currentUser, historia)) {
      alert("Solo el creador puede editar colaboradores");
      return;
    }

    const colaboradoresPermitidos = normalizeCollaborators(colaboradoresInput);

    try {
      await updateDoc(doc(db, "historias", id), {
        colaboradoresPermitidos,
        updatedAt: new Date()
      });

      setHistoria((current) => ({
        ...current,
        colaboradoresPermitidos
      }));
      setColaboradoresInput(colaboradoresPermitidos.join("\n"));
      alert("Colaboradores actualizados");
    } catch (error) {
      console.error(error);
      alert("Error al guardar colaboradores");
    }
  };

  const toggleSeguirHistoria = async () => {
    if (!auth.currentUser) {
      alert("Tenes que iniciar sesion");
      return;
    }

    const perfilRef = doc(db, "usuarios", auth.currentUser.uid);

    try {
      if (siguiendo) {
        await setDoc(
          perfilRef,
          {
            historiasSeguidas: arrayRemove(id),
            updatedAt: new Date()
          },
          { merge: true }
        );
        setSiguiendo(false);
      } else {
        const perfilSnap = await getDoc(perfilRef);
        const perfilData = perfilSnap.exists() ? perfilSnap.data() : {};
        const cambiosPerfil = {
          historiasSeguidas: arrayUnion(id),
          updatedAt: new Date()
        };

        if (!perfilData.progresoLectura?.[id]) {
          cambiosPerfil[`progresoLectura.${id}`] = {
            historiaId: id,
            titulo: historia.titulo || "",
            ultimoCapituloId: "",
            ultimoCapituloTitulo: "",
            ultimoCapituloOrden: 0,
            vistoEn: null
          };
        }

        await setDoc(
          perfilRef,
          cambiosPerfil,
          { merge: true }
        );
        setSiguiendo(true);
      }
    } catch (error) {
      console.error(error);
      alert("No se pudo actualizar el seguimiento");
    }
  };

  if (loading) {
    return <p className="page">Cargando historia...</p>;
  }

  if (!historia) {
    return <p className="page">No se encontro la historia</p>;
  }

  const descripcion =
    getStoryDescription(historia) ||
    (historia.contenido
      ? `${historia.contenido.slice(0, 180)}...`
      : "Esta historia todavia no tiene descripcion.");
  const etiquetas = getStoryTags(historia);
  const puedeGestionar = userCanManageStory(auth.currentUser, historia);
  const puedeSubirTraduccion = canUploadTranslatedChapter(auth.currentUser, historia);
  const puedeEditarColaboradores = userCanEditCollaborators(
    auth.currentUser,
    historia
  );
  const colaboradores = getCollaborators(historia);

  return (
    <main className="page page-story-detail">
      <section className="story-detail-hero">
        <div>
          <div className="story-detail-links">
            <Link to="/" className="text-link">
              Volver a explorar
            </Link>
            <Link to={`/obra/${id}`} className="text-link">
              Ver obra/serie
            </Link>
          </div>

          <p className="section-kicker">{getStoryType(historia)}</p>
          <h1>{historia.titulo || "Sin titulo"}</h1>
          <p className="story-detail-author">
            por {historia.autor || "Autor desconocido"}
          </p>
          <div className="story-detail-cover">
            {historia.portada ? (
              <img src={historia.portada} alt={historia.titulo || "Portada"} />
            ) : (
              <span>{(historia.titulo || "N").slice(0, 1).toUpperCase()}</span>
            )}
          </div>
          <p className="story-detail-description">{descripcion}</p>

          {isTranslation(historia) && (
            <p className="story-translation-origin">
              Traduccion de {historia.historiaOriginalTitulo || "historia original"}
              {historia.idiomaDestino ? ` · idioma destino: ${historia.idiomaDestino}` : ""}
            </p>
          )}

          <div className="story-detail-tags">
            <span>/{getStorySlug(historia)}</span>
            {getStoryStatus(historia) && (
              <span className={`story-status story-status-${getStoryStatus(historia)}`}>
                {getStoryStatus(historia)}
              </span>
            )}
            {getStoryGenres(historia).map((genero) => (
              <span key={genero}>{genero}</span>
            ))}
            {etiquetas.map((etiqueta) => (
              <span key={etiqueta}>#{etiqueta}</span>
            ))}
          </div>
        </div>

        <aside className="story-stats-card">
          <span>
            <strong>{likesCount}</strong>
            likes
          </span>
          <span>
            <strong>{comentariosCount}</strong>
            comentarios
          </span>
          <span>
            <strong>{capitulos.length}</strong>
            capitulos
          </span>
          <span>
            <strong>{colaboradores.length}</strong>
            colaboradores
          </span>

          <button onClick={toggleLike}>
            {likedByUser ? "Quitar Like" : "Me gusta"}
          </button>

          <button onClick={toggleSeguirHistoria} className="btn-follow-story">
            {siguiendo ? "Dejar de seguir" : "Seguir historia"}
          </button>

          {(puedeGestionar || puedeSubirTraduccion) && (
            <Link
              to={`/historia/${id}/nuevo-capitulo`}
              className="btn-link btn-link-primary"
            >
              {isTranslation(historia) ? "Subir capitulo traducido" : "Agregar capitulo"}
            </Link>
          )}
        </aside>
      </section>

      <section className="home-section">
        <div className="section-heading">
          <p className="section-kicker">Lectura</p>
          <h2>Capitulos</h2>
        </div>

        {capitulos.length > 0 ? (
          <div className="chapter-list">
            {capitulos.map((capitulo) => (
              <div key={capitulo.id} className="chapter-row">
                <Link
                  to={`/historia/${id}/capitulo/${capitulo.id}`}
                  className="chapter-item"
                >
                  <span>Capitulo {capitulo.orden}</span>
                  {capitulo.estado && (
                    <span className={`chapter-status story-status-${capitulo.estado}`}>
                      {capitulo.estado}
                    </span>
                  )}
                  <strong>{capitulo.titulo}</strong>
                  <p>{getChapterPreview(capitulo)}</p>
                </Link>

                {(puedeGestionar ||
                  (isTranslation(historia) &&
                    capitulo.traductorId === auth.currentUser?.uid)) &&
                  capitulo.id !== LEGACY_CHAPTER_ID && (
                  <Link
                    to={`/historia/${id}/capitulo/${capitulo.id}/editar`}
                    className="chapter-edit-link"
                  >
                    Editar
                  </Link>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="empty-state">Esta historia todavia no tiene capitulos.</p>
        )}
      </section>

      {puedeEditarColaboradores && (
        <section className="home-section permissions-panel">
          <div className="section-heading">
            <p className="section-kicker">Permisos</p>
            <h2>Colaboradores permitidos</h2>
          </div>

          <p className="permission-note">
            Agrega un UID o email por linea. Los colaboradores podran crear y
            editar capitulos de esta historia original.
          </p>

          <textarea
            placeholder="uid-o-email@example.com"
            value={colaboradoresInput}
            onChange={(event) => setColaboradoresInput(event.target.value)}
            rows={5}
            className="form-field full-width"
          />

          <button onClick={guardarColaboradores}>Guardar colaboradores</button>
        </section>
      )}

      <section className="home-section comments-section">
        <div className="section-heading">
          <p className="section-kicker">Comunidad</p>
          <h2>Comentarios</h2>
        </div>

        <textarea
          placeholder="Escribi un comentario..."
          value={nuevoComentario}
          onChange={(event) => setNuevoComentario(event.target.value)}
          rows={3}
          className="comment-input"
        />

        <button onClick={agregarComentario}>Comentar</button>

        <div className="comments-list">
          {comentarios.map((comentario) => (
            <div key={comentario.id} className="comment-card">
              <p className="comment-author">{comentario.autor}</p>
              <p>{comentario.texto}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
