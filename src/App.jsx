import { useState, useEffect } from "react";
import { Routes, Route } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "./firebase";

import Home from "./pages/Home";
import Explorar from "./pages/Explorar";
import Perfil from "./pages/Perfil";
import Crear from "./pages/Crear";
import CrearObra from "./pages/CrearObra";
import CrearTraduccion from "./pages/CrearTraduccion";
import Login from "./pages/Login";
import HistoriaDetalle from "./pages/HistoriaDetalle";
import CapituloLectura from "./pages/CapituloLectura";
import NuevoCapitulo from "./pages/NuevoCapitulo";
import EditarCapitulo from "./pages/EditarCapitulo";
import ObraDetalle from "./pages/ObraDetalle";
import EditarObra from "./pages/EditarObra";
import ObraCapituloLectura from "./pages/ObraCapituloLectura";
import SubirTraduccionObra from "./pages/SubirTraduccionObra";
import Navbar from "./components/Navbar";
import Stars from "./components/Stars";

export default function App() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });

    return () => unsubscribe();
  }, []);

  return (
    <div className="app">
      <Stars />

      <Navbar
        user={user}
        onLogout={() => auth.signOut()}
      />

      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/explorar" element={<Explorar />} />
        <Route path="/perfil" element={<Perfil />} />
        <Route path="/crear" element={<Crear />} />
        <Route path="/obras/crear" element={<CrearObra />} />
        <Route path="/traducir" element={<CrearTraduccion />} />
        <Route path="/login" element={<Login />} />
        <Route path="/obra/:obraId" element={<ObraDetalle />} />
        <Route path="/obra/:obraId/editar" element={<EditarObra />} />
        <Route
          path="/obra/:obraId/capitulo/:capituloId"
          element={<ObraCapituloLectura />}
        />
        <Route
          path="/obra/:obraId/traducciones/:traduccionId/capitulo/:capituloId"
          element={<ObraCapituloLectura />}
        />
        <Route
          path="/obra/:obraId/subir-traduccion"
          element={<SubirTraduccionObra />}
        />
        <Route path="/historia/:id" element={<HistoriaDetalle />} />
        <Route
          path="/historia/:historiaId/capitulo/:capituloId"
          element={<CapituloLectura />}
        />
        <Route
          path="/historia/:historiaId/capitulo/:capituloId/editar"
          element={<EditarCapitulo />}
        />
        <Route
          path="/historia/:historiaId/nuevo-capitulo"
          element={<NuevoCapitulo />}
        />
      </Routes>
    </div>
  );
}
