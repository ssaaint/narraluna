import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { collection, doc, getDoc, getDocs } from "firebase/firestore";
import { auth, db } from "../firebase";
import { getChapterPreview, getDisplayChapters } from "../utils/chapterUtils";
import {
  TRANSLATION_STATUS_APPROVED,
  TRANSLATION_STATUS_PENDING,
  buildObraFromHistoria,
  getObraGenres,
  getObraStats,
  getObraTags,
  getObraTypeLabel,
  obraAllowsTranslations,
  userCanUploadTranslation,
  TRANSLATOR_REQUIREMENT_MESSAGE
} from "../utils/obraUtils";
import { userCanManageStory } from "../utils/permissionUtils";

const sortByOrder = (items) =>
  [...items].sort((a, b) => {
    const orderA = Number(a.orden || 0);
    const orderB = Number(b.orden || 0);

    if (orderA || orderB) {
      return orderA - orderB;
    }

    return String(a.titulo || "").localeCompare(String(b.titulo || ""));
  });

const getStatusLabel = (estado) => {
  if (estado === TRANSLATION_STATUS_APPROVED || estado === "aprobado") {
    return "aprobada";
  }
  if (estado === "rechazada" || estado === "rechazado") return "rechazada";
  return TRANSLATION_STATUS_PENDING;
};

