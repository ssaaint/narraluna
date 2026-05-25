import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  updateDoc
} from "firebase/firestore";
import { auth, db } from "../firebase";
import { getDisplayChapters } from "../utils/chapterUtils";
import { userCanManageStory } from "../utils/permissionUtils";

export default function NuevoCapitulo() {
  const { historiaId } = useParams();
  const navigate = useNavigate();

  const [historia, setHistoria] = useState(null);
  const [cantidadCapitulos, setCantidadCapitulos] = useState(0);
  const [titulo, setTitulo] = useState("");
  const [contenido, setContenido] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const cargarHistoria = async () => {
      try {
        const historiaRef = doc(db, "historias", historiaId);
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
          collection(db, "historias", historiaId, "capitulos")
        );

        const capitulosData = capitulosSnap.docs.map((capituloDoc) => ({
          id: capituloDoc.id,
          ...capituloDoc.data()
        }));

        setHistoria(historiaData);
        setCantidadCapitulos(getDisplayChapters(historiaData, capitulosData).length);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    if (historiaId) {
      cargarHistoria();
    }
  }, [historiaId]);

  const publicarCapitulo = async () => {
    if (!auth.currentUser) {
      alert("Tenes que iniciar sesion");
      return;
    }

    if (!titulo.trim() || !contenido.trim()) {
      alert("Completa todos los campos");
      return;
    }

    if (!userCanManageStory(auth.currentUser, historia)) {
      alert("Solo el creador o colaboradores pueden agregar capitulos");
      return;
    }

    try {
      await addDoc(collection(db, "historias", historiaId, "capitulos"), {
        titulo,
        contenido,
        orden: cantidadCapitulos + 1,
        fecha: new Date(),
        updatedAt: new Date()
      });

      await updateDoc(doc(db, "historias", historiaId), {
        cantidadCapitulos: cantidadCapitulos + 1,
        updatedAt: new Date()
      });

      alert("Capitulo publicado");
      navigate(`/historia/${historiaId}`);
    } catch (error) {
      console.error(error);
      alert("Error al publicar el capitulo");
    }
  };

  if (loading) {
    return <p className="page">Cargando historia...</p>;
  }

  if (!historia) {
    return <p className="page">No se encontro la historia</p>;
  }

  if (!auth.currentUser) {
    return <p className="page">Tenes que iniciar sesion para agregar capitulos.</p>;
  }

  if (!userCanManageStory(auth.currentUser, historia)) {
    return <p className="page">Solo el creador o colaboradores pueden agregar capitulos.</p>;
  }

  return (
    <main className="page page-form">
      <Link to={`/historia/${historiaId}`} className="text-link">
        Volver al detalle
      </Link>

      <p className="section-kicker">{historia.titulo}</p>
      <h2>Nuevo capitulo</h2>

      <input
        placeholder="Titulo del capitulo"
        value={titulo}
        onChange={(event) => setTitulo(event.target.value)}
        className="form-field"
      />

      <textarea
        placeholder="Contenido del capitulo..."
        value={contenido}
        onChange={(event) => setContenido(event.target.value)}
        rows={12}
        className="form-field full-width"
      />

      <button onClick={publicarCapitulo}>Publicar capitulo</button>
    </main>
  );
}
