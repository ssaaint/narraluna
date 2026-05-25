import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { addDoc, collection, doc, getDoc } from "firebase/firestore";
import { auth, db } from "../firebase";

export default function Crear() {
  const navigate = useNavigate();

  const [titulo, setTitulo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [tituloCapitulo, setTituloCapitulo] = useState("Capítulo 1");
  const [contenido, setContenido] = useState("");

  const publicar = async () => {
    if (!auth.currentUser) {
      alert("Tenés que iniciar sesión");
      return;
    }

    if (!titulo.trim() || !contenido.trim()) {
      alert("Completá el título de la historia y el contenido del capítulo");
      return;
    }

    try {
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
        descripcion: descripcionFinal,
        autor: nombre,
        autorId: auth.currentUser.uid,
        fotoAutor: foto,
        fecha: new Date(),
        updatedAt: new Date(),
        cantidadCapitulos: 1,
        likes: [],
        comentarios: []
      });

      await addDoc(collection(db, "historias", historiaRef.id, "capitulos"), {
        titulo: tituloCapitulo || "Capítulo 1",
        contenido,
        orden: 1,
        fecha: new Date()
      });

      alert("Historia publicada");

      setTitulo("");
      setDescripcion("");
      setTituloCapitulo("Capítulo 1");
      setContenido("");

      navigate(`/historia/${historiaRef.id}`);
    } catch (error) {
      console.error(error);
      alert("Error al publicar");
    }
  };

  if (!auth.currentUser) {
    return <p className="page">Tenés que iniciar sesión para crear una historia.</p>;
  }

  return (
    <main className="page page-form">
      <p className="section-kicker">Nueva historia</p>
      <h2>Crear historia</h2>

      <input
        placeholder="Título de la historia"
        value={titulo}
        onChange={(event) => setTitulo(event.target.value)}
        className="form-field"
      />

      <textarea
        placeholder="Descripción o sinopsis..."
        value={descripcion}
        onChange={(event) => setDescripcion(event.target.value)}
        rows={4}
        className="form-field full-width"
      />

      <input
        placeholder="Título del primer capítulo"
        value={tituloCapitulo}
        onChange={(event) => setTituloCapitulo(event.target.value)}
        className="form-field"
      />

      <textarea
        placeholder="Contenido del primer capítulo..."
        value={contenido}
        onChange={(event) => setContenido(event.target.value)}
        rows={12}
        className="form-field full-width"
      />

      <button onClick={publicar}>Publicar historia</button>
    </main>
  );
}
