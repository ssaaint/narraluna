import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { collection, doc, getDoc, getDocs, updateDoc } from "firebase/firestore";
import { auth, db } from "../firebase";
import {
  LEGACY_CHAPTER_ID,
  getChapterPreview,
  getDisplayChapters
} from "../utils/chapterUtils";
import {
  getStoryDescription,
  getStoryGenres,
  getStoryTags,
  getStoryType
} from "../utils/storyUtils";
import { getStorySlug } from "../utils/slugUtils";
import {
  getCollaborators,
  normalizeCollaborators,
  userCanEditCollaborators,
  userCanManageStory
} from "../utils/permissionUtils";

export default function HistoriaDetalle() {
  const { id } = useParams();

  const [historia, setHistoria] = useState(null);
  const [capitulos, setCapitulos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [likes, setLikes] = useState([]);
  const [comentarios, setComentarios] = useState([]);
  const [nuevoComentario, setNuevoComentario] = useState("");
  const [colaboradoresInput, setColaboradoresInput] = useState("");

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

        setHistoria(historiaData);
        setCapitulos(getDisplayChapters(historiaData, capitulosData));
        setLikes(historiaData.likes || []);
        setComentarios(historiaData.comentarios || []);
        setColaboradoresInput(getCollaborators(historiaData).join("\n"));
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
    const nuevosLikes = likes.includes(userId)
      ? likes.filter((likeId) => likeId !== userId)
      : [...likes, userId];

    setLikes(nuevosLikes);

    try {
      await updateDoc(doc(db, "historias", id), {
        likes: nuevosLikes
      });
    } catch (error) {
      console.error(error);
    }
  };

  const agregarComentario = async () => {
    if (!auth.currentUser) {
      alert("Tenes que iniciar sesion");
      return;
    }

    if (!nuevoComentario.trim()) return;

    const comentario = {
      texto: nuevoComentario,
      autor: auth.currentUser.email,
      fecha: new Date()
    };

    const nuevosComentarios = [...comentarios, comentario];

    setComentarios(nuevosComentarios);
    setNuevoComentario("");

    try {
      await updateDoc(doc(db, "historias", id), {
        comentarios: nuevosComentarios
      });
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
  const puedeEditarColaboradores = userCanEditCollaborators(
    auth.currentUser,
    historia
  );
  const colaboradores = getCollaborators(historia);

  return (
    <main className="page page-story-detail">
      <section className="story-detail-hero">
        <div>
          <Link to="/" className="text-link">
            Volver a explorar
          </Link>

          <p className="section-kicker">{getStoryType(historia)}</p>
          <h1>{historia.titulo || "Sin titulo"}</h1>
          <p className="story-detail-author">
            por {historia.autor || "Autor desconocido"}
          </p>
          <p className="story-detail-description">{descripcion}</p>

          <div className="story-detail-tags">
            <span>/{getStorySlug(historia)}</span>
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
            <strong>{likes.length}</strong>
            likes
          </span>
          <span>
            <strong>{comentarios.length}</strong>
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
            {likes.includes(auth.currentUser?.uid) ? "Quitar Like" : "Me gusta"}
          </button>

          {puedeGestionar && (
            <Link
              to={`/historia/${id}/nuevo-capitulo`}
              className="btn-link btn-link-primary"
            >
              Agregar capitulo
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
                  <strong>{capitulo.titulo}</strong>
                  <p>{getChapterPreview(capitulo)}</p>
                </Link>

                {puedeGestionar && capitulo.id !== LEGACY_CHAPTER_ID && (
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
          {comentarios.map((comentario, index) => (
            <div key={index} className="comment-card">
              <p className="comment-author">{comentario.autor}</p>
              <p>{comentario.texto}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
