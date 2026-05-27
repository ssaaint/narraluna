import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc
} from "firebase/firestore";
import { auth, db } from "../firebase";
import ChapterImagesInput from "../components/ChapterImagesInput";
import { createUniqueSlug } from "../utils/slugUtils";
import { OBRA_TYPE_ORIGINAL } from "../utils/obraUtils";
import {
  listOrEmpty,
  parseChapterImages,
  safeFirestorePayload,
  textOrEmpty
} from "../utils/firestoreSafe";
import { getFriendlyFirebaseError } from "../utils/firebaseErrorUtils";

const shortSuffix = (userId) =>
  `${String(userId || "u").slice(0, 4)}-${Date.now().toString(36).slice(-5)}`;

const loadExistingSlugs = async () => {
  const [historiasResult, obrasResult] = await Promise.allSettled([
    getDocs(collection(db, "historias")),
    getDocs(collection(db, "obras"))
  ]);

  if (historiasResult.status === "rejected") {
    console.error("No se pudieron leer slugs de historias:", historiasResult.reason);
  }

  if (obrasResult.status === "rejected") {
    console.error("No se pudieron leer slugs de obras:", obrasResult.reason);
  }

  return {
    reliable:
      historiasResult.status === "fulfilled" && obrasResult.status === "fulfilled",
    slugs: [
      ...(historiasResult.status === "fulfilled"
        ? historiasResult.value.docs.map((historiaDoc) => historiaDoc.data().slug)
        : []),
      ...(obrasResult.status === "fulfilled"
        ? obrasResult.value.docs.map((obraDoc) => obraDoc.data().slug)
        : [])
    ]
  };
};

const loadUserProfile = async (user) => {
  try {
    const userSnap = await getDoc(doc(db, "usuarios", user.uid));
    return userSnap.exists() ? userSnap.data() : {};
  } catch (error) {
    console.error("No se pudo leer el perfil para publicar:", error);
    return {};
  }
};

