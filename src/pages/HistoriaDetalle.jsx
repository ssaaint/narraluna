import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { collection, doc, getDoc, getDocs, updateDoc } from "firebase/firestore";
import { auth, db } from "../firebase";
import { getDisplayChapters, getChapterPreview } from "../utils/chapterUtils";
import {
  getStoryDescription,
  getStoryGenres,
  getStoryTags,
  getStoryType
} from "../utils/storyUtils";

export default function HistoriaDetalle() {
  const { id } = useParams();

  const [historia, setHistoria] = useState(null);
  const [capitulos, setCapitulos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [likes, setLikes] = useState([]);
  const [comentarios, setComentarios] = useState([]);
  const [nuevoComentario, setNuevoComentario] = useState("");

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
      alert("Tenés que iniciar sesión");
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
      alert("Tenés que iniciar sesión");
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

  if (loading) {
    return <p className="page">Cargando historia...</p>;
  }

  if (!historia) {
    return <p className="page">No se encontró la historia</p>;
  }

  const descripcion =
    getStoryDescription(historia) ||
    (historia.contenido
      ? `${historia.contenido.slice(0, 180)}...`
      : "Esta historia todavía no tiene descripción.");
  const esAutor = auth.currentUser?.uid === historia.autorId;
  const etiquetas = getStoryTags(historia);

  return (
    <main className="page page-story-detail">
      <section className="story-detail-hero">
        <div>
          <Link to="/" className="text-link">
            Volver a explorar
          </Link>

          <p className="section-kicker">{getStoryType(historia)}</p>
          <h1>{historia.titulo || "Sin título"}</h1>
          <p className="story-detail-author">
            por {historia.autor || "Autor desconocido"}
          </p>
          <p className="story-detail-description">{descripcion}</p>

          <div className="story-detail-tags">
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
            capítulos
          </span>

          <button onClick={toggleLike}>
            {likes.includes(auth.currentUser?.uid)
              ? "Quitar Like"
              : "Me gusta"}
          </button>

          {esAutor && (
            <Link to={`/historia/${id}/nuevo-capitulo`} className="btn-link btn-link-primary">
              Agregar capítulo
            </Link>
          )}
        </aside>
      </section>

      <section className="home-section">
        <div className="section-heading">
          <p className="section-kicker">Lectura</p>
          <h2>Capítulos</h2>
        </div>

        {capitulos.length > 0 ? (
          <div className="chapter-list">
            {capitulos.map((capitulo) => (
              <Link
                key={capitulo.id}
                to={`/historia/${id}/capitulo/${capitulo.id}`}
                className="chapter-item"
              >
                <span>Capítulo {capitulo.orden}</span>
                <strong>{capitulo.titulo}</strong>
                <p>{getChapterPreview(capitulo)}</p>
              </Link>
            ))}
          </div>
        ) : (
          <p className="empty-state">Esta historia todavía no tiene capítulos.</p>
        )}
      </section>

      <section className="home-section comments-section">
        <div className="section-heading">
          <p className="section-kicker">Comunidad</p>
          <h2>Comentarios</h2>
        </div>

        <textarea
          placeholder="Escribí un comentario..."
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
