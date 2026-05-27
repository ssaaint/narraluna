import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc
} from "firebase/firestore";
import { auth, db } from "../firebase";
import ChapterImagesInput from "../components/ChapterImagesInput";
import { getDisplayChapters } from "../utils/chapterUtils";
import { userCanManageStory } from "../utils/permissionUtils";
import {
  STORY_STATUS_PENDING,
  isTranslation
} from "../utils/storyUtils";
import { canUploadTranslatedChapter } from "../utils/translationUtils";
import { notifyFollowersOfNewChapter } from "../utils/notificationUtils";
import { parseChapterImages, textOrEmpty } from "../utils/firestoreSafe";

export default function NuevoCapitulo() {
  const { historiaId } = useParams();
  const navigate = useNavigate();

  const [historia, setHistoria] = useState(null);
  const [cantidadCapitulos, setCantidadCapitulos] = useState(0);
  const [titulo, setTitulo] = useState("");
  const [contenido, setContenido] = useState("");
  const [imagenesCapitulo, setImagenesCapitulo] = useState("");
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

    const tituloFinal = textOrEmpty(titulo);
    const contenidoFinal = textOrEmpty(contenido);
    const imagenesFinales = parseChapterImages(imagenesCapitulo);

    if (!tituloFinal || !contenidoFinal) {
      alert("Completa todos los campos");
      return;
    }

    const puedeSubirCapitulo = isTranslation(historia)
      ? canUploadTranslatedChapter(auth.currentUser, historia)
      : userCanManageStory(auth.currentUser, historia);

    if (!puedeSubirCapitulo) {
      alert("No tenes permisos para agregar capitulos");
      return;
    }

    try {
      const nuevoCapitulo = {
        titulo: tituloFinal,
        contenido: contenidoFinal,
        imagenes: imagenesFinales,
        orden: cantidadCapitulos + 1,
        numero: cantidadCapitulos + 1,
        fecha: new Date(),
        updatedAt: new Date()
      };

      if (isTranslation(historia)) {
        nuevoCapitulo.estado = STORY_STATUS_PENDING;
        nuevoCapitulo.idiomaDestino = historia.idiomaDestino || "";
        nuevoCapitulo.traductorId = auth.currentUser.uid;
        nuevoCapitulo.traductorEmail = auth.currentUser.email;
      }

      const capituloRef = await addDoc(
        collection(db, "historias", historiaId, "capitulos"),
        nuevoCapitulo
      );

      await updateDoc(doc(db, "historias", historiaId), {
        cantidadCapitulos: cantidadCapitulos + 1,
        updatedAt: new Date()
      });

      if (!isTranslation(historia)) {
        await setDoc(
          doc(db, "obras", historiaId, "capitulos", capituloRef.id),
          {
            ...nuevoCapitulo,
            origen: "original",
            historiaLegacyId: historiaId
          },
          { merge: true }
        );

        await setDoc(
          doc(db, "obras", historiaId),
          {
            fechaActualizacion: new Date(),
            updatedAt: new Date()
          },
          { merge: true }
        );
      }

      try {
        await notifyFollowersOfNewChapter({
          historiaId,
          historia,
          capituloId: capituloRef.id,
          capitulo: nuevoCapitulo,
          actor: auth.currentUser
        });
      } catch (notificationError) {
        console.error(notificationError);
      }

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

  const puedeSubirCapitulo = isTranslation(historia)
    ? canUploadTranslatedChapter(auth.currentUser, historia)
    : userCanManageStory(auth.currentUser, historia);

  if (!puedeSubirCapitulo) {
    return <p className="page">No tenes permisos para agregar capitulos.</p>;
  }

  return (
    <main className="page page-form">
      <Link to={`/historia/${historiaId}`} className="text-link">
        Volver al detalle
      </Link>

      <p className="section-kicker">{historia.titulo}</p>
      <h2>{isTranslation(historia) ? "Nuevo capitulo traducido" : "Nuevo capitulo"}</h2>

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

      <ChapterImagesInput
        value={imagenesCapitulo}
        onChange={setImagenesCapitulo}
      />

      <button onClick={publicarCapitulo}>Publicar capitulo</button>
    </main>
  );
}
