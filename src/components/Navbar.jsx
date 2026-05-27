import { Link, NavLink } from "react-router-dom";
import NotificationBell from "./NotificationBell";

const navClass = ({ isActive }) => `nav-link${isActive ? " nav-link-active" : ""}`;

export default function Navbar({ user, onLogout }) {
  return (
    <nav className="navbar">
      <Link to="/" className="logo">
        <span className="moon">NL</span>
        Narraluna
      </Link>

      <div className="nav-right">
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

        {user ? (
          <>
            <NotificationBell user={user} />
            <NavLink to="/perfil" className={navClass}>
              Perfil
            </NavLink>
            <button onClick={onLogout} className="nav-link nav-button">
              Salir
            </button>
          </>
        ) : (
          <NavLink to="/login" className={navClass}>
            Login
          </NavLink>
        )}
      </div>
    </nav>
  );
}
