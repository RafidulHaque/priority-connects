import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    try {
      await logout();
      navigate("/login");
    } catch (error) {
      console.error("Logout failed", error);
    }
  }

  return (
    <header className="navbar-shell">
      <div className="navbar-brand">
        <div className="navbar-badge">PC</div>
        <div>
          <p className="navbar-title">Priority Connects</p>
          <p className="navbar-subtitle">Internal communication for priority groups</p>
        </div>
      </div>

      <nav className="navbar-links">
        <NavLink
          to="/"
          end
          className={({ isActive }) =>
            isActive ? "nav-link active" : "nav-link"
          }
        >
          Home
        </NavLink>
        <NavLink
          to="/profile"
          className={({ isActive }) =>
            isActive ? "nav-link active" : "nav-link"
          }
        >
          Profile
        </NavLink>

        {!user ? (
          <>
            <NavLink
              to="/login"
              className={({ isActive }) =>
                isActive ? "nav-link active" : "nav-link"
              }
            >
              Login
            </NavLink>
            <NavLink
              to="/signup"
              className={({ isActive }) =>
                isActive ? "nav-link active" : "nav-link"
              }
            >
              Sign Up
            </NavLink>
          </>
        ) : (
          <button className="nav-button" type="button" onClick={handleLogout}>
            Logout
          </button>
        )}
      </nav>
    </header>
  );
}