export default function ObraDetalle() {
  const { obraId } = useParams();

  const [obra, setObra] = useState(null);
  const [capitulos, setCapitulos] = useState([]);
  const [traducciones, setTraducciones] = useState([]);
  const [perfil, setPerfil] = useState({});
  const [loading, setLoading] = useState(true);
  const [legacyMode, setLegacyMode] = useState(false);

  useEffect(() => {
    const cargarObra = async () => {
      try {
        const obraRef = doc(db, "obras", obraId);
        let obraSnap = null;
        let obraData = null;
        let capitulosPath = ["obras", obraId, "capitulos"];
        let isLegacy = false;

        try {
          obraSnap = await getDoc(obraRef);
        } catch {
          obraSnap = null;
        }

        if (obraSnap?.exists()) {
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
            capitulosPath = ["historias", obraId, "capitulos"];
            isLegacy = true;
          }
        }

        if (!obraData) {
          setObra(null);
          setCapitulos([]);
          setTraducciones([]);
          return;
        }

        const capitulosSnap = await getDocs(collection(db, ...capitulosPath));
        const capitulosData = getDisplayChapters(
          obraData,
          capitulosSnap.docs.map((capituloDoc) => ({
            id: capituloDoc.id,
            ...capituloDoc.data()
          }))
        );

        let traduccionesData = [];

        try {
          const traduccionesSnap = await getDocs(
            collection(db, "obras", obraId, "traducciones")
          );
          traduccionesData = await Promise.all(
            traduccionesSnap.docs.map(async (traduccionDoc) => {
              const capitulosTraduccionSnap = await getDocs(
                collection(
                  db,
                  "obras",
                  obraId,
                  "traducciones",
                  traduccionDoc.id,
                  "capitulos"
                )
              );

              return {
                id: traduccionDoc.id,
                ...traduccionDoc.data(),
                capitulos: sortByOrder(
                  capitulosTraduccionSnap.docs.map((capituloDoc) => ({
                    id: capituloDoc.id,
                    ...capituloDoc.data()
                  }))
                )
              };
            })
          );
        } catch {
          traduccionesData = [];
        }

        if (auth.currentUser) {
          const perfilSnap = await getDoc(doc(db, "usuarios", auth.currentUser.uid));
          setPerfil(perfilSnap.exists() ? perfilSnap.data() : {});
        } else {
          setPerfil({});
        }

        setObra(obraData);
        setCapitulos(capitulosData);
        setTraducciones(traduccionesData);
        setLegacyMode(isLegacy);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    if (obraId) {
      cargarObra();
    }
  }, [obraId]);

  const stats = useMemo(() => getObraStats(obra || {}), [obra]);
  const permiteTraducciones = obraAllowsTranslations(obra || {});
  const canUploadTranslation = userCanUploadTranslation(
    auth.currentUser,
    perfil,
    obra || {}
  );
  const puedeEditar = userCanManageStory(auth.currentUser, obra || {});
  const generos = getObraGenres(obra || {});
  const etiquetas = getObraTags(obra || {});

  if (loading) {
    return <p className="page">Cargando obra...</p>;
  }

  if (!obra) {
    return <p className="page">No se encontro la obra.</p>;
  }

  return (
    <main className="page page-obra-detail">
      <section className="obra-hero">
        <div className="obra-cover">
          {obra.portadaUrl || obra.portada ? (
            <img
              src={obra.portadaUrl || obra.portada}
              alt={obra.titulo || "Portada"}
            />
          ) : (
            <span>{(obra.titulo || "N").slice(0, 1).toUpperCase()}</span>
          )}
        </div>

        <div className="obra-hero-main">
          <Link to="/explorar" className="text-link">
            Volver a explorar
          </Link>

          <p className="section-kicker">
            Obra / serie {legacyMode ? "compatibilidad" : getObraTypeLabel(obra.tipo)}
          </p>
          <h1>{obra.titulo || "Sin titulo"}</h1>
          <p className="story-detail-author">
            ficha creada por{" "}
            {obra.autor || obra.autorNombre || obra.creadoPorNombre || "Autor desconocido"}
          </p>
          {obra.autorOriginal && (
            <p className="story-detail-author">
              Autor original: {obra.autorOriginal}
              {obra.idiomaOriginal ? ` - idioma original: ${obra.idiomaOriginal}` : ""}
              {obra.paisOrigen ? ` - ${obra.paisOrigen}` : ""}
            </p>
          )}
          <p className="story-detail-description">
            {obra.descripcion || "Esta obra todavia no tiene descripcion."}
          </p>

          <div className="story-detail-tags">
            <span>/{obra.slug || obra.id}</span>
            <span>{getObraTypeLabel(obra.tipo)}</span>
            {generos.map((genero) => (
              <span key={genero}>{genero}</span>
            ))}
            {etiquetas.map((etiqueta) => (
              <span key={etiqueta}>#{etiqueta}</span>
            ))}
          </div>

          {legacyMode && (
            <p className="permission-note">
              Esta vista se genera desde la coleccion historias para mantener
              compatibilidad con contenido anterior.
            </p>
          )}
        </div>

        <aside className="story-stats-card obra-stats-card">
          <span>
            <strong>{stats.vistas}</strong>
            vistas
          </span>
          <span>
            <strong>{stats.likesCount}</strong>
            likes
          </span>
          <span>
            <strong>{stats.comentariosCount}</strong>
            comentarios
          </span>
          <span>
            <strong>{stats.seguidoresCount}</strong>
            seguidores
          </span>

          {puedeEditar && (
            <Link
              to={`/obra/${obra.id}/editar`}
              className="btn-link btn-link-ghost"
            >
              Editar historia
            </Link>
          )}

          {permiteTraducciones && canUploadTranslation ? (
            <Link
              to={`/obra/${obra.id}/subir-traduccion`}
              className="btn-link btn-link-primary"
            >
              Subir capitulo traducido
            </Link>
          ) : permiteTraducciones ? (
            <p className="translation-eligibility">
              {TRANSLATOR_REQUIREMENT_MESSAGE}
            </p>
          ) : null}
        </aside>
      </section>

      <section className="home-section">
        <div className="section-heading">
          <p className="section-kicker">Original</p>
          <h2>Capitulos originales</h2>
        </div>

        {capitulos.length > 0 ? (
          <div className="chapter-list">
            {capitulos.map((capitulo) => (
              <Link
                key={capitulo.id}
                to={`/obra/${obra.id}/capitulo/${capitulo.id}`}
                className="chapter-item"
              >
                <span>Capitulo {capitulo.numero || capitulo.orden || "?"}</span>
                <strong>{capitulo.titulo || "Sin titulo"}</strong>
                <p>{getChapterPreview(capitulo) || "Sin vista previa."}</p>
              </Link>
            ))}
          </div>
        ) : (
          <p className="empty-state">Todavia no hay capitulos originales.</p>
        )}
      </section>

      <section className="home-section">
        <div className="section-heading">
          <p className="section-kicker">Traducciones</p>
          <h2>Traducciones</h2>
        </div>

        {traducciones.length > 0 ? (
          <div className="translation-grid">
            {traducciones.map((traduccion) => (
              <article key={traduccion.id} className="translation-card">
                <div className="story-card-topline">
                  <span
                    className={`story-pill story-status story-status-${getStatusLabel(
                      traduccion.estado
                    )}`}
                  >
                    {getStatusLabel(traduccion.estado)}
                  </span>
                  {traduccion.idiomaDestino && (
                    <span className="story-pill-muted">
                      {traduccion.idiomaOrigen || "origen"} -{" "}
                      {traduccion.idiomaDestino}
                    </span>
                  )}
                </div>

                <h3>{traduccion.titulo || "Traduccion sin titulo"}</h3>
                <p>
                  Traductor: {traduccion.traductorEmail || "Usuario registrado"}
                </p>

                {traduccion.capitulos?.length > 0 ? (
                  <div className="translated-chapter-list">
                    {traduccion.capitulos.map((capitulo) => (
                      <Link
                        key={capitulo.id}
                        to={`/obra/${obra.id}/traducciones/${traduccion.id}/capitulo/${capitulo.id}`}
                        className="translated-chapter-item"
                      >
                        <strong>{capitulo.titulo || "Capitulo traducido"}</strong>
                        <span>{getStatusLabel(capitulo.estado)}</span>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <p className="empty-state">Sin capitulos traducidos.</p>
                )}
              </article>
            ))}
          </div>
        ) : (
          <p className="empty-state">Todavia no hay traducciones para esta obra.</p>
        )}
      </section>
    </main>
  );
}
