import { useState } from "react";
import { db, auth } from "../firebase";
import { collection, addDoc, doc, getDoc } from "firebase/firestore";

export default function Crear() {
  const [titulo, setTitulo] = useState("");
  const [contenido, setContenido] = useState("");

  if (!auth.currentUser) {
    alert("Tenés que iniciar sesión");
    return;
  }

  const publicar = async () => {
    if (!titulo || !contenido) {
      alert("Completá todos los campos");
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

      await addDoc(collection(db, "historias"), {
        titulo,
        contenido,
        autor: nombre,
        autorId: auth.currentUser.uid,
        fotoAutor: foto,
        fecha: new Date(),
        likes: [],
        comentarios: []
      });

      alert("Historia publicada");

      setTitulo("");
      setContenido("");
    } catch (error) {
      console.error(error);
      alert("Error al publicar");
    }
  };

  return (
    <div className="page">
      <h2>Crear historia</h2>

      <input
        placeholder="Título"
        value={titulo}
        onChange={(e) => setTitulo(e.target.value)}
      />

      <br /><br />

      <textarea
        placeholder="Contenido..."
        value={contenido}
        onChange={(e) => setContenido(e.target.value)}
        rows={10}
        className="full-width"
      />

      <br /><br />

      <button onClick={publicar}>Publicar</button>
    </div>
  );
}
