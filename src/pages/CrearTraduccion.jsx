import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { collection, doc, getDoc, getDocs } from "firebase/firestore";
import StoryCard from "../components/StoryCard";
import { auth, db } from "../firebase";
import { isAdmin } from "../utils/permissionUtils";
import { isTranslatableWork, sortByDate } from "../utils/storyUtils";

export default function CrearTraduccion() {
  const [obrasDisponibles, setObrasDisponibles] = useState([]);
  const [perfil, setPerfil] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const cargarObrasTraducibles = async () => {
      try {
        const [historiasSnapshot, obrasSnapshot] = await Promise.all([
          getDocs(collection(db, "historias")),
          getDocs(collection(db, "obras"))
        ]);

        const obras = obrasSnapshot.docs
          .map((obraDoc) => ({
            id: obraDoc.id,
            source: "obras",
            route: `/obra/${obraDoc.id}`,
            ...obraDoc.data()
          }))
          .filter(isTranslatableWork);
        const obrasIds = new Set(obras.map((obra) => obra.id));

        const historiasCompatibles = historiasSnapshot.docs
          .map((historiaDoc) => ({
            id: historiaDoc.id,
            source: "historias",
            route: `/obra/${historiaDoc.id}`,
            ...historiaDoc.data()
          }))
          .filter(
            (historia) =>
              !obrasIds.has(historia.id) && isTranslatableWork(historia)
          );

        setObrasDisponibles(sortByDate([...obras, ...historiasCompatibles]));

        if (auth.currentUser) {
          const perfilSnap = await getDoc(doc(db, "usuarios", auth.currentUser.uid));
          setPerfil(perfilSnap.exists() ? perfilSnap.data() : {});
        } else {
          setPerfil({});
        }
      } catch (error) {
        console.error("Error completo:", error);
      } finally {
        setLoading(false);
      }
    };

    cargarObrasTraducibles();
  }, []);

  const obrasExternas = useMemo(
    () =>
      obrasDisponibles.filter(
        (obra) =>
          obra.tipo === "obra_externa" ||
          obra.permiteTraducciones === true ||
          obra.estadoTraducible === true
      ),
    [obrasDisponibles]
  );

  if (loading) {
    return <p className="page">Cargando obras disponibles...</p>;
  }

  return (
    <main className="page page-explore">
      <section className="explore-header">
        <div>
          <p className="section-kicker">Traducciones</p>
          <h1>Obras disponibles para traducir</h1>
          <p>
            Esta seccion muestra fichas externas y obras que aceptan
            traducciones de forma explicita.
          </p>
        </div>

        <div className="hero-actions">
          {isAdmin(perfil) && (
            <Link to="/obras/crear" className="btn-link btn-link-primary">
              Crear ficha externa
            </Link>
          )}
          <Link to="/explorar" className="btn-link btn-link-ghost">
            Explorar biblioteca
          </Link>
        </div>
      </section>

      {!auth.currentUser && (
        <p className="empty-state">
          Podes explorar las obras disponibles. Para subir traducciones tenes
          que iniciar sesion y cumplir los requisitos de traductor.
        </p>
      )}

      <section className="home-section">
        <div className="section-heading">
          <p className="section-kicker">{obrasExternas.length} disponibles</p>
          <h2>Fichas traducibles</h2>
        </div>

        {obrasExternas.length > 0 ? (
          <div className="grid explore-grid">
            {obrasExternas.map((obra) => (
              <StoryCard key={`${obra.source}-${obra.id}`} historia={obra} />
            ))}
          </div>
        ) : (
          <p className="empty-state">
            Todavia no hay obras externas o historias habilitadas para traducir.
          </p>
        )}
      </section>
    </main>
  );
}
