import { useEffect, useState } from "react";
import { collection, onSnapshot, orderBy, query, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import PostCard from "../components/PostCard";
import { Link } from "react-router-dom";

export default function Home() {
  const { user } = useAuth();
  const [posts, setPosts] = useState([]);
  const [newPost, setNewPost] = useState("");
  const [statusMessage, setStatusMessage] = useState("");

  useEffect(() => {
    const postsQuery = query(collection(db, "posts"), orderBy("timestamp", "desc"));
    const unsubscribe = onSnapshot(postsQuery, (snapshot) => {
      setPosts(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    });

    return unsubscribe;
  }, []);

  async function handleCreatePost(event) {
    event.preventDefault();
    setStatusMessage("");

    if (!user) {
      setStatusMessage("Please log in to create a post.");
      return;
    }

    if (!newPost.trim()) {
      setStatusMessage("Post content is required.");
      return;
    }

    try {
      await addDoc(collection(db, "posts"), {
        authorId: user.uid,
        authorName: user.displayName || "[User Name]",
        role: user.profile?.role || "[Role]",
        department: user.profile?.department || "[Department]",
        content: newPost.trim(),
        timestamp: serverTimestamp(),
        likes: 0,
      });
      setNewPost("");
      setStatusMessage("Post published successfully.");
    } catch (error) {
      console.error("Create post failed", error);
      setStatusMessage("Unable to publish post. Try again.");
    }
  }

  return (
    <section className="home-page">
      <div className="hero-card">
        <div>
          <p className="eyebrow">Internal communication platform</p>
          <h1>Priority Connects</h1>
          <p className="hero-copy">
            A polished feed for staff, interns, volunteers, and team leaders.
          </p>
        </div>
      </div>

      <section className="feed-section">
        <div className="section-header">
          <div>
            <p className="eyebrow">Team feed</p>
            <h2>Recent posts</h2>
          </div>
          <p className="section-note">
            Create posts, leave comments, and keep your priority group aligned.
          </p>
        </div>

        <article className="post-card create-post-card">
          <div className="post-card-header">
            <div>
              <p className="eyebrow">Create post</p>
              <h3>{user ? "Start a new discussion" : "Log in to post"}</h3>
            </div>
          </div>

          <form onSubmit={handleCreatePost} className="create-post-form">
            <textarea
              value={newPost}
              onChange={(event) => setNewPost(event.target.value)}
              placeholder={user ? "Share an update with your team..." : "Please log in to post."}
              disabled={!user}
            />
            <div className="form-actions">
              {user ? (
                <button className="primary-button" type="submit">
                  Publish post
                </button>
              ) : (
                <Link className="secondary-button" to="/login">
                  Go to login
                </Link>
              )}
            </div>
          </form>
          {statusMessage ? <p className="status-message">{statusMessage}</p> : null}
        </article>

        {posts.length === 0 ? (
          <p className="empty-state">No posts are available yet.</p>
        ) : (
          posts.map((post) => <PostCard key={post.id} post={post} />)
        )}
      </section>
    </section>
  );
}
