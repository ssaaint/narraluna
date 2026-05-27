import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  runTransaction,
  setDoc
} from "firebase/firestore";
import { auth, db } from "../firebase";
import { getDisplayChapters } from "../utils/chapterUtils";
import { buildObraFromHistoria } from "../utils/obraUtils";
import { safeFirestorePayload } from "../utils/firestoreSafe";

const READER_PREFS_KEY = "umbral.readerPreferences";
const LEGACY_READER_PREFS_KEY = "narraluna.readerPreferences";

const DEFAULT_READER_PREFS = {
  fontSize: 18,
  fontFamily: "inter",
  theme: "dark",
  textWidth: 760
};

const FONT_OPTIONS = [
  { value: "inter", label: "Inter" },
  { value: "serif", label: "Serif" },
  { value: "system", label: "Sistema" }
];

const THEME_OPTIONS = [
  { value: "dark", label: "Oscuro" },
  { value: "light", label: "Claro" },
  { value: "sepia", label: "Sepia" },
  { value: "nocturne", label: "Morado nocturno" }
];

const loadReaderPreferences = () => {
  if (typeof window === "undefined") return DEFAULT_READER_PREFS;

  try {
    const savedPreferences = JSON.parse(
      window.localStorage.getItem(READER_PREFS_KEY) ||
        window.localStorage.getItem(LEGACY_READER_PREFS_KEY)
    );

    return {
      ...DEFAULT_READER_PREFS,
      ...savedPreferences,
      fontSize: Number(savedPreferences?.fontSize) || DEFAULT_READER_PREFS.fontSize,
      textWidth:
        Number(savedPreferences?.textWidth) || DEFAULT_READER_PREFS.textWidth
    };
  } catch {
    return DEFAULT_READER_PREFS;
  }
};

const sortByOrder = (items) =>
  [...items].sort((a, b) => {
    const orderA = Number(a.numero || a.orden || 0);
    const orderB = Number(b.numero || b.orden || 0);

    if (orderA || orderB) return orderA - orderB;

    return String(a.titulo || "").localeCompare(String(b.titulo || ""));
  });

const getChapterImages = (capitulo) =>
  Array.isArray(capitulo?.imagenes)
    ? capitulo.imagenes
        .map((image) => ({
          url: String(image?.url || "").trim(),
          caption: String(image?.caption || "").trim()
        }))
        .filter((image) => image.url)
    : [];

const getChapterNumber = (capitulo) =>
  Number(capitulo?.numero || capitulo?.orden || 0) || 0;

const sanitizeReadId = (value) =>
  String(value || "item")
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .slice(0, 120);

const saveReadingProgress = async ({
  user,
  obra,
  capitulo,
  capitulos,
  tipo,
  traduccionId
}) => {
  const now = new Date();
  const ultimoDisponible = capitulos[capitulos.length - 1] || capitulo;
  const chapterNumber = getChapterNumber(capitulo);
  const lastAvailableNumber = getChapterNumber(ultimoDisponible);
  const route =
    tipo === "traduccion"
      ? `/obra/${obra.id}/traducciones/${traduccionId}/capitulo/${capitulo.id}`
      : `/obra/${obra.id}/capitulo/${capitulo.id}`;
  const progressRef = doc(db, "usuarios", user.uid, "progreso", obra.id);
  const userRef = doc(db, "usuarios", user.uid);
  const readKey = [
    obra.id,
    tipo,
    traduccionId || "original",
    capitulo.id
  ].map(sanitizeReadId).join("__");
  const readRef = doc(db, "usuarios", user.uid, "capitulosLeidos", readKey);

  const progressPayload = safeFirestorePayload({
    userId: user.uid,
    obraId: obra.id,
    titulo: obra.titulo || "",
    capituloId: capitulo.id,
    numeroCapitulo: chapterNumber,
    tituloCapitulo: capitulo.titulo || "",
    fechaLectura: now,
    tipo,
    traduccionId: traduccionId || null,
    ultimoDisponibleNumero: lastAvailableNumber,
    ruta: route
  });

  await setDoc(progressRef, progressPayload, { merge: true });

  const perfilUpdate = {
    [`progresoLectura.${obra.id}`]: {
      historiaId: obra.id,
      obraId: obra.id,
      titulo: obra.titulo || "",
      ultimoCapituloId: capitulo.id,
      ultimoCapituloTitulo: capitulo.titulo || "",
      ultimoCapituloOrden: chapterNumber,
      ultimoCapituloNumero: chapterNumber,
      ultimoDisponibleNumero: lastAvailableNumber,
      fechaLectura: now,
      vistoEn: now,
      tipo,
      traduccionId: traduccionId || "",
      ruta: route
    },
    updatedAt: now
  };

  await runTransaction(db, async (transaction) => {
    const readSnap = await transaction.get(readRef);

    if (!readSnap.exists()) {
      transaction.set(
        readRef,
        safeFirestorePayload({
          obraId: obra.id,
          capituloId: capitulo.id,
          tipo,
          traduccionId: traduccionId || null,
          numeroCapitulo: chapterNumber,
          tituloCapitulo: capitulo.titulo || "",
          fechaLectura: now,
          ruta: route
        })
      );
      transaction.set(
        userRef,
        {
          ...perfilUpdate,
          capitulosLeidos: increment(1)
        },
        { merge: true }
      );
      return;
    }

    transaction.set(userRef, perfilUpdate, { merge: true });
  });
};

