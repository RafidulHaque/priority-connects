import { useEffect, useState } from "react";
import { collection, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { Link } from "react-router-dom";

export default function Profile() {
  const { user } = useAuth();
  const [recentPosts, setRecentPosts] = useState([]);

  useEffect(() => {
    if (!user) {
      setRecentPosts([]);
      return;
    }

    const postsQuery = query(
      collection(db, "posts"),
      where("authorId", "==", user.uid),
      orderBy("timestamp", "desc")
    );

    const unsubscribe = onSnapshot(postsQuery, (snapshot) => {
      setRecentPosts(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    });

    return unsubscribe;
  }, [user]);

  const profile = user?.profile || {};

  if (!user) {
    return (
      <section className="profile-page">
        <article className="profile-card">
          <h2>Profile</h2>
          <p className="hero-copy">
            Please log in to view your profile, posts, and activity.
          </p>
          <Link className="primary-button" to="/login">
            Go to login
          </Link>
        </article>
      </section>
    );
  }

  return (
    <section className="profile-page">
      <article className="profile-card">
        <div className="profile-header">
          <div className="profile-avatar">{profile.name ? profile.name.charAt(0) : "U"}</div>
          <div className="profile-details">
            <h2>{profile.name || "[User Name]"}</h2>
            <p>{profile.role || "[Role]"}</p>
            <p>{profile.department || "[Department]"}</p>
          </div>
        </div>

        <div className="profile-section">
          <p className="eyebrow">About</p>
          <p className="profile-copy">
            {profile.bio || "User biography will appear here."}
          </p>
        </div>

        <div className="profile-section">
          <p className="eyebrow">Recent posts</p>
          {recentPosts.length === 0 ? (
            <p className="comment-empty">No posts created yet.</p>
          ) : (
            <div className="activity-list">
              {recentPosts.map((post) => (
                <div key={post.id} className="activity-item">
                  <h3>{post.content.slice(0, 58)}{post.content.length > 58 ? "..." : ""}</h3>
                  <p>{post.timestamp?.toDate ? new Date(post.timestamp.toDate()).toLocaleString() : "Recent"}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </article>
    </section>
  );
}
