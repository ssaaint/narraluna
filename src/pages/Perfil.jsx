import { useEffect, useState } from "react";
import { auth, db } from "../firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { storage } from "../firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

export default function Perfil() {
  const user = auth.currentUser;

  const [nombre, setNombre] = useState("");
  const [bio, setBio] = useState("");
  const [foto, setFoto] = useState("");
  const [editando, setEditando] = useState(false);

  useEffect(() => {
    const cargarPerfil = async () => {
      if (!user) return;

      const perfilRef = doc(db, "usuarios", user.uid);
      const snap = await getDoc(perfilRef);

      if (snap.exists()) {
        const data = snap.data();
        setNombre(data.nombre || "");
        setBio(data.bio || "");
        setFoto(data.foto || "");
      }
    };

    cargarPerfil();
  }, [user]);

  const guardarPerfil = async () => {
    if (!user) return;

    try {
      const perfilRef = doc(db, "usuarios", user.uid);

      await setDoc(perfilRef, {
        nombre,
        bio,
        foto
      });

      alert("Perfil guardado");
    } catch (err) {
      console.error(err);
    }
  };

  if (!user) {
    return <p className="page">No estás logueado</p>;
  }

  return (
    <div className="page page-profile">
      <h2>Perfil</h2>

      <p><strong>Email:</strong> {user.email}</p>

      <br />

      {editando ? (
        <>
          <input
            placeholder="Nombre"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            className="profile-field"
          />

          <textarea
            placeholder="Biografía"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={4}
            className="profile-field"
          />

          <input
            type="file"
            onChange={async (e) => {
              const file = e.target.files[0];
              if (!file) return;

              const storageRef = ref(storage, "avatars/" + user.uid);

              await uploadBytes(storageRef, file);
              const url = await getDownloadURL(storageRef);

              setFoto(url);
            }}
          />

          <button
            onClick={() => {
              guardarPerfil();
              setEditando(false);
            }}
          >
            Guardar
          </button>
        </>
      ) : (
        <>
          {foto && (
            <img
              src={foto}
              alt="avatar"
              className="profile-avatar"
            />
          )}

          <p><strong>{nombre || "Sin nombre"}</strong></p>
          <p className="story-meta">{bio}</p>

          <button onClick={() => setEditando(true)}>
            Editar perfil
          </button>
        </>
      )}
    </div>
  );
}
