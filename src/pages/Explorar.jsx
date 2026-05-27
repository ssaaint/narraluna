import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  collection,
  collectionGroup,
  getDocs
} from "firebase/firestore";
import SearchBar from "../components/SearchBar";
import StoryCard from "../components/StoryCard";
import { db } from "../firebase";
import {
  ALL_FILTER,
  STORY_TYPE_EXTERNAL_WORK,
  STORY_TYPE_ORIGINAL,
  STORY_TYPE_TRANSLATION,
  getStoryGenres,
  getStoryRawType,
  getViewsCount,
  sortByDate,
  sortByLikes,
  storyMatchesSearch,
  uniqueList
} from "../utils/storyUtils";
import { buildLibraryItems } from "../utils/libraryUtils";

const initialFilters = {
  genero: ALL_FILTER,
  tipo: ALL_FILTER
};

const exploreModes = [
  { value: "recientes", label: "Recientes" },
  { value: "populares", label: "Populares" },
  { value: "mas-vistas", label: "Mas vistas" },
  { value: "mas-likeadas", label: "Mas likeadas" }
];

const typeOptions = [
  { value: ALL_FILTER, label: "Todos" },
  { value: STORY_TYPE_ORIGINAL, label: "Originales" },
  { value: STORY_TYPE_EXTERNAL_WORK, label: "Obras externas" },
  { value: STORY_TYPE_TRANSLATION, label: "Traducciones" }
];

const sortStories = (stories, mode) => {
  if (mode === "recientes") return sortByDate(stories);
  if (mode === "mas-vistas") {
    return [...stories].sort((a, b) => getViewsCount(b) - getViewsCount(a));
  }

  return sortByLikes(stories);
};

export default function Explorar() {
  const [searchParams] = useSearchParams();
  const [items, setItems] = useState([]);
  const [busqueda, setBusqueda] = useState("");
  const [filtros, setFiltros] = useState(() => ({
    ...initialFilters,
    genero: searchParams.get("genero") || ALL_FILTER
  }));
  const [modo, setModo] = useState("recientes");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const cargarBiblioteca = async () => {
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

        let traducciones = [];

        try {
          const traduccionesSnap = await getDocs(collectionGroup(db, "traducciones"));

          traducciones = traduccionesSnap.docs.map((traduccionDoc) => {
            const obraId = traduccionDoc.ref.parent.parent?.id || "";
            const obra = libraryItems.find((item) => item.id === obraId) || {};
            const data = traduccionDoc.data();

            return {
              id: traduccionDoc.id,
              obraId,
              source: "traducciones",
              route: obraId ? `/obra/${obraId}` : "/traducir",
              tipo: STORY_TYPE_TRANSLATION,
              titulo: data.titulo || `${obra.titulo || "Obra"} - traduccion`,
              autor:
                data.traductorPrincipalNombre ||
                data.traductorEmail ||
                "Traductor registrado",
              descripcion: obra.titulo
                ? `Traduccion de ${obra.titulo}`
                : "Traduccion pendiente",
              historiaOriginalTitulo: obra.titulo || "",
              generos: obra.generos || [],
              etiquetas: obra.etiquetas || [],
              portada: obra.portada || "",
              portadaUrl: obra.portadaUrl || obra.portada || "",
              idiomaDestino: data.idiomaDestino || "",
              estado: data.estado || "pendiente",
              fecha: data.updatedAt || data.fecha || null,
              updatedAt: data.updatedAt || data.fecha || null
            };
          });
        } catch {
          traducciones = [];
        }

        setItems([...libraryItems, ...traducciones]);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    cargarBiblioteca();
  }, []);

  const generos = useMemo(
    () => uniqueList(items.flatMap(getStoryGenres)),
    [items]
  );

  const resultados = useMemo(() => {
    const filtradas = items.filter((historia) => {
      const matchesSearch = storyMatchesSearch(historia, busqueda);
      const matchesGenre =
        filtros.genero === ALL_FILTER ||
        getStoryGenres(historia).includes(filtros.genero);
      const matchesType =
        filtros.tipo === ALL_FILTER ||
        getStoryRawType(historia) === filtros.tipo;

      return matchesSearch && matchesGenre && matchesType;
    });

    return sortStories(filtradas, modo);
  }, [busqueda, filtros, items, modo]);

  const updateFilter = (name, value) => {
    setFiltros((current) => ({
      ...current,
      [name]: value
    }));
  };

  return (
    <main className="page page-explore">
      <section className="explore-header">
        <div>
          <p className="section-kicker">Explorar</p>
          <h1>Encontra tu proxima lectura</h1>
          <p>
            Busca por titulo, autor, genero, etiquetas o descripcion y filtra la
            biblioteca sin volver al inicio.
          </p>
        </div>
      </section>

      <section className="explore-controls">
        <SearchBar value={busqueda} onChange={setBusqueda} />

        <div className="filters-panel explore-filters">
          <label className="filter-field">
            <span>Genero</span>
            <select
              value={filtros.genero}
              onChange={(event) => updateFilter("genero", event.target.value)}
            >
              <option value={ALL_FILTER}>Todos</option>
              {generos.map((genero) => (
                <option key={genero} value={genero}>
                  {genero}
                </option>
              ))}
            </select>
          </label>

          <label className="filter-field">
            <span>Tipo</span>
            <select
              value={filtros.tipo}
              onChange={(event) => updateFilter("tipo", event.target.value)}
            >
              {typeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="filter-field">
            <span>Orden</span>
            <select
              value={modo}
              onChange={(event) => setModo(event.target.value)}
            >
              {exploreModes.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            className="btn-filter-reset"
            onClick={() => {
              setBusqueda("");
              setFiltros(initialFilters);
              setModo("recientes");
            }}
          >
            Limpiar
          </button>
        </div>
      </section>

      <section className="home-section">
        <div className="section-heading">
          <p className="section-kicker">
            {loading ? "Cargando" : `${resultados.length} resultados`}
          </p>
          <h2>Resultados</h2>
        </div>

        {resultados.length > 0 ? (
          <div className="grid explore-grid">
            {resultados.map((historia) => (
              <StoryCard
                key={`${historia.source || "item"}-${historia.obraId || "obra"}-${historia.id}`}
                historia={historia}
              />
            ))}
          </div>
        ) : (
          <p className="empty-state">
            No hay obras o historias para esa busqueda o esos filtros.
          </p>
        )}
      </section>
    </main>
  );
}
