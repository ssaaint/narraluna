import { Link } from "react-router-dom";
import {
  getLikesCount,
  getStoryGenres,
  getStoryPreview,
  getStoryTags,
  getStoryType
} from "../utils/storyUtils";

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
  const cardClasses = [
    "card",
    "story-card",
    destacado ? "premium story-card-featured" : "",
    compact ? "story-card-compact" : ""
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <Link to={`/historia/${historia.id}`} className="story-link">
      <article className={cardClasses}>
        <div className="story-card-topline">
          {destacado && <span className="story-rank">Top {posicion}</span>}
          <span className="story-pill">{generos[0]}</span>
          <span className="story-pill story-pill-muted">
            {getStoryType(historia)}
          </span>
        </div>

        <h3>{historia.titulo || "Sin título"}</h3>

        <p className="story-meta">{historia.autor || "Autor desconocido"}</p>

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
