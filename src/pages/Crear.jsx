import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where
} from "firebase/firestore";
import { auth, db } from "../firebase";
import { createSlug } from "../utils/slugUtils";

export default function Crear() {
  const navigate = useNavigate();

  const [titulo, setTitulo] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEditado, setSlugEditado] = useState(false);
  const [descripcion, setDescripcion] = useState("");
  const [tituloCapitulo, setTituloCapitulo] = useState("Capitulo 1");
  const [contenido, setContenido] = useState("");

  const actualizarTitulo = (value) => {
    setTitulo(value);

    if (!slugEditado) {
      setSlug(createSlug(value));
    }
  };

  const publicar = async () => {
    if (!auth.currentUser) {
      alert("Tenes que iniciar sesion");
      return;
    }

    if (!titulo.trim() || !contenido.trim()) {
      alert("Completa el titulo de la historia y el contenido del capitulo");
      return;
    }

    const slugFinal = createSlug(slug || titulo);

    if (!slugFinal) {
      alert("La historia necesita un slug valido");
      return;
    }

    try {
      const slugQuery = query(
        collection(db, "historias"),
        where("slug", "==", slugFinal)
      );
      const slugSnapshot = await getDocs(slugQuery);

      if (!slugSnapshot.empty) {
        alert("Ese slug ya existe. Elegi otro nombre unico.");
        return;
      }

      const userRef = doc(db, "usuarios", auth.currentUser.uid);
      const userSnap = await getDoc(userRef);

      let nombre = auth.currentUser.email;
      let foto = "";

      if (userSnap.exists()) {
        const data = userSnap.data();
        nombre = data.nombre || nombre;
        foto = data.foto || "";
      }

      const descripcionFinal = descripcion.trim() || contenido.trim().slice(0, 180);

      const historiaRef = await addDoc(collection(db, "historias"), {
        titulo,
        slug: slugFinal,
        tipo: "original",
        descripcion: descripcionFinal,
        autor: nombre,
        autorId: auth.currentUser.uid,
        colaboradoresPermitidos: [],
        fotoAutor: foto,
        fecha: new Date(),
        updatedAt: new Date(),
        cantidadCapitulos: 1,
        likes: [],
        comentarios: []
      });

      await addDoc(collection(db, "historias", historiaRef.id, "capitulos"), {
        titulo: tituloCapitulo || "Capitulo 1",
        contenido,
        orden: 1,
        fecha: new Date(),
        updatedAt: new Date()
      });

      alert("Historia publicada");

      setTitulo("");
      setSlug("");
      setSlugEditado(false);
      setDescripcion("");
      setTituloCapitulo("Capitulo 1");
      setContenido("");

      navigate(`/historia/${historiaRef.id}`);
    } catch (error) {
      console.error(error);
      alert("Error al publicar");
    }
  };

  if (!auth.currentUser) {
    return <p className="page">Tenes que iniciar sesion para crear una historia.</p>;
  }

  return (
    <main className="page page-form">
      <p className="section-kicker">Historia original</p>
      <h2>Crear historia</h2>

      <input
        placeholder="Titulo de la historia"
        value={titulo}
        onChange={(event) => actualizarTitulo(event.target.value)}
        className="form-field"
      />

      <input
        placeholder="slug-unico"
        value={slug}
        onChange={(event) => {
          setSlugEditado(true);
          setSlug(createSlug(event.target.value));
        }}
        className="form-field"
      />

      <textarea
        placeholder="Descripcion o sinopsis..."
        value={descripcion}
        onChange={(event) => setDescripcion(event.target.value)}
        rows={4}
        className="form-field full-width"
      />

      <input
        placeholder="Titulo del primer capitulo"
        value={tituloCapitulo}
        onChange={(event) => setTituloCapitulo(event.target.value)}
        className="form-field"
      />

      <textarea
        placeholder="Contenido del primer capitulo..."
        value={contenido}
        onChange={(event) => setContenido(event.target.value)}
        rows={12}
        className="form-field full-width"
      />

      <button onClick={publicar}>Publicar historia original</button>
    </main>
  );
}
