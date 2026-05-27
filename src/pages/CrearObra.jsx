import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs
} from "firebase/firestore";
import { auth, db } from "../firebase";
import { createUniqueSlug } from "../utils/slugUtils";
import { OBRA_TYPE_EXTERNAL } from "../utils/obraUtils";
import { isAdmin } from "../utils/permissionUtils";
import {
  listOrEmpty,
  safeFirestorePayload,
  textOrEmpty
} from "../utils/firestoreSafe";

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

  return [
    ...(historiasResult.status === "fulfilled"
      ? historiasResult.value.docs.map((historiaDoc) => historiaDoc.data().slug)
      : []),
    ...(obrasResult.status === "fulfilled"
      ? obrasResult.value.docs.map((obraDoc) => obraDoc.data().slug)
      : [])
  ];
};

export default function CrearObra() {
  const navigate = useNavigate();

  const [titulo, setTitulo] = useState("");
  const [autorOriginal, setAutorOriginal] = useState("");
  const [idiomaOriginal, setIdiomaOriginal] = useState("");
  const [paisOrigen, setPaisOrigen] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [generos, setGeneros] = useState("");
  const [etiquetas, setEtiquetas] = useState("");
  const [portada, setPortada] = useState("");
  const [perfil, setPerfil] = useState({});
  const [loadingProfile, setLoadingProfile] = useState(true);

  useEffect(() => {
    const cargarPerfil = async () => {
      const currentUser = auth.currentUser;

      if (!currentUser) {
        setPerfil({});
        setLoadingProfile(false);
        return;
      }

      try {
        const perfilSnap = await getDoc(doc(db, "usuarios", currentUser.uid));
        setPerfil(perfilSnap.exists() ? perfilSnap.data() : {});
      } catch (error) {
        console.error("No se pudo cargar perfil admin:", error);
        setPerfil({});
      } finally {
        setLoadingProfile(false);
      }
    };

    cargarPerfil();
  }, []);

  const crearObra = async () => {
    const currentUser = auth.currentUser;

    if (!currentUser) {
      alert("Tenes que iniciar sesion");
      return;
    }

    if (!isAdmin(perfil)) {
      alert("Solo un administrador puede crear fichas de obras externas.");
      return;
    }

    const tituloFinal = textOrEmpty(titulo);
    const autorOriginalFinal = textOrEmpty(autorOriginal);
    const idiomaOriginalFinal = textOrEmpty(idiomaOriginal);
    const portadaFinal = textOrEmpty(portada);

    if (!tituloFinal) {
      alert("El titulo de la obra es obligatorio.");
      return;
    }

    if (!autorOriginalFinal) {
      alert("El autor original es obligatorio.");
      return;
    }

    if (!idiomaOriginalFinal) {
      alert("El idioma original es obligatorio.");
      return;
    }

    try {
      const existingSlugs = await loadExistingSlugs();
      const slugFinal = createUniqueSlug(tituloFinal, existingSlugs);

      if (!slugFinal) {
        alert("La obra necesita un titulo valido.");
        return;
      }

      const perfilSnap = await getDoc(doc(db, "usuarios", currentUser.uid));
      const perfil = perfilSnap.exists() ? perfilSnap.data() : {};
      const creadorNombre =
        textOrEmpty(perfil.nombre) || currentUser.email || "Usuario";
      const creadorFoto = textOrEmpty(perfil.fotoUrl || perfil.foto);
      const now = new Date();

      const obraPayload = safeFirestorePayload({
        titulo: tituloFinal,
        slug: slugFinal,
        tipo: OBRA_TYPE_EXTERNAL,
        estado: "activa",
        descripcion: textOrEmpty(descripcion),
        generos: listOrEmpty(generos),
        etiquetas: listOrEmpty(etiquetas),
        portada: portadaFinal,
        portadaUrl: portadaFinal,
        autorOriginal: autorOriginalFinal,
        idiomaOriginal: idiomaOriginalFinal,
        paisOrigen: textOrEmpty(paisOrigen),
        autorId: currentUser.uid,
        autorNombre: creadorNombre,
        autorFoto: creadorFoto,
        creadoPor: currentUser.uid,
        creadoPorNombre: creadorNombre,
        creadoPorFoto: creadorFoto,
        permiteTraducciones: true,
        estadoTraducible: true,
        traductoresAutorizados: [],
        traduccionesDisponibles: [],
        vistas: 0,
        likesCount: 0,
        comentariosCount: 0,
        seguidoresCount: 0,
        estadisticas: {
          vistas: 0,
          likesCount: 0,
          comentariosCount: 0,
          seguidoresCount: 0,
          traduccionesCount: 0
        },
        fecha: now,
        fechaCreacion: now,
        fechaActualizacion: now,
        updatedAt: now
      });

      const obraRef = await addDoc(collection(db, "obras"), obraPayload);

      alert("Obra externa creada");
      navigate(`/obra/${obraRef.id}`);
    } catch (error) {
      console.error("Error completo al crear obra externa:", error);

      if (error?.code === "permission-denied") {
        console.error("Revisa reglas de Firestore: permiso denegado al crear obra externa.");
      }

      alert(error.message || "Error desconocido al crear la obra");
    }
  };

  if (!auth.currentUser) {
    return <p className="page">Tenes que iniciar sesion</p>;
  }

  if (loadingProfile) {
    return <p className="page">Cargando permisos...</p>;
  }

  if (!isAdmin(perfil)) {
    return (
      <main className="page page-form">
        <p className="section-kicker">Administracion</p>
        <h2>Crear ficha traducible</h2>
        <p className="empty-state">
          Solo un administrador puede crear obras externas traducibles.
        </p>
      </main>
    );
  }

  return (
    <main className="page page-form">
      <p className="section-kicker">Obra externa</p>
      <h2>Crear ficha traducible</h2>

      <input
        placeholder="Titulo de la obra"
        value={titulo}
        onChange={(event) => setTitulo(event.target.value)}
        className="form-field"
      />

      <input
        placeholder="Autor original"
        value={autorOriginal}
        onChange={(event) => setAutorOriginal(event.target.value)}
        className="form-field"
      />

      <div className="form-grid">
        <input
          placeholder="Idioma original"
          value={idiomaOriginal}
          onChange={(event) => setIdiomaOriginal(event.target.value)}
          className="form-field"
        />

        <input
          placeholder="Pais de origen opcional"
          value={paisOrigen}
          onChange={(event) => setPaisOrigen(event.target.value)}
          className="form-field"
        />
      </div>

      <textarea
        placeholder="Descripcion..."
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

      <div className="image-preview">
        <div className="image-preview-frame">
          {portada ? (
            <img src={portada} alt="Vista previa de portada" />
          ) : (
            <span>{(titulo || "N").slice(0, 1).toUpperCase()}</span>
          )}
        </div>
        <p>Vista previa de portada</p>
      </div>

      <button onClick={crearObra}>Crear obra traducible</button>
    </main>
  );
}
