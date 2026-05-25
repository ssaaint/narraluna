import { useEffect, useMemo, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import heroImage from "../assets/hero.png";
import StoryCard from "../components/StoryCard";
import {
  ALL_FILTER,
  getLikesCount,
  getStoryGenres,
  getStoryType,
  sortByDate,
  sortByLikes,
  storyMatchesFilters,
  storyMatchesSearch,
  uniqueList
} from "../utils/storyUtils";

const initialFilters = {
  genero: ALL_FILTER,
  tipo: ALL_FILTER,
  popularidad: ALL_FILTER
};

const popularityOptions = [
  { value: ALL_FILTER, label: "Todas" },
  { value: "populares", label: "Más populares" },
  { value: "con-likes", label: "Con likes" },
  { value: "sin-likes", label: "Sin likes" }
];

export default function Home({ busqueda = "" }) {
  const [historias, setHistorias] = useState({ top: [], otras: [] });
  const [filtros, setFiltros] = useState(initialFilters);

  useEffect(() => {
    const obtenerHistorias = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, "historias"));

        const datos = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data()
        }));

        const ordenadasPorLikes = sortByLikes(datos);

        setHistorias({
          top: ordenadasPorLikes.slice(0, 3),
          otras: ordenadasPorLikes.slice(3)
        });
      } catch (error) {
        console.error(error);
      }
    };

    obtenerHistorias();
  }, []);

  const todasLasHistorias = useMemo(
    () => [...historias.top, ...historias.otras],
    [historias]
  );

  const generos = useMemo(
    () => uniqueList(todasLasHistorias.flatMap(getStoryGenres)),
    [todasLasHistorias]
  );

  const tipos = useMemo(
    () => uniqueList(todasLasHistorias.map(getStoryType)),
    [todasLasHistorias]
  );

  const filtrosActivos =
    busqueda.trim() ||
    filtros.genero !== ALL_FILTER ||
    filtros.tipo !== ALL_FILTER ||
    filtros.popularidad !== ALL_FILTER;

  const historiasExploradas = useMemo(() => {
    const base = filtrosActivos ? todasLasHistorias : historias.otras;

    const filtradas = base.filter(
      (historia) =>
        storyMatchesSearch(historia, busqueda) &&
        storyMatchesFilters(historia, filtros)
    );

    return filtros.popularidad === "populares" ? sortByLikes(filtradas) : filtradas;
  }, [busqueda, filtros, filtrosActivos, historias.otras, todasLasHistorias]);

  const recientes = useMemo(
    () => sortByDate(todasLasHistorias).slice(0, 4),
    [todasLasHistorias]
  );

  const populares = useMemo(
    () => sortByLikes(todasLasHistorias).slice(0, 4),
    [todasLasHistorias]
  );

  const generosConConteo = useMemo(
    () =>
      generos.map((genero) => ({
        genero,
        total: todasLasHistorias.filter((historia) =>
          getStoryGenres(historia).includes(genero)
        ).length
      })),
    [generos, todasLasHistorias]
  );

  const historiaPrincipal = historias.top[0];
  const totalLikes = todasLasHistorias.reduce(
    (total, historia) => total + getLikesCount(historia),
    0
  );

  const updateFilter = (name, value) => {
    setFiltros((current) => ({
      ...current,
      [name]: value
    }));
  };

  const selectGenero = (genero) => {
    setFiltros((current) => ({
      ...current,
      genero
    }));
  };

  return (
    <main className="page page-home">
      <section className="home-hero">
        <div className="home-hero-copy">
          <p className="section-kicker">Narraluna</p>
          <h1>Narraluna</h1>
          <p>
            Un refugio para historias nocturnas, autores cercanos y lecturas
            que crecen con cada like.
          </p>

          <div className="hero-actions">
            <a href="#explorar" className="btn-link btn-link-primary">
              Explorar historias
            </a>
            <a href="#destacadas" className="btn-link btn-link-ghost">
              Ver ranking
            </a>
          </div>

          <div className="hero-stats">
            <span>
              <strong>{todasLasHistorias.length}</strong>
              historias
            </span>
            <span>
              <strong>{totalLikes}</strong>
              likes
            </span>
            <span>
              <strong>{generos.length}</strong>
              géneros
            </span>
          </div>
        </div>

        <div className="home-hero-visual">
          <img src={heroImage} alt="" />

          {historiaPrincipal && (
            <div className="hero-spotlight">
              <span>Top de la luna</span>
              <strong>{historiaPrincipal.titulo}</strong>
              <p>{historiaPrincipal.autor}</p>
            </div>
          )}
        </div>
      </section>

      <section id="destacadas" className="home-section">
        <div className="section-heading">
          <p className="section-kicker">Ranking actual</p>
          <h2>Historias destacadas</h2>
        </div>

        <div className="featured-grid">
          {historias.top.map((historia, index) => (
            <StoryCard
              key={historia.id}
              historia={historia}
              destacado
              posicion={index + 1}
              resumenCaracteres={130}
            />
          ))}
        </div>
      </section>

      <section id="explorar" className="home-section">
        <div className="section-heading">
          <p className="section-kicker">Biblioteca</p>
          <h2>Explorar historias</h2>
        </div>

        <div className="filters-panel">
          <label className="filter-field">
            <span>Género</span>
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
              <option value={ALL_FILTER}>Todos</option>
              {tipos.map((tipo) => (
                <option key={tipo} value={tipo}>
                  {tipo}
                </option>
              ))}
            </select>
          </label>

          <label className="filter-field">
            <span>Popularidad</span>
            <select
              value={filtros.popularidad}
              onChange={(event) =>
                updateFilter("popularidad", event.target.value)
              }
            >
              {popularityOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            className="btn-filter-reset"
            onClick={() => setFiltros(initialFilters)}
          >
            Limpiar
          </button>
        </div>

        <p className="result-count">
          {historiasExploradas.length} historias encontradas
        </p>

        {historiasExploradas.length > 0 ? (
          <div className="grid explore-grid">
            {historiasExploradas.map((historia) => (
              <StoryCard key={historia.id} historia={historia} />
            ))}
          </div>
        ) : (
          <p className="empty-state">No hay historias para esos filtros.</p>
        )}
      </section>

      <section className="home-section">
        <div className="section-heading">
          <p className="section-kicker">Mapa de lectura</p>
          <h2>Géneros</h2>
        </div>

        <div className="genre-grid">
          {generosConConteo.map(({ genero, total }) => (
            <button
              key={genero}
              type="button"
              className={`genre-tile${
                filtros.genero === genero ? " genre-tile-active" : ""
              }`}
              onClick={() => selectGenero(genero)}
            >
              <span>{genero}</span>
              <strong>{total}</strong>
            </button>
          ))}
        </div>
      </section>

      <div className="home-lists">
        <section className="home-section">
          <div className="section-heading">
            <p className="section-kicker">Novedades</p>
            <h2>Recientes</h2>
          </div>

          <div className="compact-story-list">
            {recientes.map((historia) => (
              <StoryCard
                key={historia.id}
                historia={historia}
                resumenCaracteres={90}
                compact
              />
            ))}
          </div>
        </section>

        <section className="home-section">
          <div className="section-heading">
            <p className="section-kicker">Lecturas con más likes</p>
            <h2>Populares</h2>
          </div>

          <div className="compact-story-list">
            {populares.map((historia) => (
              <StoryCard
                key={historia.id}
                historia={historia}
                resumenCaracteres={90}
                compact
              />
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
