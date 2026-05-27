import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  collection,
  collectionGroup,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  where
} from "firebase/firestore";
import { auth, db } from "../firebase";
import StoryCard from "../components/StoryCard";
import { getDisplayChapters } from "../utils/chapterUtils";
import { buildLibraryItems } from "../utils/libraryUtils";
import { userCanManageStory } from "../utils/permissionUtils";
import {
  getCommentsCount,
  getLikesCount,
  getStoryDescription,
  isTranslation,
  sortByDate
} from "../utils/storyUtils";

const getViewsCount = (historia) =>
  Number(
    historia.vistas ??
      historia.views ??
      historia.visualizaciones ??
      historia.lecturas ??
      0
  ) || 0;

const getFollowedIds = (perfil = {}) => {
  const candidates = [
    perfil.historiasSeguidas,
    perfil.seguidas,
    perfil.siguiendo,
    perfil.historiasFavoritas,
    perfil.favoritas
  ];

  return [
    ...new Set(
      candidates
        .flatMap((value) => (Array.isArray(value) ? value : []))
        .map((value) => String(value).trim())
        .filter(Boolean)
    )
  ];
};

const hasNewChapter = (progreso, ultimoCapituloDisponible) => {
  if (!progreso?.ultimoCapituloId || !ultimoCapituloDisponible?.id) {
    return false;
  }

  const ultimoOrden = Number(ultimoCapituloDisponible.orden || 0);
  const vistoOrden = Number(progreso.ultimoCapituloOrden || 0);

  if (ultimoOrden && vistoOrden) {
    return ultimoOrden > vistoOrden;
  }

  return progreso.ultimoCapituloId !== ultimoCapituloDisponible.id;
};

const getChapterLabel = (capitulo) => {
  if (!capitulo?.id) {
    return "Sin capitulos";
  }

  return `Capitulo ${capitulo.orden || "?"}: ${capitulo.titulo || "Sin titulo"}`;
};

const getProgressDateValue = (progreso) => {
  const fecha = progreso?.fechaLectura || progreso?.vistoEn || progreso?.updatedAt;

  if (!fecha) return 0;
  if (typeof fecha.toMillis === "function") return fecha.toMillis();
  if (typeof fecha.toDate === "function") return fecha.toDate().getTime();
  if (typeof fecha.seconds === "number") return fecha.seconds * 1000;

  const parsed = Date.parse(fecha);
  return Number.isNaN(parsed) ? 0 : parsed;
};

