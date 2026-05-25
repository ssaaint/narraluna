import { useState, useEffect } from "react";
import { Routes, Route } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "./firebase";

import Home from "./pages/Home";
import Perfil from "./pages/Perfil";
import Crear from "./pages/Crear";
import Login from "./pages/Login";
import Lectura from "./pages/Lectura";
import Navbar from "./components/Navbar";
import Stars from "./components/Stars";

export default function App() {
  const [user, setUser] = useState(null);
  const [busqueda, setBusqueda] = useState("");

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
        busqueda={busqueda}
        onBusquedaChange={setBusqueda}
        onLogout={() => auth.signOut()}
      />

      <Routes>
        <Route path="/" element={<Home busqueda={busqueda} />} />
        <Route path="/perfil" element={<Perfil />} />
        <Route path="/crear" element={<Crear />} />
        <Route path="/login" element={<Login />} />
        <Route path="/historia/:id" element={<Lectura />} />
      </Routes>
    </div>
  );
}
