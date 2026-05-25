import { useEffect, useState } from "react";
import { db } from "../firebase";
import { collection, getDocs } from "firebase/firestore";
import StoryCard from "../components/StoryCard";

export default function Home({ busqueda = "" }) {
  const [historias, setHistorias] = useState({ top: [], otras: [] });

  useEffect(() => {
    const obtenerHistorias = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, "historias"));

        const datos = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data()
        }));

        datos.sort((a, b) => {
          const likesA = a.likes ? a.likes.length : 0;
          const likesB = b.likes ? b.likes.length : 0;
          return likesB - likesA;
        });

        const topHistorias = datos.slice(0, 3);
        const otrasHistorias = datos.slice(3);

        setHistorias({
          top: topHistorias,
          otras: otrasHistorias
        });
      } catch (error) {
        console.error(error);
      }
    };

    obtenerHistorias();
  }, []);

  const filtradas = historias.otras.filter((h) =>
    (h.titulo || "").toLowerCase().includes((busqueda || "").toLowerCase())
  );

  console.log("historias:", historias);
  console.log("filtradas:", filtradas);

  return (
    <div className="page page-home">
      <h2 className="section-title">🔥 Historias destacadas</h2>

      <div className="featured-grid">
        {historias.top.map((historia, index) => (
          <StoryCard
            key={historia.id}
            historia={historia}
            destacado
            posicion={index + 1}
            resumenCaracteres={120}
          />
        ))}
      </div>

      <h2 className="section-title section-title-spaced">
        📚 Explorar historias
      </h2>

      <div className="grid">
        {filtradas.map((historia) => (
          <StoryCard key={historia.id} historia={historia} />
        ))}
      </div>
    </div>
  );
}
