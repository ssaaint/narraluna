import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { collection, doc, getDoc, getDocs } from "firebase/firestore";
import { auth, db } from "../firebase";
import { LEGACY_CHAPTER_ID, getDisplayChapters } from "../utils/chapterUtils";
import { userCanManageStory } from "../utils/permissionUtils";

export default function CapituloLectura() {
  const { historiaId, capituloId } = useParams();

  const [historia, setHistoria] = useState(null);
  const [capitulos, setCapitulos] = useState([]);
  const [capituloActual, setCapituloActual] = useState(null);
  const [loading, setLoading] = useState(true);

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

        setHistoria(historiaData);
        setCapitulos(capitulosVisibles);
        setCapituloActual(
          capitulosVisibles.find((capitulo) => capitulo.id === capituloId) || null
        );
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
    userCanManageStory(auth.currentUser, historia) &&
    capituloActual.id !== LEGACY_CHAPTER_ID;

  return (
    <main className="page page-reader">
      <Link to={`/historia/${historiaId}`} className="text-link">
        Volver al detalle
      </Link>

      <p className="section-kicker">{historia.titulo}</p>
      <div className="chapter-reader-heading">
        <div>
          <h1>{capituloActual.titulo}</h1>
          <p className="muted">Capitulo {capituloActual.orden}</p>
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

      <hr className="divider" />

      <article className="chapter-content">
        {capituloActual.contenido}
      </article>

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
