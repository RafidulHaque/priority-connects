import { useEffect, useState } from "react";
import {
  addDoc,
  collection,
  doc,
  increment,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";

export default function PostCard({ post }) {
  const { user } = useAuth();
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState("");
  const [statusMessage, setStatusMessage] = useState("");

  useEffect(() => {
    const commentsQuery = query(
      collection(db, "comments"),
      where("postId", "==", post.id),
      orderBy("timestamp", "asc")
    );

    const unsubscribe = onSnapshot(commentsQuery, (snapshot) => {
      setComments(
        snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
      );
    });

    return unsubscribe;
  }, [post.id]);

  async function handleAddComment(event) {
    event.preventDefault();
    setStatusMessage("");

    if (!user) {
      setStatusMessage("Please log in to add comments.");
      return;
    }

    if (!commentText.trim()) {
      setStatusMessage("Comment cannot be empty.");
      return;
    }

    try {
      await addDoc(collection(db, "comments"), {
        postId: post.id,
        authorId: user.uid,
        authorName: user.displayName || "[User Name]",
        content: commentText.trim(),
        timestamp: serverTimestamp(),
      });
      setCommentText("");
      setStatusMessage("Comment saved.");
    } catch (error) {
      console.error("Comment save failed", error);
      setStatusMessage("Unable to save comment. Try again.");
    }
  }

  async function handleLike() {
    if (!user) {
      setStatusMessage("Log in to like posts.");
      return;
    }

    const postRef = doc(db, "posts", post.id);

    try {
      await updateDoc(postRef, {
        likes: increment(1),
      });
    } catch (error) {
      console.error("Like update failed", error);
      setStatusMessage("Unable to update like. Try again.");
    }
  }

  return (
    <article className="post-card">
      <div className="post-card-header">
        <div>
          <p className="eyebrow">Post</p>
          <h3>{post.authorName || "[User Name]"}</h3>
          <p className="post-meta">
            {post.role || "[Role]"} · {post.department || "[Department]"}
          </p>
        </div>
        <span className="timestamp">
          {post.timestamp?.toDate
            ? post.timestamp.toDate().toLocaleString()
            : "Just now"}
        </span>
      </div>

      <p className="post-body">{post.content}</p>

      <div className="post-footer">
        <button className="post-action" type="button" onClick={handleLike}>
          Like ({post.likes || 0})
        </button>
      </div>

      <div className="comment-section">
        <p className="section-label">Comments</p>
        {comments.length === 0 ? (
          <p className="comment-empty">No comments yet.</p>
        ) : (
          comments.map((comment) => (
            <div key={comment.id} className="comment-item">
              <p className="comment-author">
                {comment.authorName || "[User Name]"}
              </p>
              <p className="comment-text">{comment.content}</p>
            </div>
          ))
        )}

        <form className="comment-form" onSubmit={handleAddComment}>
          <textarea
            value={commentText}
            onChange={(event) => setCommentText(event.target.value)}
            placeholder="Write a comment..."
          />
          <button className="comment-button" type="submit">
            Post comment
          </button>
        </form>
        {statusMessage ? (
          <p className="status-message">{statusMessage}</p>
        ) : null}
      </div>
    </article>
  );
}
