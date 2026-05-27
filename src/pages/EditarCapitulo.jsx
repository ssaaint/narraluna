import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { auth, db } from "../firebase";
import { LEGACY_CHAPTER_ID } from "../utils/chapterUtils";
import { userCanManageStory } from "../utils/permissionUtils";
import { isTranslation } from "../utils/storyUtils";

export default function EditarCapitulo() {
  const { historiaId, capituloId } = useParams();
  const navigate = useNavigate();

  const [historia, setHistoria] = useState(null);
  const [titulo, setTitulo] = useState("");
  const [contenido, setContenido] = useState("");
  const [orden, setOrden] = useState(1);
  const [capitulo, setCapitulo] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const cargarDatos = async () => {
      try {
        const historiaSnap = await getDoc(doc(db, "historias", historiaId));

        if (!historiaSnap.exists()) {
          setHistoria(null);
          return;
        }

        const historiaData = {
          id: historiaSnap.id,
          ...historiaSnap.data()
        };

        setHistoria(historiaData);

        if (capituloId === LEGACY_CHAPTER_ID) {
          setTitulo("Capitulo unico");
          setContenido(historiaData.contenido || "");
          setOrden(1);
          setCapitulo({
            id: LEGACY_CHAPTER_ID,
            traductorId: historiaData.autorId || ""
          });
          return;
        }

        const capituloSnap = await getDoc(
          doc(db, "historias", historiaId, "capitulos", capituloId)
        );

        if (capituloSnap.exists()) {
          const data = capituloSnap.data();
          setCapitulo({
            id: capituloSnap.id,
            ...data
          });
          setTitulo(data.titulo || "");
          setContenido(data.contenido || "");
          setOrden(data.orden || 1);
        }
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    if (historiaId && capituloId) {
      cargarDatos();
    }
  }, [historiaId, capituloId]);

  const guardarCapitulo = async () => {
    if (!auth.currentUser) {
      alert("Tenes que iniciar sesion");
      return;
    }

    const puedeEditar = isTranslation(historia)
      ? userCanManageStory(auth.currentUser, historia) ||
        capitulo?.traductorId === auth.currentUser.uid
      : userCanManageStory(auth.currentUser, historia);

    if (!puedeEditar) {
      alert("Solo el creador o colaboradores pueden editar capitulos");
      return;
    }

    if (capituloId === LEGACY_CHAPTER_ID) {
      alert("Este capitulo pertenece al formato antiguo y no se edita desde esta pantalla.");
      return;
    }

    if (!titulo.trim() || !contenido.trim()) {
      alert("Completa todos los campos");
      return;
    }

    try {
      await updateDoc(doc(db, "historias", historiaId, "capitulos", capituloId), {
        titulo,
        contenido,
        orden: Number(orden) || 1,
        updatedAt: new Date()
      });

      await updateDoc(doc(db, "historias", historiaId), {
        updatedAt: new Date()
      });

      alert("Capitulo guardado");
      navigate(`/historia/${historiaId}/capitulo/${capituloId}`);
    } catch (error) {
      console.error(error);
      alert("Error al guardar el capitulo");
    }
  };

  if (loading) {
    return <p className="page">Cargando capitulo...</p>;
  }

  if (!historia) {
    return <p className="page">No se encontro la historia</p>;
  }

  if (!auth.currentUser) {
    return <p className="page">Tenes que iniciar sesion para editar capitulos.</p>;
  }

  const puedeEditar = isTranslation(historia)
    ? userCanManageStory(auth.currentUser, historia) ||
      capitulo?.traductorId === auth.currentUser.uid
    : userCanManageStory(auth.currentUser, historia);

  if (!puedeEditar) {
    return <p className="page">Solo el creador, colaboradores o traductor del capitulo pueden editarlo.</p>;
  }

  return (
    <main className="page page-form">
      <Link to={`/historia/${historiaId}`} className="text-link">
        Volver al detalle
      </Link>

      <p className="section-kicker">{historia.titulo}</p>
      <h2>Editar capitulo</h2>

      {capituloId === LEGACY_CHAPTER_ID && (
        <p className="permission-note">
          Este capitulo viene del formato antiguo. Se puede leer, pero no editar
          como subcoleccion.
        </p>
      )}

      <input
        placeholder="Titulo del capitulo"
        value={titulo}
        onChange={(event) => setTitulo(event.target.value)}
        className="form-field"
        disabled={capituloId === LEGACY_CHAPTER_ID}
      />

      <input
        type="number"
        min="1"
        placeholder="Orden"
        value={orden}
        onChange={(event) => setOrden(event.target.value)}
        className="form-field"
        disabled={capituloId === LEGACY_CHAPTER_ID}
      />

      <textarea
        placeholder="Contenido del capitulo..."
        value={contenido}
        onChange={(event) => setContenido(event.target.value)}
        rows={12}
        className="form-field full-width"
        disabled={capituloId === LEGACY_CHAPTER_ID}
      />

      {capituloId !== LEGACY_CHAPTER_ID && (
        <button onClick={guardarCapitulo}>Guardar capitulo</button>
      )}
    </main>
  );
}