export default function Perfil() {
  const user = auth.currentUser;

  const [nombre, setNombre] = useState("");
  const [bio, setBio] = useState("");
  const [foto, setFoto] = useState("");
  const [editando, setEditando] = useState(false);
  const [loading, setLoading] = useState(true);
  const [historiasCreadas, setHistoriasCreadas] = useState([]);
  const [traduccionesSubidas, setTraduccionesSubidas] = useState([]);
  const [historiasSeguidas, setHistoriasSeguidas] = useState([]);
  const [leyendo, setLeyendo] = useState([]);
  const [capitulosTraducidos, setCapitulosTraducidos] = useState([]);
  const [perfilUsuario, setPerfilUsuario] = useState({});

  useEffect(() => {
    const cargarPerfil = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        const perfilRef = doc(db, "usuarios", user.uid);
        const perfilSnap = await getDoc(perfilRef);
        const perfilData = perfilSnap.exists() ? perfilSnap.data() : {};
        setPerfilUsuario(perfilData);

        setNombre(perfilData.nombre || "");
        setBio(perfilData.bio || "");
        setFoto(perfilData.fotoUrl || perfilData.foto || "");

        const [historiasResult, obrasResult] = await Promise.allSettled([
          getDocs(
            query(collection(db, "historias"), where("autorId", "==", user.uid))
          ),
          getDocs(collection(db, "obras"))
        ]);
        const historiasDocs =
          historiasResult.status === "fulfilled" ? historiasResult.value.docs : [];
        const obrasDocs =
          obrasResult.status === "fulfilled" ? obrasResult.value.docs : [];

        if (historiasResult.status === "rejected") {
          console.error("No se pudieron cargar historias del perfil:", historiasResult.reason);
        }

        if (obrasResult.status === "rejected") {
          console.error("No se pudieron cargar obras del perfil:", obrasResult.reason);
        }

        const publicaciones = buildLibraryItems(obrasDocs, historiasDocs).filter(
          (item) => userCanManageStory(user, item)
        );

        setHistoriasCreadas(
          sortByDate(publicaciones.filter((historia) => !isTranslation(historia)))
        );
        setTraduccionesSubidas(
          sortByDate(publicaciones.filter((historia) => isTranslation(historia)))
        );

        let followedIds = getFollowedIds(perfilData);

        try {
          const seguidasSnap = await getDocs(
            collection(db, "usuarios", user.uid, "seguidas")
          );
          followedIds = [
            ...new Set([
              ...followedIds,
              ...seguidasSnap.docs.map((seguidaDoc) => seguidaDoc.id)
            ])
          ];
        } catch {
          // Los arrays legacy siguen cubriendo perfiles anteriores.
        }
        const progresoLectura = perfilData.progresoLectura || {};
        const cargarObraCompat = async (obraId) => {
          const obraSnap = await getDoc(doc(db, "obras", obraId));

          if (obraSnap.exists()) {
            return {
              id: obraSnap.id,
              source: "obras",
              route: `/obra/${obraSnap.id}`,
              detailRoute: `/obra/${obraSnap.id}`,
              ...obraSnap.data()
            };
          }

          const historiaSnap = await getDoc(doc(db, "historias", obraId));

          if (!historiaSnap.exists()) {
            return null;
          }

          return {
            id: historiaSnap.id,
            source: "historias",
            route: `/obra/${historiaSnap.id}`,
            detailRoute: `/obra/${historiaSnap.id}`,
            ...historiaSnap.data()
          };
        };
        const progresoMap = new Map(
          Object.entries(progresoLectura).map(([obraId, progreso]) => [
            obraId,
            {
              obraId,
              ...progreso
            }
          ])
        );

        try {
          const progresoSnap = await getDocs(
            collection(db, "usuarios", user.uid, "progreso")
          );

          progresoSnap.docs.forEach((progresoDoc) => {
            progresoMap.set(progresoDoc.id, {
              obraId: progresoDoc.id,
              ...progresoDoc.data()
            });
          });
        } catch {
          // El mapa legacy progresoLectura mantiene compatibilidad.
        }

        const leyendoDocs = await Promise.all(
          [...progresoMap.values()]
            .sort((a, b) => getProgressDateValue(b) - getProgressDateValue(a))
            .slice(0, 8)
            .map(async (progreso) => {
              const obraId = progreso.obraId || progreso.historiaId;
              const obra = await cargarObraCompat(obraId);

              if (!obra) return null;

              return {
                ...obra,
                progresoLectura: progreso,
                continueRoute:
                  progreso.ruta ||
                  (progreso.traduccionId
                    ? `/obra/${obraId}/traducciones/${progreso.traduccionId}/capitulo/${progreso.capituloId || progreso.ultimoCapituloId}`
                    : `/obra/${obraId}/capitulo/${progreso.capituloId || progreso.ultimoCapituloId}`),
                ultimoCapituloDisponible: progreso.ultimoDisponibleNumero
                  ? {
                      id: progreso.ultimoDisponibleId || "",
                      orden: progreso.ultimoDisponibleNumero,
                      titulo: progreso.ultimoDisponibleTitulo || ""
                    }
                  : null
              };
            })
        );

        setLeyendo(leyendoDocs.filter(Boolean));

        const followedDocs = await Promise.all(
          followedIds.map(async (obraId) => {
            const historia = await cargarObraCompat(obraId);

            if (!historia) return null;

            let capitulosSnap;

            try {
              capitulosSnap = await getDocs(
                collection(db, "obras", obraId, "capitulos")
              );
            } catch {
              capitulosSnap = { docs: [] };
            }

            if (!capitulosSnap.docs?.length) {
              try {
                capitulosSnap = await getDocs(
                  collection(db, "historias", obraId, "capitulos")
                );
              } catch {
                capitulosSnap = { docs: [] };
              }
            }

            const capitulosData = capitulosSnap.docs.map((capituloDoc) => ({
              id: capituloDoc.id,
              ...capituloDoc.data()
            }));
            const capitulosVisibles = getDisplayChapters(historia, capitulosData);
            const ultimoCapituloDisponible =
              capitulosVisibles[capitulosVisibles.length - 1] || null;
            const progreso = progresoMap.get(obraId) || progresoLectura[obraId] || null;

            return {
              ...historia,
              progresoLectura: progreso,
              primerCapituloDisponible: capitulosVisibles[0] || null,
              ultimoCapituloDisponible,
              hayNuevoCapitulo: hasNewChapter(progreso, ultimoCapituloDisponible)
            };
          })
        );

        setHistoriasSeguidas(followedDocs.filter(Boolean));

        try {
          const capitulosSnap = await getDocs(
            query(collectionGroup(db, "capitulos"), where("traductorId", "==", user.uid))
          );

          setCapitulosTraducidos(
            capitulosSnap.docs.map((capituloDoc) => ({
              id: capituloDoc.id,
              historiaId: capituloDoc.ref.parent.parent?.id,
              ...capituloDoc.data()
            }))
          );
        } catch {
          setCapitulosTraducidos([]);
        }
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    cargarPerfil();
  }, [user]);

  const publicaciones = useMemo(
    () => [...historiasCreadas, ...traduccionesSubidas],
    [historiasCreadas, traduccionesSubidas]
  );

  const estadisticas = useMemo(
    () => ({
      historias: historiasCreadas.length,
      traducciones: traduccionesSubidas.length,
      seguidas: historiasSeguidas.length,
      capitulosLeidos: Number(perfilUsuario.capitulosLeidos || 0) || 0,
      vistas: publicaciones.reduce(
        (total, historia) => total + getViewsCount(historia),
        0
      ),
      likes: publicaciones.reduce(
        (total, historia) => total + getLikesCount(historia),
        0
      ),
      comentarios: publicaciones.reduce(
        (total, historia) => total + getCommentsCount(historia),
        0
      )
    }),
    [
      historiasCreadas,
      historiasSeguidas.length,
      perfilUsuario.capitulosLeidos,
      publicaciones,
      traduccionesSubidas.length
    ]
  );

  const guardarPerfil = async () => {
    if (!user) return;

    try {
      const perfilRef = doc(db, "usuarios", user.uid);

      await setDoc(
        perfilRef,
        {
          nombre,
          bio,
          foto,
          fotoUrl: foto,
          updatedAt: new Date()
        },
        { merge: true }
      );

      setEditando(false);
      alert("Perfil guardado");
    } catch (error) {
      console.error(error);
      alert("Error al guardar el perfil");
    }
  };

  if (!user) {
    return <p className="page">No estas logueado</p>;
  }

  if (loading) {
    return <p className="page">Cargando perfil...</p>;
  }

  return (
    <main className="page page-profile">
      <section className="profile-hero">
        <div className="profile-avatar-large">
          {foto ? (
            <img src={foto} alt={nombre || user.email} />
          ) : (
            <span>{(nombre || user.email || "N").slice(0, 1).toUpperCase()}</span>
          )}
        </div>

        <div className="profile-main">
          {editando ? (
            <>
              <p className="section-kicker">Editar perfil</p>
              <input
                placeholder="Nombre"
                value={nombre}
                onChange={(event) => setNombre(event.target.value)}
                className="form-field"
              />

              <textarea
                placeholder="Biografia"
                value={bio}
                onChange={(event) => setBio(event.target.value)}
                rows={4}
                className="form-field full-width"
              />

              <input
                placeholder="URL de imagen de perfil"
                value={foto}
                onChange={(event) => setFoto(event.target.value)}
                className="form-field"
              />

              <div className="image-preview image-preview-small">
                <div className="image-preview-frame">
                  {foto ? (
                    <img src={foto} alt="Vista previa del perfil" />
                  ) : (
                    <span>{(nombre || user.email || "N").slice(0, 1).toUpperCase()}</span>
                  )}
                </div>
                <p>Vista previa de imagen de perfil</p>
              </div>

              <p className="permission-note">
                Por ahora la imagen se guarda como URL. El campo queda listo
                para migrar a Firebase Storage mas adelante.
              </p>

              <div className="profile-actions">
                <button onClick={guardarPerfil}>Guardar</button>
                <button
                  type="button"
                  className="btn-filter-reset"
                  onClick={() => setEditando(false)}
                >
                  Cancelar
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="section-kicker">Perfil</p>
              <h1>{nombre || "Sin nombre"}</h1>
              <p className="profile-email">{user.email}</p>
              <p className="profile-bio">
                {bio || "Todavia no hay biografia."}
              </p>

              <button onClick={() => setEditando(true)}>Editar perfil</button>
            </>
          )}
        </div>
      </section>

      <section className="profile-stats-grid">
        <span>
          <strong>{estadisticas.historias}</strong>
          historias
        </span>
        <span>
          <strong>{estadisticas.traducciones}</strong>
          traducciones
        </span>
        <span>
          <strong>{estadisticas.seguidas}</strong>
          seguidas
        </span>
        <span>
          <strong>{estadisticas.capitulosLeidos}</strong>
          capitulos leidos
        </span>
        <span>
          <strong>{estadisticas.vistas}</strong>
          vistas
        </span>
        <span>
          <strong>{estadisticas.likes}</strong>
          likes recibidos
        </span>
        <span>
          <strong>{estadisticas.comentarios}</strong>
          comentarios
        </span>
      </section>

      <ProfileSection title="Historias creadas" empty="Todavia no creaste historias.">
        {historiasCreadas.map((historia) => (
          <StoryCard
            key={historia.id}
            historia={historia}
            resumenCaracteres={90}
            compact
          />
        ))}
      </ProfileSection>

      <ProfileSection title="Traducciones subidas" empty="Todavia no subiste traducciones.">
        {traduccionesSubidas.map((historia) => (
          <StoryCard
            key={historia.id}
            historia={historia}
            resumenCaracteres={90}
            compact
          />
        ))}

        {capitulosTraducidos.length > 0 && (
          <div className="translated-chapter-list">
            {capitulosTraducidos.map((capitulo) => (
              <Link
                key={`${capitulo.historiaId}-${capitulo.id}`}
                to={`/historia/${capitulo.historiaId}/capitulo/${capitulo.id}`}
                className="translated-chapter-item"
              >
                <strong>{capitulo.titulo || "Capitulo traducido"}</strong>
                <span>{capitulo.estado || "pendiente"}</span>
              </Link>
            ))}
          </div>
        )}
      </ProfileSection>

      <ProfileSection title="Leyendo" empty="Todavia no hay progreso de lectura.">
        {leyendo.map((historia) => (
          <FollowedStoryItem
            key={`leyendo-${historia.id}`}
            historia={historia}
          />
        ))}
      </ProfileSection>

      <ProfileSection title="Historias seguidas" empty="Todavia no seguis historias.">
        {historiasSeguidas.map((historia) => (
          <FollowedStoryItem
            key={historia.id}
            historia={historia}
          />
        ))}
      </ProfileSection>
    </main>
  );
}

