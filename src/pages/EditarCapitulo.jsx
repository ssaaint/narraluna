import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { auth, db } from "../firebase";
import ChapterImagesInput from "../components/ChapterImagesInput";
import { LEGACY_CHAPTER_ID } from "../utils/chapterUtils";
import { parseChapterImages, safeFirestorePayload } from "../utils/firestoreSafe";
import { userCanManageStory } from "../utils/permissionUtils";
import { isTranslation } from "../utils/storyUtils";
import { getFriendlyFirebaseError } from "../utils/firebaseErrorUtils";

const imagesToText = (images) =>
  Array.isArray(images)
    ? images
        .map((image) =>
          image?.caption ? `${image.url || ""} | ${image.caption}` : image?.url || ""
        )
        .filter(Boolean)
        .join("\n")
    : "";

export default function EditarCapitulo() {
  const { historiaId, capituloId } = useParams();
  const navigate = useNavigate();

  const [historia, setHistoria] = useState(null);
  const [titulo, setTitulo] = useState("");
  const [contenido, setContenido] = useState("");
  const [imagenesCapitulo, setImagenesCapitulo] = useState("");
  const [orden, setOrden] = useState(1);
  const [capitulo, setCapitulo] = useState(null);
  const [perfil, setPerfil] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const cargarDatos = async () => {
      try {
        const historiaSnap = await getDoc(doc(db, "historias", historiaId));
        if (auth.currentUser) {
          const perfilSnap = await getDoc(doc(db, "usuarios", auth.currentUser.uid));
          setPerfil(perfilSnap.exists() ? perfilSnap.data() : {});
        }

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
          setImagenesCapitulo(imagesToText(historiaData.imagenes));
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
          setImagenesCapitulo(imagesToText(data.imagenes));
          setOrden(data.orden || 1);
        }
      } catch (error) {
        console.error("Error completo:", error);
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
      ? userCanManageStory(auth.currentUser, historia, perfil) ||
        capitulo?.traductorId === auth.currentUser.uid
      : userCanManageStory(auth.currentUser, historia, perfil);

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
      const updatePayload = safeFirestorePayload({
        titulo,
        contenido,
        imagenes: parseChapterImages(imagenesCapitulo),
        orden: Number(orden) || 1,
        updatedAt: new Date()
      });

      await updateDoc(doc(db, "historias", historiaId, "capitulos", capituloId), updatePayload);

      await updateDoc(doc(db, "historias", historiaId), {
        updatedAt: new Date()
      });

      if (!isTranslation(historia)) {
        try {
          await setDoc(
            doc(db, "obras", historiaId, "capitulos", capituloId),
            safeFirestorePayload({
              ...updatePayload,
              numero: Number(orden) || 1,
              origen: "original",
              historiaLegacyId: historiaId
            }),
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
        } catch (mirrorError) {
          console.error("No se pudo reflejar el capitulo en obras:", mirrorError);
        }
      }

      alert("Capitulo guardado");
      navigate(`/historia/${historiaId}/capitulo/${capituloId}`);
    } catch (error) {
      console.error("Error completo:", error);
      alert(getFriendlyFirebaseError(error));
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
    ? userCanManageStory(auth.currentUser, historia, perfil) ||
      capitulo?.traductorId === auth.currentUser.uid
    : userCanManageStory(auth.currentUser, historia, perfil);

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
        <ChapterImagesInput
          value={imagenesCapitulo}
          onChange={setImagenesCapitulo}
        />
      )}

      {capituloId !== LEGACY_CHAPTER_ID && (
        <button onClick={guardarCapitulo}>Guardar capitulo</button>
      )}
    </main>
  );
}