export default function Crear() {
  const navigate = useNavigate();

  const [titulo, setTitulo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [generos, setGeneros] = useState("");
  const [etiquetas, setEtiquetas] = useState("");
  const [portada, setPortada] = useState("");
  const [tituloCapitulo, setTituloCapitulo] = useState("Capitulo 1");
  const [contenido, setContenido] = useState("");
  const [imagenesCapitulo, setImagenesCapitulo] = useState("");

  const publicar = async () => {
    const currentUser = auth.currentUser;

    if (!currentUser) {
      alert("Tenes que iniciar sesion");
      return;
    }

    const tituloFinal = textOrEmpty(titulo);
    const contenidoFinal = textOrEmpty(contenido);
    const tituloCapituloFinal = textOrEmpty(tituloCapitulo) || "Capitulo 1";
    const portadaFinal = textOrEmpty(portada);
    const imagenesFinales = parseChapterImages(imagenesCapitulo);

    if (!tituloFinal) {
      alert("El titulo de la historia es obligatorio.");
      return;
    }

    if (!contenidoFinal && imagenesFinales.length > 0) {
      alert("Para publicar imagenes del primer capitulo, completa tambien el contenido.");
      return;
    }

    try {
      const { reliable, slugs } = await loadExistingSlugs();
      const slugFinal = reliable
        ? createUniqueSlug(tituloFinal, slugs)
        : createUniqueSlug(`${tituloFinal}-${shortSuffix(currentUser.uid)}`, []);

      if (!slugFinal) {
        alert("La historia necesita un titulo valido.");
        return;
      }

      const perfil = await loadUserProfile(currentUser);
      const nombre =
        textOrEmpty(perfil.nombre) || currentUser.email || "Usuario";
      const foto = textOrEmpty(perfil.fotoUrl || perfil.foto);
      const descripcionFinal =
        textOrEmpty(descripcion) || contenidoFinal.slice(0, 180);
      const generosFinales = listOrEmpty(generos);
      const etiquetasFinales = listOrEmpty(etiquetas);
      const now = new Date();
      const tienePrimerCapitulo = Boolean(contenidoFinal);

      const basePayload = safeFirestorePayload({
        titulo: tituloFinal,
        slug: slugFinal,
        tipo: OBRA_TYPE_ORIGINAL,
        descripcion: descripcionFinal,
        generos: generosFinales,
        etiquetas: etiquetasFinales,
        portada: portadaFinal,
        portadaUrl: portadaFinal,
        contenido: contenidoFinal,
        permiteTraducciones: false,
        estadoTraducible: false,
        autor: nombre,
        autorNombre: nombre,
        autorId: currentUser.uid,
        autorFoto: foto,
        fotoAutor: foto,
        creadoPor: currentUser.uid,
        creadoPorNombre: nombre,
        creadoPorFoto: foto,
        colaboradoresPermitidos: [],
        traductoresAutorizados: [],
        fecha: now,
        fechaCreacion: now,
        fechaActualizacion: now,
        updatedAt: now,
        cantidadCapitulos: tienePrimerCapitulo ? 1 : 0,
        vistas: 0,
        likesCount: 0,
        comentariosCount: 0,
        seguidoresCount: 0,
        likes: [],
        comentarios: [],
        estadisticas: {
          vistas: 0,
          likesCount: 0,
          comentariosCount: 0,
          seguidoresCount: 0,
          traduccionesCount: 0
        }
      });

      const capitulo = safeFirestorePayload({
        titulo: tituloCapituloFinal,
        contenido: contenidoFinal,
        imagenes: imagenesFinales,
        orden: 1,
        numero: 1,
        autorId: currentUser.uid,
        autorNombre: nombre,
        fecha: now,
        fechaPublicacion: now,
        updatedAt: now,
        vistas: 0,
        likesCount: 0,
        comentariosCount: 0
      });

      let destinoId = "";

      try {
        const historiaRef = await addDoc(collection(db, "historias"), basePayload);
        destinoId = historiaRef.id;

        let capituloId = "";

        if (tienePrimerCapitulo) {
          const capituloRef = await addDoc(
            collection(db, "historias", historiaRef.id, "capitulos"),
            capitulo
          );
          capituloId = capituloRef.id;
        }

        try {
          await setDoc(
            doc(db, "obras", historiaRef.id),
            safeFirestorePayload({
              ...basePayload,
              historiaLegacyId: historiaRef.id
            })
          );

          if (tienePrimerCapitulo && capituloId) {
            await setDoc(
              doc(db, "obras", historiaRef.id, "capitulos", capituloId),
              safeFirestorePayload({
                ...capitulo,
                origen: "original",
                historiaLegacyId: historiaRef.id
              })
            );
          }
        } catch (mirrorError) {
          console.error("No se pudo reflejar la historia en obras:", mirrorError);
        }
      } catch (historiaError) {
        console.error("No se pudo publicar en historias:", historiaError);

        if (historiaError?.code !== "permission-denied") {
          throw historiaError;
        }

        const obraRef = await addDoc(
          collection(db, "obras"),
          safeFirestorePayload({
            ...basePayload,
            historiaLegacyId: ""
          })
        );
        destinoId = obraRef.id;

        if (tienePrimerCapitulo) {
          await addDoc(
            collection(db, "obras", obraRef.id, "capitulos"),
            safeFirestorePayload({
              ...capitulo,
              origen: "original",
              historiaLegacyId: ""
            })
          );
        }
      }

      alert("Historia publicada");

      setTitulo("");
      setDescripcion("");
      setGeneros("");
      setEtiquetas("");
      setPortada("");
      setTituloCapitulo("Capitulo 1");
      setContenido("");
      setImagenesCapitulo("");

      navigate(`/obra/${destinoId}`);
    } catch (error) {
      console.error("Error completo al publicar:", error);

      if (error?.code === "permission-denied") {
        console.error("Revisa reglas de Firestore: permiso denegado al publicar.");
      }

      alert(getFriendlyFirebaseError(error));
    }
  };

  if (!auth.currentUser) {
    return <p className="page">Tenes que iniciar sesion</p>;
  }

  return (
    <main className="page page-form">
      <p className="section-kicker">Historia original</p>
      <h2>Crear historia</h2>

      <input
        placeholder="Titulo de la historia"
        value={titulo}
        onChange={(event) => setTitulo(event.target.value)}
        className="form-field"
      />

      <textarea
        placeholder="Descripcion o sinopsis..."
        value={descripcion}
        onChange={(event) => setDescripcion(event.target.value)}
        rows={4}
        className="form-field full-width"
      />

      <input
        placeholder="Generos separados por coma"
        value={generos}
        onChange={(event) => setGeneros(event.target.value)}
        className="form-field"
      />

      <input
        placeholder="Etiquetas separadas por coma"
        value={etiquetas}
        onChange={(event) => setEtiquetas(event.target.value)}
        className="form-field"
      />

      <input
        placeholder="URL de portada opcional"
        value={portada}
        onChange={(event) => setPortada(event.target.value)}
        className="form-field"
      />

      <ImagePreview
        url={portada}
        fallback={(titulo || "N").slice(0, 1).toUpperCase()}
        label="Vista previa de portada"
      />

      <input
        placeholder="Titulo del primer capitulo opcional"
        value={tituloCapitulo}
        onChange={(event) => setTituloCapitulo(event.target.value)}
        className="form-field"
      />

      <textarea
        placeholder="Contenido del primer capitulo opcional..."
        value={contenido}
        onChange={(event) => setContenido(event.target.value)}
        rows={12}
        className="form-field full-width"
      />

      <ChapterImagesInput
        value={imagenesCapitulo}
        onChange={setImagenesCapitulo}
      />

      <button onClick={publicar}>Publicar historia original</button>
    </main>
  );
}

function ImagePreview({ url, fallback, label }) {
  return (
    <div className="image-preview">
      <div className="image-preview-frame">
        {url ? <img src={url} alt={label} /> : <span>{fallback}</span>}
      </div>
      <p>{label}</p>
    </div>
  );
}