export default function ObraCapituloLectura() {
  const { obraId, traduccionId, capituloId } = useParams();

  const [obra, setObra] = useState(null);
  const [traduccion, setTraduccion] = useState(null);
  const [capitulos, setCapitulos] = useState([]);
  const [capituloActual, setCapituloActual] = useState(null);
  const [readerPrefs, setReaderPrefs] = useState(loadReaderPreferences);
  const [loading, setLoading] = useState(true);
  const [likedByUser, setLikedByUser] = useState(false);
  const [chapterLikes, setChapterLikes] = useState(0);
  const [actionBusy, setActionBusy] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    window.localStorage.setItem(
      READER_PREFS_KEY,
      JSON.stringify(readerPrefs)
    );
  }, [readerPrefs]);

  useEffect(() => {
    const cargarCapitulo = async () => {
      try {
        let obraData = null;
        let capitulosData = [];

        const obraSnap = await getDoc(doc(db, "obras", obraId));

        if (obraSnap.exists()) {
          obraData = {
            id: obraSnap.id,
            ...obraSnap.data()
          };
        } else {
          const historiaSnap = await getDoc(doc(db, "historias", obraId));

          if (historiaSnap.exists()) {
            obraData = buildObraFromHistoria({
              id: historiaSnap.id,
              ...historiaSnap.data()
            });
          }
        }

        if (!obraData) {
          setObra(null);
          setCapituloActual(null);
          return;
        }

        if (traduccionId) {
          const traduccionSnap = await getDoc(
            doc(db, "obras", obraId, "traducciones", traduccionId)
          );

          if (!traduccionSnap.exists()) {
            setObra(obraData);
            setTraduccion(null);
            setCapituloActual(null);
            return;
          }

          const capitulosSnap = await getDocs(
            collection(
              db,
              "obras",
              obraId,
              "traducciones",
              traduccionId,
              "capitulos"
            )
          );
          capitulosData = sortByOrder(
            capitulosSnap.docs.map((capituloDoc) => ({
              id: capituloDoc.id,
              ...capituloDoc.data()
            }))
          );

          setTraduccion({
            id: traduccionSnap.id,
            ...traduccionSnap.data()
          });
        } else {
          let capitulosSnap = await getDocs(
            collection(db, "obras", obraId, "capitulos")
          );

          if (capitulosSnap.empty && obraData.historiaLegacyId) {
            capitulosSnap = await getDocs(
              collection(db, "historias", obraData.historiaLegacyId, "capitulos")
            );
          } else if (capitulosSnap.empty) {
            try {
              capitulosSnap = await getDocs(
                collection(db, "historias", obraId, "capitulos")
              );
            } catch {
              capitulosSnap = { docs: [] };
            }
          }

          capitulosData = getDisplayChapters(
            obraData,
            capitulosSnap.docs.map((capituloDoc) => ({
              id: capituloDoc.id,
              ...capituloDoc.data()
            }))
          );
          setTraduccion(null);
        }

        const capituloEncontrado =
          capitulosData.find((capitulo) => capitulo.id === capituloId) || null;

        setObra(obraData);
        setCapitulos(capitulosData);
        setCapituloActual(capituloEncontrado);
        setChapterLikes(Number(capituloEncontrado?.likesCount || 0) || 0);

        if (auth.currentUser && capituloEncontrado) {
          try {
            const likePath = traduccionId
              ? doc(
                  db,
                  "obras",
                  obraId,
                  "traducciones",
                  traduccionId,
                  "capitulos",
                  capituloId,
                  "likes",
                  auth.currentUser.uid
                )
              : doc(
                  db,
                  "obras",
                  obraId,
                  "capitulos",
                  capituloId,
                  "likes",
                  auth.currentUser.uid
                );
            const likeSnap = await getDoc(likePath);
            setLikedByUser(likeSnap.exists());
          } catch {
            setLikedByUser(false);
          }

          await saveReadingProgress({
            user: auth.currentUser,
            obra: obraData,
            capitulo: capituloEncontrado,
            capitulos: capitulosData,
            tipo: traduccionId ? "traduccion" : "original",
            traduccionId
          });
        }
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    if (obraId && capituloId) {
      cargarCapitulo();
    }
  }, [obraId, traduccionId, capituloId]);

  const updateReaderPreference = (key, value) => {
    setReaderPrefs((current) => ({
      ...current,
      [key]: value
    }));
  };

  const resetReaderPreferences = () => {
    setReaderPrefs(DEFAULT_READER_PREFS);
  };

  const toggleChapterLike = async () => {
    const currentUser = auth.currentUser;

    if (!currentUser) {
      alert("Tenes que iniciar sesion");
      return;
    }

    if (!capituloActual) return;

    try {
      setActionBusy(true);
      const capituloRef = traduccionId
        ? doc(
            db,
            "obras",
            obraId,
            "traducciones",
            traduccionId,
            "capitulos",
            capituloId
          )
        : doc(db, "obras", obraId, "capitulos", capituloId);
      const capituloSnap = await getDoc(capituloRef);

      if (!capituloSnap.exists()) {
        await setDoc(
          capituloRef,
          safeFirestorePayload({
            ...capituloActual,
            likesCount: Number(capituloActual.likesCount || 0) || 0,
            updatedAt: new Date()
          }),
          { merge: true }
        );
      }

      const likeRef = doc(capituloRef, "likes", currentUser.uid);
      const nextLiked = await runTransaction(db, async (transaction) => {
        const likeSnap = await transaction.get(likeRef);

        if (likeSnap.exists()) {
          transaction.delete(likeRef);
          transaction.set(
            capituloRef,
            {
              likesCount: increment(-1),
              updatedAt: new Date()
            },
            { merge: true }
          );
          return false;
        }

        transaction.set(
          likeRef,
          safeFirestorePayload({
            userId: currentUser.uid,
            email: currentUser.email || "",
            fecha: new Date()
          })
        );
        transaction.set(
          capituloRef,
          {
            likesCount: increment(1),
            updatedAt: new Date()
          },
          { merge: true }
        );
        return true;
      });

      setLikedByUser(nextLiked);
      setChapterLikes((current) => Math.max(0, current + (nextLiked ? 1 : -1)));
    } catch (error) {
      console.error("Error completo:", error);
      alert(error.message || "Error desconocido");
    } finally {
      setActionBusy(false);
    }
  };

  if (loading) {
    return <p className="page">Cargando capitulo...</p>;
  }

  if (!obra) {
    return <p className="page">No se encontro la obra.</p>;
  }

  if (traduccionId && !traduccion) {
    return <p className="page">No se encontro la traduccion.</p>;
  }

  if (!capituloActual) {
    return <p className="page">No se encontro el capitulo.</p>;
  }

  const currentIndex = capitulos.findIndex(
    (capitulo) => capitulo.id === capituloActual.id
  );
  const capituloAnterior = currentIndex > 0 ? capitulos[currentIndex - 1] : null;
  const capituloSiguiente =
    currentIndex < capitulos.length - 1 ? capitulos[currentIndex + 1] : null;
  const chapterImages = getChapterImages(capituloActual);
  const readerStyle = {
    "--reader-font-size": `${readerPrefs.fontSize}px`,
    "--reader-width": `${readerPrefs.textWidth}px`
  };
  const buildRoute = (capitulo) =>
    traduccionId
      ? `/obra/${obraId}/traducciones/${traduccionId}/capitulo/${capitulo.id}`
      : `/obra/${obraId}/capitulo/${capitulo.id}`;

  return (
    <main
      className={`page page-reader reader-theme-${readerPrefs.theme} reader-font-${readerPrefs.fontFamily}`}
      style={readerStyle}
    >
      <Link to={`/obra/${obraId}`} className="text-link">
        Volver a la obra
      </Link>

      <p className="section-kicker">
        {traduccion ? `${obra.titulo} - ${traduccion.idiomaDestino}` : obra.titulo}
      </p>
      <div className="chapter-reader-heading">
        <div>
          <h1>{capituloActual.titulo || "Capitulo sin titulo"}</h1>
          <p className="muted">
            Capitulo {getChapterNumber(capituloActual) || "?"}
            {capituloActual.estado ? ` - ${capituloActual.estado}` : ""}
          </p>
        </div>
        {auth.currentUser && (
          <button
            type="button"
            className="btn-link btn-link-ghost"
            onClick={toggleChapterLike}
            disabled={actionBusy}
          >
            {likedByUser ? "Quitar like" : "Dar like"} ({chapterLikes})
          </button>
        )}
      </div>

      <section className="reading-settings-panel" aria-label="Ajustes de lectura">
        <div className="reading-settings-heading">
          <div>
            <p className="section-kicker">Lectura</p>
            <h2>Ajustes de lectura</h2>
          </div>

          <button
            type="button"
            className="btn-filter-reset"
            onClick={resetReaderPreferences}
          >
            Restablecer
          </button>
        </div>

        <div className="reading-settings-grid">
          <label className="reader-control">
            <span>Tamano de letra</span>
            <input
              type="range"
              min="16"
              max="24"
              value={readerPrefs.fontSize}
              onChange={(event) =>
                updateReaderPreference("fontSize", Number(event.target.value))
              }
            />
            <strong>{readerPrefs.fontSize}px</strong>
          </label>

          <label className="reader-control">
            <span>Fuente</span>
            <select
              value={readerPrefs.fontFamily}
              onChange={(event) =>
                updateReaderPreference("fontFamily", event.target.value)
              }
            >
              {FONT_OPTIONS.map((font) => (
                <option key={font.value} value={font.value}>
                  {font.label}
                </option>
              ))}
            </select>
          </label>

          <label className="reader-control">
            <span>Ancho del texto</span>
            <input
              type="range"
              min="620"
              max="980"
              step="20"
              value={readerPrefs.textWidth}
              onChange={(event) =>
                updateReaderPreference("textWidth", Number(event.target.value))
              }
            />
            <strong>{readerPrefs.textWidth}px</strong>
          </label>

          <div className="reader-control reader-theme-control">
            <span>Fondo</span>
            <div className="reader-theme-options">
              {THEME_OPTIONS.map((theme) => (
                <button
                  key={theme.value}
                  type="button"
                  className={`reader-theme-option reader-theme-swatch-${theme.value}`}
                  aria-pressed={readerPrefs.theme === theme.value}
                  onClick={() => updateReaderPreference("theme", theme.value)}
                >
                  <span aria-hidden="true" />
                  {theme.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="reader-surface">
        <article className="chapter-content">
          {capituloActual.contenido}
        </article>

        {chapterImages.length > 0 && (
          <div className="chapter-images">
            {chapterImages.map((image) => (
              <figure key={image.url} className="chapter-image">
                <img src={image.url} alt={image.caption || capituloActual.titulo} />
                {image.caption && <figcaption>{image.caption}</figcaption>}
              </figure>
            ))}
          </div>
        )}
      </section>

      <nav className="chapter-navigation" aria-label="Navegacion de capitulos">
        {capituloAnterior ? (
          <Link to={buildRoute(capituloAnterior)} className="btn-link btn-link-ghost">
            Capitulo anterior
          </Link>
        ) : (
          <span className="chapter-nav-disabled">Capitulo anterior</span>
        )}

        {capituloSiguiente ? (
          <Link to={buildRoute(capituloSiguiente)} className="btn-link btn-link-primary">
            Capitulo siguiente
          </Link>
        ) : (
          <span className="chapter-nav-disabled">Capitulo siguiente</span>
        )}
      </nav>
    </main>
  );
}
