import Navbar from "./Navbar";
import { Outlet } from "react-router-dom";

export default function Layout() {
  return (
    <div className="app-main">
      <Navbar />
      <main className="page-shell">
        <Outlet />
      </main>
    </div>
  );
}
