import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <section className="profile-page">
      <article className="profile-card">
        <h1>Page not found</h1>
        <p className="hero-copy">
          The page you are looking for is not available. Use the navigation to return to the feed.
        </p>
        <Link className="primary-button" to="/">
          Go to home
        </Link>
      </article>
    </section>
  );
}
