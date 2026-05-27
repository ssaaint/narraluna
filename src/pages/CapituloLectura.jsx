import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  collection,
  doc,
  getCountFromServer,
  getDoc,
  getDocs,
  query,
  runTransaction,
  setDoc,
  where
} from "firebase/firestore";
import { auth, db } from "../firebase";
import { LEGACY_CHAPTER_ID, getDisplayChapters } from "../utils/chapterUtils";
import { userCanManageStory } from "../utils/permissionUtils";
import {
  getCommentsCount,
  getStoryStatus,
  isTranslation
} from "../utils/storyUtils";
import { notifyStoryOwnerOfComment } from "../utils/notificationUtils";

const getCommentDateValue = (comentario) => {
  const fecha = comentario?.fecha || comentario?.createdAt;

  if (!fecha) return 0;
  if (typeof fecha.toMillis === "function") return fecha.toMillis();
  if (typeof fecha.toDate === "function") return fecha.toDate().getTime();
  if (typeof fecha.seconds === "number") return fecha.seconds * 1000;

  const parsed = Date.parse(fecha);
  return Number.isNaN(parsed) ? 0 : parsed;
};

const sortComments = (comentarios) =>
  [...comentarios].sort(
    (a, b) => getCommentDateValue(a) - getCommentDateValue(b)
  );

const getChapterImages = (capitulo) =>
  Array.isArray(capitulo?.imagenes)
    ? capitulo.imagenes
        .map((image) => ({
          url: String(image?.url || "").trim(),
          caption: String(image?.caption || "").trim()
        }))
        .filter((image) => image.url)
    : [];

