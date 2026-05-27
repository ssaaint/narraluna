import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  increment,
  setDoc
} from "firebase/firestore";
import { auth, db } from "../firebase";
import {
  TRANSLATION_STATUS_PENDING,
  TRANSLATOR_REQUIREMENT_MESSAGE,
  buildObraFromHistoria,
  obraAllowsTranslations,
  userCanUploadTranslation
} from "../utils/obraUtils";
import {
  parseChapterImages,
  safeFirestorePayload,
  textOrEmpty
} from "../utils/firestoreSafe";

const getPersistableObra = (obra) => {
  const data = { ...obra };
  delete data.id;
  delete data.tipoLegible;
  return data;
};

export default function SubirTraduccionObra() {
  const { obraId } = useParams();
  const navigate = useNavigate();

  const [obra, setObra] = useState(null);
  const [perfil, setPerfil] = useState({});
  const [obraExiste, setObraExiste] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tituloTraduccion, setTituloTraduccion] = useState("");
  const [idiomaOrigen, setIdiomaOrigen] = useState("es");
  const [idiomaDestino, setIdiomaDestino] = useState("");
  const [tituloCapitulo, setTituloCapitulo] = useState("Capitulo 1");
  const [contenido, setContenido] = useState("");
  const [imagenesCapitulo, setImagenesCapitulo] = useState("");

  useEffect(() => {
    const cargarDatos = async () => {
      try {
        let obraSnap = null;

        try {
          obraSnap = await getDoc(doc(db, "obras", obraId));
        } catch {
          obraSnap = null;
        }

        if (obraSnap?.exists()) {
          const obraData = {
            id: obraSnap.id,
            ...obraSnap.data()
          };
          setObra(obraData);
          setTituloTraduccion(`${obraData.titulo || "Obra"} - Traduccion`);
          setObraExiste(true);
        } else {
          const historiaSnap = await getDoc(doc(db, "historias", obraId));

          if (historiaSnap.exists()) {
            const obraData = buildObraFromHistoria({
              id: historiaSnap.id,
              ...historiaSnap.data()
            });
            setObra(obraData);
            setTituloTraduccion(`${obraData.titulo || "Obra"} - Traduccion`);
            setObraExiste(false);
          } else {
            setObra(null);
          }
        }

        if (auth.currentUser) {
          const perfilSnap = await getDoc(doc(db, "usuarios", auth.currentUser.uid));
          setPerfil(perfilSnap.exists() ? perfilSnap.data() : {});
        } else {
          setPerfil({});
        }
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    if (obraId) {
      cargarDatos();
    }
  }, [obraId]);

  const puedeSubirTraduccion = userCanUploadTranslation(
    auth.currentUser,
    perfil,
    obra || {}
  );
  const permiteTraducciones = obraAllowsTranslations(obra || {});

  const publicarTraduccion = async () => {
    const currentUser = auth.currentUser;

    if (!currentUser) {
      alert("Tenes que iniciar sesion");
      return;
    }

    if (!permiteTraducciones || !puedeSubirTraduccion) {
      alert(TRANSLATOR_REQUIREMENT_MESSAGE);
      return;
    }

    const tituloTraduccionFinal = textOrEmpty(tituloTraduccion);
    const idiomaOrigenFinal = textOrEmpty(idiomaOrigen);
    const idiomaDestinoFinal = textOrEmpty(idiomaDestino);
    const tituloCapituloFinal = textOrEmpty(tituloCapitulo) || "Capitulo traducido";
    const contenidoFinal = textOrEmpty(contenido);
    const imagenesFinales = parseChapterImages(imagenesCapitulo);

    if (!tituloTraduccionFinal || !idiomaDestinoFinal || !contenidoFinal) {
      alert("Completa titulo, idioma destino y contenido traducido");
      return;
    }

    try {
      const obraRef = doc(db, "obras", obraId);
      const now = new Date();
      const perfilSnap = await getDoc(doc(db, "usuarios", currentUser.uid));
      const perfil = perfilSnap.exists() ? perfilSnap.data() : {};
      const traductorNombre =
        textOrEmpty(perfil.nombre) || currentUser.email || "Usuario";

      if (!obraExiste) {
        await setDoc(
          obraRef,
          safeFirestorePayload({
            ...getPersistableObra(obra),
            createdFromLegacy: true,
            updatedAt: now
          }),
          { merge: true }
        );
      }

      const traduccionRef = await addDoc(
        collection(db, "obras", obraId, "traducciones"),
        safeFirestorePayload({
          titulo: tituloTraduccionFinal,
          tipo: "traduccion",
          estado: TRANSLATION_STATUS_PENDING,
          idiomaOrigen: idiomaOrigenFinal,
          idiomaDestino: idiomaDestinoFinal,
          traductorPrincipalId: currentUser.uid,
          traductorPrincipalNombre: traductorNombre,
          traductorId: currentUser.uid,
          traductorEmail: currentUser.email || "",
          capitulosCount: 1,
          notificacionesPreparadas: {
            nuevoCapituloTraducido: true,
            traduccionPendiente: true,
            traduccionAprobada: true
          },
          fecha: now,
          updatedAt: now
        })
      );

      await addDoc(
        collection(
          db,
          "obras",
          obraId,
          "traducciones",
          traduccionRef.id,
          "capitulos"
        ),
        safeFirestorePayload({
          titulo: tituloCapituloFinal,
          contenido: contenidoFinal,
          imagenes: imagenesFinales,
          orden: 1,
          numero: 1,
          estado: TRANSLATION_STATUS_PENDING,
          idiomaDestino: idiomaDestinoFinal,
          traductorId: currentUser.uid,
          traductorNombre,
          traductorEmail: currentUser.email || "",
          fecha: now,
          fechaSubida: now,
          updatedAt: now,
          notificacionesPreparadas: {
            nuevoCapituloTraducido: true,
            traduccionPendiente: true,
            traduccionAprobada: true
          }
        })
      );

      await setDoc(
        obraRef,
        {
          "estadisticas.traduccionesCount": increment(1),
          traduccionesDisponibles: [],
          fechaActualizacion: now,
          updatedAt: now
        },
        { merge: true }
      );

      alert("Traduccion enviada como pendiente");
      navigate(`/obra/${obraId}`);
    } catch (error) {
      console.error("Error completo al subir traduccion:", error);

      if (error?.code === "permission-denied") {
        console.error("Revisa reglas de Firestore: permiso denegado al subir traduccion.");
      }

      alert(error.message || "Error desconocido al subir la traduccion");
    }
  };

  if (loading) {
    return <p className="page">Cargando obra...</p>;
  }

  if (!obra) {
    return <p className="page">No se encontro la obra.</p>;
  }

  if (!auth.currentUser || !permiteTraducciones || !puedeSubirTraduccion) {
    return (
      <main className="page page-form">
        <Link to={`/obra/${obraId}`} className="text-link">
          Volver a la obra
        </Link>
        <p className="section-kicker">{obra.titulo}</p>
        <h2>Subir capitulo traducido</h2>
        <p className="empty-state">
          {permiteTraducciones
            ? TRANSLATOR_REQUIREMENT_MESSAGE
            : "Esta obra no acepta traducciones por ahora."}
        </p>
      </main>
    );
  }

  return (
    <main className="page page-form">
      <Link to={`/obra/${obraId}`} className="text-link">
        Volver a la obra
      </Link>

      <p className="section-kicker">{obra.titulo}</p>
      <h2>Subir capitulo traducido</h2>

      <input
        placeholder="Titulo de la traduccion"
        value={tituloTraduccion}
        onChange={(event) => setTituloTraduccion(event.target.value)}
        className="form-field"
      />

      <div className="form-grid">
        <input
          placeholder="Idioma origen"
          value={idiomaOrigen}
          onChange={(event) => setIdiomaOrigen(event.target.value)}
          className="form-field"
        />

        <input
          placeholder="Idioma destino"
          value={idiomaDestino}
          onChange={(event) => setIdiomaDestino(event.target.value)}
          className="form-field"
        />
      </div>

      <input
        placeholder="Titulo del capitulo traducido"
        value={tituloCapitulo}
        onChange={(event) => setTituloCapitulo(event.target.value)}
        className="form-field"
      />

      <textarea
        placeholder="Contenido traducido..."
        value={contenido}
        onChange={(event) => setContenido(event.target.value)}
        rows={12}
        className="form-field full-width"
      />

      <textarea
        placeholder="Imagenes del capitulo por URL, una por linea. Opcional: URL | descripcion"
        value={imagenesCapitulo}
        onChange={(event) => setImagenesCapitulo(event.target.value)}
        rows={4}
        className="form-field full-width"
      />

      <button onClick={publicarTraduccion}>Enviar traduccion pendiente</button>
    </main>
  );
}
