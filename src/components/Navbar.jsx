import { Link } from "react-router-dom";
import SearchBar from "./SearchBar";

export default function Navbar({ user, busqueda, onBusquedaChange, onLogout }) {
  return (
    <nav className="navbar">
      <Link to="/" className="logo">
        <span className="moon">🌙</span>
        Narraluna
      </Link>

      <div className="nav-right">
        <SearchBar value={busqueda} onChange={onBusquedaChange} />

        <Link to="/">Inicio</Link>
        <Link to="/crear">Crear</Link>

        {user ? (
          <>
            <Link to="/perfil">Perfil</Link>
            <button onClick={onLogout} className="btn-logout">
              Salir
            </button>
          </>
        ) : (
          <Link to="/login">Login</Link>
        )}
      </div>
    </nav>
  );
}