function FollowedStoryItem({ historia }) {
  const progreso = historia.progresoLectura;
  const progressChapterId = progreso?.capituloId || progreso?.ultimoCapituloId;
  const progressChapterTitle =
    progreso?.tituloCapitulo || progreso?.ultimoCapituloTitulo;
  const progressChapterNumber =
    progreso?.numeroCapitulo ||
    progreso?.ultimoCapituloNumero ||
    progreso?.ultimoCapituloOrden;
  const capituloContinuar =
    progressChapterId && progressChapterId !== ""
      ? {
          id: progressChapterId,
          titulo: progressChapterTitle,
          orden: progressChapterNumber
        }
      : historia.primerCapituloDisponible;
  const detalleRuta = historia.detailRoute || historia.route || `/obra/${historia.id}`;
  const continuarRuta =
    historia.continueRoute ||
    progreso?.ruta ||
    (capituloContinuar?.id
      ? `/obra/${historia.id}/capitulo/${capituloContinuar.id}`
      : detalleRuta);
  const descripcion = getStoryDescription(historia);

  return (
    <article
      className={`followed-story-item ${
        historia.hayNuevoCapitulo ? "followed-story-item-new" : ""
      }`}
    >
      <div className="followed-story-main">
        <div>
          <div className="story-card-topline">
            <span className="story-pill">
              {progreso?.tipo === "traduccion" || isTranslation(historia)
                ? "Traduccion"
                : "Original"}
            </span>
            {historia.hayNuevoCapitulo && (
              <span className="new-chapter-badge">Nuevo capitulo</span>
            )}
          </div>

          <Link to={detalleRuta} className="followed-story-title">
            {historia.titulo || "Sin titulo"}
          </Link>

          <p className="followed-story-description">
            {descripcion || "Sin descripcion disponible."}
          </p>
        </div>

        <div className="followed-story-actions">
          <Link to={continuarRuta} className="btn-link btn-link-primary">
            {progressChapterId ? "Continuar" : "Empezar"}
          </Link>
          <Link to={detalleRuta} className="btn-link btn-link-ghost">
            Detalle
          </Link>
        </div>
      </div>

      <dl className="followed-story-progress">
        <div>
          <dt>Ultimo visto</dt>
          <dd>
            {progressChapterId
              ? getChapterLabel({
                  id: progressChapterId,
                  titulo: progressChapterTitle,
                  orden: progressChapterNumber
                })
              : "Sin lectura registrada"}
          </dd>
        </div>

        <div>
          <dt>Ultimo disponible</dt>
          <dd>{getChapterLabel(historia.ultimoCapituloDisponible)}</dd>
        </div>
      </dl>
    </article>
  );
}

function ProfileSection({ title, empty, children }) {
  const visibleChildren = Array.isArray(children)
    ? children.flat(Infinity).filter(Boolean)
    : children
      ? [children]
      : [];

  return (
    <section className="home-section profile-section">
      <div className="section-heading">
        <p className="section-kicker">Actividad</p>
        <h2>{title}</h2>
      </div>

      {visibleChildren.length > 0 ? (
        <div className="compact-story-list">{visibleChildren}</div>
      ) : (
        <p className="empty-state">{empty}</p>
      )}
    </section>
  );
}
