import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { auth, db } from "../firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";

export default function Lectura() {
  const { id } = useParams();

  const [historia, setHistoria] = useState(null);
  const [loading, setLoading] = useState(true);
  const [likes, setLikes] = useState([]);

  const [comentarios, setComentarios] = useState([]);
  const [nuevoComentario, setNuevoComentario] = useState("");

  useEffect(() => {
    const obtenerHistoria = async () => {
      try {
        const ref = doc(db, "historias", id);
        const snap = await getDoc(ref);

        if (snap.exists()) {
          const data = snap.data();

          setHistoria(data);
          setLikes(data.likes || []);
          setComentarios(data.comentarios || []);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      obtenerHistoria();
    }
  }, [id]);

  const toggleLike = async () => {
    if (!auth.currentUser) {
      alert("Tenés que iniciar sesión");
      return;
    }

    const userId = auth.currentUser.uid;

    let nuevosLikes;

    if (likes.includes(userId)) {
      nuevosLikes = likes.filter((id) => id !== userId);
    } else {
      nuevosLikes = [...likes, userId];
    }

    setLikes(nuevosLikes);

    try {
      const ref = doc(db, "historias", id);
      await updateDoc(ref, {
        likes: nuevosLikes
      });
    } catch (err) {
      console.error(err);
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
      const ref = doc(db, "historias", id);
      await updateDoc(ref, {
        comentarios: nuevosComentarios
      });
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return <p className="page">Cargando historia...</p>;
  }

  if (!historia) {
    return <p className="page">No se encontró la historia</p>;
  }

  return (
    <div className="page page-reader">
      <h1>{historia.titulo}</h1>

      <p className="muted">{historia.autor}</p>

      <button onClick={toggleLike}>
        {likes.includes(auth.currentUser?.uid)
          ? "💔 Quitar Like"
          : "🤍 Me gusta"}
      </button>

      <p className="muted">{likes.length} likes</p>

      <hr className="divider" />

      <p className="story-content">
        {historia.contenido}
      </p>

      <hr className="divider divider-large" />

      <h3>Comentarios</h3>

      <textarea
        placeholder="Escribí un comentario..."
        value={nuevoComentario}
        onChange={(e) => setNuevoComentario(e.target.value)}
        rows={3}
        className="comment-input"
      />

      <br /><br />

      <button onClick={agregarComentario}>
        Comentar
      </button>

      <div className="comments-list">
        {comentarios.map((c, index) => (
          <div key={index} className="comment-card">
            <p className="comment-author">
              {c.autor}
            </p>
            <p>{c.texto}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
