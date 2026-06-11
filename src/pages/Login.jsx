import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!email.trim() || !password.trim()) {
      setError("Email and password are required.");
      return;
    }

    setIsSubmitting(true);

    try {
      await login(email.trim(), password);
      setSuccess("Login successful.");
      navigate("/");
    } catch (authError) {
      setError("Invalid credentials. Please try again.");
      console.error("Login error", authError);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="auth-page">
      <article className="auth-card">
        <p className="eyebrow">Sign in</p>
        <h1>Login to Priority Connects</h1>
        <p className="hero-copy">
          Access your priority group workspace and view posts.
        </p>

        <form onSubmit={handleSubmit} className="auth-form">
          <label>
            Email address
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
            />
          </label>

          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter your password"
            />
          </label>

          <button className="primary-button" type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Signing in..." : "Login"}
          </button>
        </form>

        {error && <p className="status-message error">{error}</p>}
        {success && <p className="status-message success">{success}</p>}

        <p className="switch-message">
          New to Priority Connects? <Link to="/signup">Create an account</Link>
        </p>
      </article>
    </section>
  );
}
