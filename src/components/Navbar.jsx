import { Link, NavLink } from "react-router-dom";
import NotificationBell from "./NotificationBell";

const navClass = ({ isActive }) => `nav-link${isActive ? " nav-link-active" : ""}`;

export default function Navbar({ user, onLogout }) {
  return (
    <nav className="navbar">
      <Link to="/" className="logo">
        <span className="moon">UH</span>
        Umbral de Historias
      </Link>

      <div className="nav-right">
        <div className="nav-links">
          <NavLink to="/" end className={navClass}>
            Inicio
          </NavLink>
          <NavLink to="/explorar" className={navClass}>
            Explorar
          </NavLink>
          <NavLink to="/crear" className={navClass}>
            Crear
          </NavLink>
          <NavLink to="/traducir" className={navClass}>
            Obras traducibles
          </NavLink>
        </div>

        {user ? (
          <div className="nav-account">
            <NotificationBell user={user} />
            <NavLink to="/perfil" className={navClass}>
              Perfil
            </NavLink>
            <button onClick={onLogout} className="nav-link nav-button">
              Salir
            </button>
          </div>
        ) : (
          <div className="nav-account">
            <NavLink to="/login" className={navClass}>
              Login
            </NavLink>
          </div>
        )}
      </div>
    </nav>
  );
}