const READER_PREFS_KEY = "narraluna.readerPreferences";

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
  if (typeof window === "undefined") {
    return DEFAULT_READER_PREFS;
  }

  try {
    const savedPreferences = JSON.parse(
      window.localStorage.getItem(READER_PREFS_KEY)
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

export default function CapituloLectura() {
  const { historiaId, capituloId } = useParams();

  const [historia, setHistoria] = useState(null);
  const [capitulos, setCapitulos] = useState([]);
  const [capituloActual, setCapituloActual] = useState(null);
  const [comentariosCapitulo, setComentariosCapitulo] = useState([]);
  const [nuevoComentario, setNuevoComentario] = useState("");
  const [comentariosCount, setComentariosCount] = useState(0);
  const [readerPrefs, setReaderPrefs] = useState(loadReaderPreferences);
  const [loading, setLoading] = useState(true);

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

        const capitulosVisibles = getDisplayChapters(historiaData, capitulosData);

        const capituloEncontrado =
          capitulosVisibles.find((capitulo) => capitulo.id === capituloId) || null;
        let comentariosDelCapitulo = [];
        let comentariosTotales = getCommentsCount(historiaData);

        if (capituloEncontrado) {
          try {
            const comentariosCountSnap = await getCountFromServer(
              collection(db, "historias", historiaId, "comentarios")
            );
            comentariosTotales = Math.max(
              comentariosTotales,
              comentariosCountSnap.data().count
            );
          } catch {
            comentariosTotales = getCommentsCount(historiaData);
          }

          try {
            const comentariosSnap = await getDocs(
              query(
                collection(db, "historias", historiaId, "comentarios"),
                where("capituloId", "==", capituloEncontrado.id)
              )
            );
            comentariosDelCapitulo = sortComments(
              comentariosSnap.docs.map((comentarioDoc) => ({
                id: comentarioDoc.id,
                ...comentarioDoc.data()
              }))
            );
          } catch {
            comentariosDelCapitulo = [];
          }
        }

        setHistoria(historiaData);
        setCapitulos(capitulosVisibles);
        setCapituloActual(capituloEncontrado);
        setComentariosCapitulo(comentariosDelCapitulo);
        setComentariosCount(comentariosTotales);

        if (auth.currentUser && capituloEncontrado) {
          await setDoc(
            doc(db, "usuarios", auth.currentUser.uid),
            {
              [`progresoLectura.${historiaId}`]: {
                historiaId,
                titulo: historiaData.titulo || "",
                ultimoCapituloId: capituloEncontrado.id,
                ultimoCapituloTitulo: capituloEncontrado.titulo || "",
                ultimoCapituloOrden: capituloEncontrado.orden || 0,
                vistoEn: new Date()
              },
              updatedAt: new Date()
            },
            { merge: true }
          );
        }
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    if (historiaId && capituloId) {
      cargarCapitulo();
    }
  }, [historiaId, capituloId]);

  const agregarComentarioCapitulo = async () => {
    if (!auth.currentUser) {
      alert("Tenes que iniciar sesion");
      return;
    }

    const texto = nuevoComentario.trim();

    if (!texto || !capituloActual) return;

    const comentario = {
      texto,
      autorId: auth.currentUser.uid,
      autor: auth.currentUser.email,
      scope: "capitulo",
      capituloId: capituloActual.id,
      capituloTitulo: capituloActual.titulo || "",
      fecha: new Date()
    };

    try {
      const historiaRef = doc(db, "historias", historiaId);
      const comentarioRef = doc(
        collection(db, "historias", historiaId, "comentarios")
      );
      const capituloRef = doc(
        db,
        "historias",
        historiaId,
        "capitulos",
        capituloActual.id
      );

      const siguienteConteo = await runTransaction(db, async (transaction) => {
        const historiaTransactionSnap = await transaction.get(historiaRef);
        const capituloTransactionSnap =
          capituloActual.id !== LEGACY_CHAPTER_ID
            ? await transaction.get(capituloRef)
            : null;

        if (!historiaTransactionSnap.exists()) {
          throw new Error("La historia ya no existe");
        }

        const historiaActual = historiaTransactionSnap.data();
        const conteoActual = Math.max(
          getCommentsCount(historiaActual),
          comentariosCount
        );

        transaction.set(comentarioRef, comentario);
        transaction.update(historiaRef, {
          comentariosCount: conteoActual + 1,
          updatedAt: new Date()
        });

        if (capituloTransactionSnap?.exists()) {
          const capituloData = capituloTransactionSnap.data();
          const conteoCapitulo = Number(capituloData.comentariosCount || 0);

          transaction.update(capituloRef, {
            comentariosCount: conteoCapitulo + 1,
            updatedAt: new Date()
          });
        }

        return conteoActual + 1;
      });

      setComentariosCapitulo((current) =>
        sortComments([...current, { id: comentarioRef.id, ...comentario }])
      );
      setComentariosCount(siguienteConteo);
      setNuevoComentario("");

      try {
        await notifyStoryOwnerOfComment({
          historiaId,
          historia,
          actor: auth.currentUser
        });
      } catch (notificationError) {
        console.error(notificationError);
      }
    } catch (error) {
      console.error(error);
      alert("Error al comentar el capitulo");
    }
  };

  const updateReaderPreference = (key, value) => {
    setReaderPrefs((current) => ({
      ...current,
      [key]: value
    }));
  };

  const resetReaderPreferences = () => {
    setReaderPrefs(DEFAULT_READER_PREFS);
  };

  if (loading) {
    return <p className="page">Cargando capitulo...</p>;
  }

  if (!historia) {
    return <p className="page">No se encontro la historia</p>;
  }

  if (!capituloActual) {
    return <p className="page">No se encontro el capitulo</p>;
  }

  const currentIndex = capitulos.findIndex(
    (capitulo) => capitulo.id === capituloActual.id
  );
  const capituloAnterior = currentIndex > 0 ? capitulos[currentIndex - 1] : null;
  const capituloSiguiente =
    currentIndex < capitulos.length - 1 ? capitulos[currentIndex + 1] : null;
  const puedeGestionar =
    capituloActual.id !== LEGACY_CHAPTER_ID &&
    (userCanManageStory(auth.currentUser, historia) ||
      (isTranslation(historia) &&
        capituloActual.traductorId === auth.currentUser?.uid));
  const readerStyle = {
    "--reader-font-size": `${readerPrefs.fontSize}px`,
    "--reader-width": `${readerPrefs.textWidth}px`
  };
  const chapterImages = getChapterImages(capituloActual);

  return (
    <main
      className={`page page-reader reader-theme-${readerPrefs.theme} reader-font-${readerPrefs.fontFamily}`}
      style={readerStyle}
    >
      <Link to={`/historia/${historiaId}`} className="text-link">
        Volver al detalle
      </Link>

      <p className="section-kicker">{historia.titulo}</p>
      <div className="chapter-reader-heading">
        <div>
          <h1>{capituloActual.titulo}</h1>
          <p className="muted">Capitulo {capituloActual.orden}</p>
          {isTranslation(historia) && (
            <p className="translation-status-line">
              Traduccion {getStoryStatus(historia)}
              {capituloActual.estado ? ` · capitulo ${capituloActual.estado}` : ""}
            </p>
          )}
        </div>

        {puedeGestionar && (
          <Link
            to={`/historia/${historiaId}/capitulo/${capituloActual.id}/editar`}
            className="btn-link btn-link-ghost"
          >
            Editar capitulo
          </Link>
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

      <section className="home-section comments-section chapter-comments-section">
        <div className="section-heading">
          <p className="section-kicker">Comunidad</p>
          <h2>Comentarios del capitulo</h2>
        </div>

        <textarea
          placeholder="Escribi un comentario sobre este capitulo..."
          value={nuevoComentario}
          onChange={(event) => setNuevoComentario(event.target.value)}
          rows={3}
          className="comment-input"
        />

        <button onClick={agregarComentarioCapitulo}>Comentar capitulo</button>

        <div className="comments-list">
          {comentariosCapitulo.map((comentario) => (
            <div key={comentario.id} className="comment-card">
              <p className="comment-author">{comentario.autor}</p>
              <p>{comentario.texto}</p>
            </div>
          ))}
        </div>
      </section>

      <nav className="chapter-navigation" aria-label="Navegacion de capitulos">
        {capituloAnterior ? (
          <Link
            to={`/historia/${historiaId}/capitulo/${capituloAnterior.id}`}
            className="btn-link btn-link-ghost"
          >
            Capitulo anterior
          </Link>
        ) : (
          <span className="chapter-nav-disabled">Capitulo anterior</span>
        )}

        {capituloSiguiente ? (
          <Link
            to={`/historia/${historiaId}/capitulo/${capituloSiguiente.id}`}
            className="btn-link btn-link-primary"
          >
            Capitulo siguiente
          </Link>
        ) : (
          <span className="chapter-nav-disabled">Capitulo siguiente</span>
        )}
      </nav>
    </main>
  );
}
