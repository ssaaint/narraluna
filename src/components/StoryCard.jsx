import { Link } from "react-router-dom";

export default function StoryCard({
  historia,
  destacado = false,
  posicion,
  resumenCaracteres = 80
}) {
  return (
    <Link to={`/historia/${historia.id}`} className="story-link">
      <div className={`card story-card${destacado ? " premium" : ""}`}>
        {destacado && <p className="story-rank">👑 Top {posicion}</p>}

        <h3>{historia.titulo}</h3>

        <p className="story-meta">{historia.autor}</p>

        <p>{historia.contenido.slice(0, resumenCaracteres)}...</p>

        <p>❤️ {historia.likes?.length || 0}</p>
      </div>
    </Link>
  );
}
