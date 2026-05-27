import { Link } from "react-router-dom";
import {
  getLikesCount,
  getStoryGenres,
  getStoryPreview,
  getStoryStatus,
  getStoryTags,
  getStoryType,
  isTranslation
} from "../utils/storyUtils";

const getCoverUrl = (historia) =>
  historia.portadaUrl ||
  historia.portada ||
  historia.coverUrl ||
  historia.imagen ||
  historia.imageUrl ||
  "";

const getAuthorAvatar = (historia) =>
  historia.fotoAutor ||
  historia.avatarAutor ||
  historia.autorFoto ||
  historia.creadoPorFoto ||
  "";

const getAuthorName = (historia) =>
  historia.autor ||
  historia.autorNombre ||
  historia.creadoPorNombre ||
  historia.autorOriginal ||
  "Autor desconocido";

const getStoryRoute = (historia) =>
  historia.route ||
  (historia.source === "historias" && historia.tipo === "traduccion"
    ? `/historia/${historia.id}`
    : `/obra/${historia.obraId || historia.id}`);

export default function StoryCard({
  historia,
  destacado = false,
  posicion,
  resumenCaracteres = 80,
  compact = false
}) {
  const likes = getLikesCount(historia);
  const generos = getStoryGenres(historia);
  const etiquetas = getStoryTags(historia).slice(0, 3);
  const resumen = getStoryPreview(historia).slice(0, resumenCaracteres);
  const estado = getStoryStatus(historia);
  const coverUrl = getCoverUrl(historia);
  const authorAvatar = getAuthorAvatar(historia);
  const authorName = getAuthorName(historia);
  const cardClasses = [
    "card",
    "story-card",
    destacado ? "premium story-card-featured" : "",
    compact ? "story-card-compact" : ""
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <Link to={getStoryRoute(historia)} className="story-link">
      <article className={cardClasses}>
        <div className="story-card-cover">
          {coverUrl ? (
            <img src={coverUrl} alt={historia.titulo || "Portada"} />
          ) : (
            <span>{(historia.titulo || "N").slice(0, 1).toUpperCase()}</span>
          )}
        </div>

        <div className="story-card-topline">
          {destacado && <span className="story-rank">Top {posicion}</span>}
          <span className="story-pill">{generos[0]}</span>
          <span className="story-pill story-pill-muted">
            {getStoryType(historia)}
          </span>
          {estado && (
            <span className={`story-pill story-status story-status-${estado}`}>
              {estado}
            </span>
          )}
        </div>

        <h3>{historia.titulo || "Sin título"}</h3>

        <div className="story-author-row">
          <div className="story-author-avatar">
            {authorAvatar ? (
              <img src={authorAvatar} alt={authorName} />
            ) : (
              <span>{authorName.slice(0, 1).toUpperCase()}</span>
            )}
          </div>
          <p className="story-meta">{authorName}</p>
        </div>

        {isTranslation(historia) && historia.historiaOriginalTitulo && (
          <p className="story-origin">
            Traduccion de {historia.historiaOriginalTitulo}
          </p>
        )}

        <p className="story-excerpt">{resumen}...</p>

        {etiquetas.length > 0 && (
          <div className="story-tags">
            {etiquetas.map((etiqueta) => (
              <span key={etiqueta}>#{etiqueta}</span>
            ))}
          </div>
        )}

        <div className="story-card-footer">
          <span>{likes} likes</span>
          <span>Ver detalle</span>
        </div>
      </article>
    </Link>
  );
}
