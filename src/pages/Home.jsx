import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  collection,
  collectionGroup,
  doc,
  getDoc,
  getDocs
} from "firebase/firestore";
import StoryCard from "../components/StoryCard";
import { auth, db } from "../firebase";
import {
  getLikesCount,
  getStoryGenres,
  isOriginal,
  isTranslation,
  sortByDate,
  sortByLikes,
  uniqueList
} from "../utils/storyUtils";
import { buildLibraryItems } from "../utils/libraryUtils";

const take = (items, count = 4) => items.slice(0, count);

const getDateValue = (value) => {
  if (!value) return 0;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (typeof value.toDate === "function") return value.toDate().getTime();
  if (typeof value.seconds === "number") return value.seconds * 1000;

  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
};

const getProgressDate = (progreso) =>
  getDateValue(progreso.fechaLectura || progreso.vistoEn || progreso.updatedAt);

export default function Home() {
  const [biblioteca, setBiblioteca] = useState([]);
  const [continuarLeyendo, setContinuarLeyendo] = useState([]);
  const [traduccionesHome, setTraduccionesHome] = useState([]);

  useEffect(() => {
    const cargarHome = async () => {
      try {
        const [historiasResult, obrasResult] = await Promise.allSettled([
          getDocs(collection(db, "historias")),
          getDocs(collection(db, "obras"))
        ]);
        const historiasDocs =
          historiasResult.status === "fulfilled" ? historiasResult.value.docs : [];
        const obrasDocs =
          obrasResult.status === "fulfilled" ? obrasResult.value.docs : [];

        if (historiasResult.status === "rejected") {
          console.error("No se pudieron cargar historias antiguas:", historiasResult.reason);
        }

        if (obrasResult.status === "rejected") {
          console.error("No se pudieron cargar obras:", obrasResult.reason);
        }

        const libraryItems = buildLibraryItems(obrasDocs, historiasDocs);

        setBiblioteca(libraryItems);

        try {
          const traduccionesSnap = await getDocs(collectionGroup(db, "traducciones"));
          const traduccionesData = traduccionesSnap.docs.map((traduccionDoc) => {
            const obraId = traduccionDoc.ref.parent.parent?.id || "";
            const obra = libraryItems.find((item) => item.id === obraId) || {};
            const data = traduccionDoc.data();

            return {
              id: traduccionDoc.id,
              obraId,
              route: obraId ? `/obra/${obraId}` : "/traducir",
              tipo: "traduccion",
              titulo: data.titulo || `${obra.titulo || "Obra"} - traduccion`,
              descripcion: obra.titulo
                ? `Traduccion de ${obra.titulo}`
                : "Traduccion pendiente",
              generos: obra.generos || [],
              etiquetas: obra.etiquetas || [],
              portada: obra.portada || "",
              portadaUrl: obra.portadaUrl || obra.portada || "",
              autor:
                data.traductorPrincipalNombre ||
                data.traductorEmail ||
                "Traductor registrado",
              idiomaDestino: data.idiomaDestino || "",
              fecha: data.updatedAt || data.fecha || data.fechaSubida || null,
              updatedAt: data.updatedAt || data.fecha || null,
              estado: data.estado || "pendiente"
            };
          });

          setTraduccionesHome(sortByDate(traduccionesData));
        } catch {
          setTraduccionesHome([]);
        }

        if (auth.currentUser) {
          const perfilRef = doc(db, "usuarios", auth.currentUser.uid);
          const perfilSnap = await getDoc(perfilRef);
          const perfilData = perfilSnap.exists() ? perfilSnap.data() : {};
          const progresoLegacy = perfilData.progresoLectura || {};
          const progresoMap = new Map(
            Object.entries(progresoLegacy).map(([obraId, progreso]) => [
              obraId,
              {
                obraId,
                ...progreso
              }
            ])
          );

          try {
            const progresoSnap = await getDocs(
              collection(db, "usuarios", auth.currentUser.uid, "progreso")
            );

            progresoSnap.docs.forEach((progresoDoc) => {
              progresoMap.set(progresoDoc.id, {
                obraId: progresoDoc.id,
                ...progresoDoc.data()
              });
            });
          } catch {
            // La compatibilidad con progresoLectura cubre proyectos sin subcoleccion.
          }

          const lecturas = [...progresoMap.values()]
            .sort((a, b) => getProgressDate(b) - getProgressDate(a))
            .slice(0, 6)
            .map((progreso) => {
              const obraId = progreso.obraId || progreso.historiaId;
              const item = libraryItems.find((obra) => obra.id === obraId);

              if (!item) return null;

              return {
                ...item,
                progresoLectura: progreso,
                continueRoute:
                  progreso.ruta ||
                  (progreso.traduccionId
                    ? `/obra/${obraId}/traducciones/${progreso.traduccionId}/capitulo/${progreso.capituloId || progreso.ultimoCapituloId}`
                    : `/obra/${obraId}/capitulo/${progreso.capituloId || progreso.ultimoCapituloId}`)
              };
            });

          setContinuarLeyendo(lecturas.filter(Boolean));
        }
      } catch (error) {
        console.error(error);
      }
    };

    cargarHome();
  }, []);

  const populares = useMemo(
    () => take(sortByLikes(biblioteca), 4),
    [biblioteca]
  );
  const masLikeadas = useMemo(
    () =>
      take(
        sortByLikes(biblioteca).filter((historia) => getLikesCount(historia) > 0),
        4
      ),
    [biblioteca]
  );
  const actualizadas = useMemo(
    () => take(sortByDate(biblioteca), 4),
    [biblioteca]
  );
  const originalesNuevas = useMemo(
    () => take(sortByDate(biblioteca.filter(isOriginal)), 4),
    [biblioteca]
  );
  const traduccionesRecientes = useMemo(
    () =>
      take(
        sortByDate([
          ...traduccionesHome,
          ...biblioteca.filter((item) => isTranslation(item))
        ]),
        4
      ),
    [biblioteca, traduccionesHome]
  );
  const generosDestacados = useMemo(
    () =>
      uniqueList(biblioteca.flatMap(getStoryGenres))
        .map((genero) => ({
          genero,
          total: biblioteca.filter((historia) =>
            getStoryGenres(historia).includes(genero)
          ).length
        }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 8),
    [biblioteca]
  );

  return (
    <main className="page page-home">
      <section className="home-hero home-hero-minimal">
        <div className="home-hero-copy">
          <p className="section-kicker">Umbral de Historias</p>
          <h1>Umbral de Historias</h1>
          <p>Historias originales, obras traducibles y lectura para la comunidad.</p>

          <div className="hero-actions">
            <Link to="/explorar" className="btn-link btn-link-primary">
              Explorar historias
            </Link>
            <Link to="/crear" className="btn-link btn-link-ghost">
              Crear historia
            </Link>
          </div>
        </div>
      </section>

      <DashboardSection
        kicker="Tu lectura"
        title="Continuar leyendo"
        empty="Inicia sesion y lee capitulos para ver tu progreso aca."
      >
        {continuarLeyendo.map((historia) => (
          <ContinueReadingCard key={historia.id} historia={historia} />
        ))}
      </DashboardSection>

      <DashboardSection
        kicker="Ranking"
        title="Populares"
        empty="Todavia no hay historias populares."
      >
        {populares.map((historia, index) => (
          <StoryCard
            key={historia.id}
            historia={historia}
            destacado={index < 3}
            posicion={index + 1}
            resumenCaracteres={100}
          />
        ))}
      </DashboardSection>

      <div className="home-lists">
        <DashboardSection
          kicker="Favoritas"
          title="Mas likeadas"
          empty="Todavia no hay historias con likes."
          compact
        >
          {masLikeadas.map((historia) => (
            <StoryCard key={historia.id} historia={historia} compact />
          ))}
        </DashboardSection>

        <DashboardSection
          kicker="Novedades"
          title="Actualizadas recientemente"
          empty="Todavia no hay actualizaciones."
          compact
        >
          {actualizadas.map((historia) => (
            <StoryCard key={historia.id} historia={historia} compact />
          ))}
        </DashboardSection>
      </div>

      <div className="home-lists">
        <DashboardSection
          kicker="Originales"
          title="Nuevas historias originales"
          empty="Todavia no hay originales."
          compact
        >
          {originalesNuevas.map((historia) => (
            <StoryCard key={historia.id} historia={historia} compact />
          ))}
        </DashboardSection>

        <DashboardSection
          kicker="Traducciones"
          title="Traducciones recientes"
          empty="Todavia no hay traducciones."
          compact
        >
          {traduccionesRecientes.map((historia) => (
            <StoryCard
              key={`${historia.obraId || historia.source || "traduccion"}-${historia.id}`}
              historia={historia}
              compact
            />
          ))}
        </DashboardSection>
      </div>

      <section className="home-section">
        <div className="section-heading">
          <p className="section-kicker">Mapa de lectura</p>
          <h2>Generos destacados</h2>
        </div>

        {generosDestacados.length > 0 ? (
          <div className="genre-grid">
            {generosDestacados.map(({ genero, total }) => (
              <Link
                key={genero}
                to={`/explorar?genero=${encodeURIComponent(genero)}`}
                className="genre-tile genre-tile-link"
              >
                <span>{genero}</span>
                <strong>{total}</strong>
              </Link>
            ))}
          </div>
        ) : (
          <p className="empty-state">Todavia no hay generos destacados.</p>
        )}
      </section>

      <section className="home-section support-section">
        <div className="section-heading">
          <p className="section-kicker">Soporte</p>
          <h2>Comunidad y reportes</h2>
        </div>
        <div className="support-panel">
          <p>
            Queres reportar errores, proponer ideas o hablar con la comunidad?
          </p>
          <a
            href="https://discord.gg/PNJaXNgcMA"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-link btn-link-primary"
          >
            Unirse al Discord
          </a>
        </div>
      </section>
    </main>
  );
}

function DashboardSection({ kicker, title, empty, children, compact = false }) {
  const visibleChildren = Array.isArray(children)
    ? children.flat(Infinity).filter(Boolean)
    : children
      ? [children]
      : [];

  return (
    <section className="home-section">
      <div className="section-heading">
        <p className="section-kicker">{kicker}</p>
        <h2>{title}</h2>
      </div>

      {visibleChildren.length > 0 ? (
        <div className={compact ? "compact-story-list" : "grid explore-grid"}>
          {visibleChildren}
        </div>
      ) : (
        <p className="empty-state">{empty}</p>
      )}
    </section>
  );
}

function ContinueReadingCard({ historia }) {
  const progreso = historia.progresoLectura || {};
  const continuarRuta =
    historia.continueRoute || progreso.ruta || `/obra/${historia.id}`;

  return (
    <article className="continue-card">
      <div>
        <p className="section-kicker">Continuar</p>
        <h3>{historia.titulo || "Sin titulo"}</h3>
        <p>
          {progreso.tituloCapitulo || progreso.ultimoCapituloTitulo
            ? `Ultimo: ${progreso.tituloCapitulo || progreso.ultimoCapituloTitulo}`
            : "Sin capitulo registrado"}
        </p>
        {progreso.ultimoDisponibleNumero && (
          <p>Disponible hasta capitulo {progreso.ultimoDisponibleNumero}</p>
        )}
      </div>
      <Link to={continuarRuta} className="btn-link btn-link-primary">
        Continuar
      </Link>
    </article>
  );
}
