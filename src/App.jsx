import React, { useState, useEffect, useRef } from 'react';
import { auth, db, storage } from './firebase';
import { onAuthStateChanged, signOut, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { collection, addDoc, query, orderBy, onSnapshot, doc, updateDoc, setDoc, getDoc, where, deleteDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import './App.css';

export default function App() {
  const [user, setUser] = useState(null);
  const [currentView, setCurrentView] = useState('home-feed');

  // Authorization Form Inputs
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [isSignUpMode, setIsSignUpMode] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Collections Pipeline Storage arrays
  const [posts, setPosts] = useState([]);
  const [messages, setMessages] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [friendsList, setFriendsList] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [globalTeamsList, setGlobalTeamsList] = useState([]);

  // Subscribed routing pins
  const [myTeams, setMyTeams] = useState([]);

  // Control rendering switches
  const [showFloatingJoin, setShowFloatingJoin] = useState(false);
  const [teamPinInput, setTeamPinInput] = useState('');

  // Creation Fields for Building Custom Teams
  const [createTeamName, setCreateTeamName] = useState('');
  const [createTeamPin, setCreateTeamPin] = useState('');

  // Profile Identity Node Map
  const [profile, setProfile] = useState({
    firstName: '', lastName: '', preferredName: '', pronouns: 'He/Him', bio: '', avatarColor: '#00c875', avatarType: 'color', photoURL: ''
  });

  // Direct Line Peer Communications states
  const [activeChatPartner, setActiveChatPartner] = useState(null);
  const [chatInput, setChatInput] = useState('');
  const [friendNameInput, setFriendNameInput] = useState('');

  // Media Generation Configurations
  const [postText, setPostText] = useState('');
  const [postTargetScope, setPostTargetScope] = useState('public'); 
  const [targetTeamPin, setTargetTeamPin] = useState(''); 
  const [textSize, setTextSize] = useState('16');
  const [textFont, setTextFont] = useState("'Georgia', serif");
  const [textAlign, setTextAlign] = useState('left');
  const [imgOpacity, setImgOpacity] = useState('10');
  const [imgBlur, setImgBlur] = useState('0');
  const [imgShadow, setImgShadow] = useState('none');
  const [selectedPostFile, setSelectedPostFile] = useState(null);
  const [postImgPreview, setPostImgPreview] = useState(null);

  const chatEndRef = useRef(null);

  // Safe Authentication state synchronization hooks
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        const docRef = doc(db, "users", currentUser.uid);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const data = docSnap.data();
          setProfile(prev => ({ ...prev, ...data }));
          setMyTeams(data.joinedTeams || []);
        } else {
          const initialData = { firstName: '', lastName: '', preferredName: '', pronouns: 'He/Him', bio: '', avatarColor: '#00c875', avatarType: 'color', joinedTeams: [] };
          await setDoc(docRef, initialData);
          setMyTeams([]);
        }
      } else {
        setUser(null);
      }
    });
    return () => unsubscribe();
  }, []);

  // Sync Global Database Pipeline Streams
  useEffect(() => {
    if (!user) return;
    
    const unsubPosts = onSnapshot(query(collection(db, "posts"), orderBy("createdAt", "desc")), (sn) => {
      const arr = []; sn.forEach(d => arr.push({ id: d.id, ...d.data() }));
      setPosts(arr);
    });

    const unsubUsers = onSnapshot(query(collection(db, "users")), (sn) => {
      const arr = []; sn.forEach(d => { if (d.id !== user.uid) arr.push({ uid: d.id, ...d.data() }); });
      setAllUsers(arr);
    });

    const unsubNotifs = onSnapshot(query(collection(db, "notifications"), where("userId", "==", user.uid), orderBy("createdAt", "desc")), (sn) => {
      const arr = []; sn.forEach(d => arr.push({ id: d.id, ...d.data() }));
      setNotifications(arr);
    });

    const unsubTeams = onSnapshot(query(collection(db, "teams"), orderBy("createdAt", "desc")), (sn) => {
      const arr = []; sn.forEach(d => arr.push({ id: d.id, ...d.data() }));
      setGlobalTeamsList(arr);
    });

    return () => { unsubPosts(); unsubUsers(); unsubNotifs(); unsubTeams(); };
  }, [user]);

  // Sync Contact Lists
  useEffect(() => {
    if (!user || allUsers.length === 0) return;
    return onSnapshot(query(collection(db, "friendships"), where("users", "array-contains", user.uid)), (sn) => {
      const ids = []; sn.forEach(d => {
        const p = d.data().users.find(id => id !== user.uid);
        if (p) ids.push(p);
      });
      setFriendsList(allUsers.filter(u => ids.includes(u.uid)));
    });
  }, [user, allUsers]);

  // Sync Live Chat Threads
  useEffect(() => {
    if (!user || !activeChatPartner) return;
    return onSnapshot(query(collection(db, "messages"), orderBy("createdAt", "asc")), (sn) => {
      const msgs = [];
      sn.forEach(d => {
        const data = d.data();
        if ((data.sender === user.uid && data.receiver === activeChatPartner.uid) ||
            (data.sender === activeChatPartner.uid && data.receiver === user.uid)) {
          msgs.push({ id: d.id, ...data });
        }
      });
      setMessages(msgs);
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    });
  }, [user, activeChatPartner]);

  // Auth Handling with password requirements check
  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    if (!authEmail || !authPassword) return;
    
    const pwdRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{6,}$/;
    
    if (!pwdRegex.test(authPassword)) {
      alert("Password must contain: 6+ chars, 1 uppercase, 1 lowercase, 1 number, 1 special character (@$!%*?&)");
      return;
    }
    try {
      if (isSignUpMode) {
        await createUserWithEmailAndPassword(auth, authEmail, authPassword);
        alert("Account setup complete.");
      } else {
        await signInWithEmailAndPassword(auth, authEmail, authPassword);
      }
      setAuthEmail(''); setAuthPassword(''); setShowPassword(false);
    } catch (err) {
      alert(`System Gate Error: ${err.message}`);
    }
  };

  // Build New Team Hub Node
  const handleCreateNewTeamNode = async () => {
    const cleanName = createTeamName.trim();
    const cleanPin = createTeamPin.trim();

    if (!cleanName || cleanPin.length !== 5 || isNaN(cleanPin)) {
      alert("Validation Error: Configuration fields require a text name and a 5-digit numeric PIN.");
      return;
    }

    await addDoc(collection(db, "teams"), { name: cleanName, pin: cleanPin, creator: user.uid, createdAt: new Date().toISOString() });
    const updated = [...myTeams, cleanPin];
    setMyTeams(updated);
    await updateDoc(doc(db, "users", user.uid), { joinedTeams: updated });

    setCreateTeamName(''); setCreateTeamPin('');
    alert(`Success: Team Node [${cleanName}] online.`);
  };

  // Join Existing Team Nodes via input pins
  const joinTeamByPin = async () => {
    const cleanPin = teamPinInput.trim();
    if (cleanPin.length !== 5 || isNaN(cleanPin)) {
      alert("System Validation Error: Routing credentials require a 5-digit tracking key.");
      return;
    }
    if (myTeams.includes(cleanPin)) {
      alert("Redundant Node Input: Team is already active inside your dashboard profile registry.");
      return;
    }

    const updatedTeams = [...myTeams, cleanPin];
    setMyTeams(updatedTeams);
    await updateDoc(doc(db, "users", user.uid), { joinedTeams: updatedTeams });

    setTeamPinInput(''); setShowFloatingJoin(false);
    alert(`Success: Streams synced to Channel Node #${cleanPin}`);
  };

  const leaveTeamByPin = async (pinToRemove) => {
    const updatedTeams = myTeams.filter(pin => pin !== pinToRemove);
    setMyTeams(updatedTeams);
    await updateDoc(doc(db, "users", user.uid), { joinedTeams: updatedTeams });
  };

  const handleAddFriend = async () => {
    const target = allUsers.find(u => 
      `${u.firstName} ${u.lastName}`.toLowerCase() === friendNameInput.toLowerCase() || 
      (u.preferredName && u.preferredName.toLowerCase() === friendNameInput.toLowerCase())
    );
    if (!target) {
      alert("Identity mismatch: Name string not recognized in peer indices.");
      return;
    }
    await addDoc(collection(db, "friendships"), { users: [user.uid, target.uid] });
    alert(`Connected with ${target.preferredName || target.firstName}.`);
    setFriendNameInput('');
  };

  const handlePostImageSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedPostFile(file);
      setPostImgPreview(URL.createObjectURL(file));
    }
  };

  const publishPost = async () => {
    if (postTargetScope === 'team' && (targetTeamPin.trim().length !== 5 || isNaN(targetTeamPin))) {
      alert("Error: Team scope requires a valid 5-digit routing variable.");
      return;
    }

    let url = "";
    if (selectedPostFile) {
      const storageRef = ref(storage, `posts/${Date.now()}_${selectedPostFile.name}`);
      await uploadBytes(storageRef, selectedPostFile);
      url = await getDownloadURL(storageRef);
    }

    const currentAuthorName = profile.preferredName || `${profile.firstName} ${profile.lastName}` || "System Node";

    await addDoc(collection(db, "posts"), {
      author: currentAuthorName, authorId: user.uid, text: postText, imageUrl: url,
      scope: postTargetScope, teamPin: postTargetScope === 'team' ? targetTeamPin.trim() : 'global',
      fontSize: textSize, fontFamily: textFont, alignment: textAlign,
      opacity: imgOpacity, blur: imgBlur, shadow: imgShadow, createdAt: new Date().toISOString()
    });

    allUsers.forEach(async (peer) => {
      if (postTargetScope === 'public' || (postTargetScope === 'team' && peer.joinedTeams?.includes(targetTeamPin.trim()))) {
        await addDoc(collection(db, "notifications"), {
          userId: peer.uid, text: `${currentAuthorName} transmitted a new stream update`, createdAt: new Date().toISOString()
        });
      }
    });

    setPostText(''); setTargetTeamPin(''); setSelectedPostFile(null); setPostImgPreview(null);
    setCurrentView('home-feed');
  };

  const sendChatMessage = async () => {
    if (!chatInput.trim() || !activeChatPartner) return;
    await addDoc(collection(db, "messages"), { sender: user.uid, receiver: activeChatPartner.uid, text: chatInput, createdAt: new Date().toISOString() });
    setChatInput('');
  };

  // Pipeline Filter Lists
  const visiblePosts = posts.filter(p => p.scope === 'public' || (p.scope === 'team' && myTeams.includes(p.teamPin)));
  const filteredTeamPosts = posts.filter(p => p.scope === 'team' && myTeams.includes(p.teamPin));

  // VIEW 0: RENDER EXPLICIT AUTH LOGIN OR SIGNUP INTERFACE IF USER IS ABSENT
  if (!user) {
    return (
      <div className="auth-portal-container">
        <h2 style={{ color: 'var(--accent-brand-green)', marginTop: '12px', marginBottom: '8px', fontSize: '16px', textAlign: 'center' }}>
          PriorityConnect Portal
        </h2>
        <form onSubmit={handleAuthSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <input 
            type="email" required className="form-input-element dark-mode" 
            placeholder="Corporate Email Address" value={authEmail} onChange={e => setAuthEmail(e.target.value)} 
          />
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <input 
              type={showPassword ? "text" : "password"} required className="form-input-element dark-mode" 
              placeholder="Security Token Password" value={authPassword} onChange={e => setAuthPassword(e.target.value)}
              style={{ paddingRight: '40px' }}
            />
            <button 
              type="button" 
              onClick={() => setShowPassword(!showPassword)}
              style={{
                position: 'absolute', right: '12px', background: 'none', border: 'none', cursor: 'pointer',
                padding: '0', transition: 'transform 0.2s ease', display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}
              title={showPassword ? "Hide password" : "Show password"}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" style={{ color: 'var(--accent-brand-green)' }}>
                {showPassword ? (
                  <>
                    {/* Open Eye */}
                    <path d="M12 5c-4.5 0-8.5 2.5-11 7 2.5 4.5 6.5 7 11 7s8.5-2.5 11-7c-2.5-4.5-6.5-7-11-7zm0 11c-2.2 0-4-1.8-4-4s1.8-4 4-4 4 1.8 4 4-1.8 4-4 4z"/>
                    <circle cx="12" cy="12" r="2.5" fill="var(--bg-surface-card)"/>
                  </>
                ) : (
                  <>
                    {/* Closed Eye with Slash */}
                    <path d="M12 7c2.2 0 4 1.8 4 4 0 .3 0 .6-.1.9l3 3c1.8-1.3 3.4-3 4.6-5.4-2.5-4.5-6.5-7-11-7-1.5 0-3 .2-4.5.7l2.2 2.2c.3 0 .6-.1.9-.1zm-7.7-2.3L3.3 3.3c-.4-.4-.4-1 0-1.4.4-.4 1-.4 1.4 0l16.4 16.4c.4.4.4 1 0 1.4-.4.4-1 .4-1.4 0L4.3 4.7zM2 12c2.5 4.5 6.5 7 11 7 1.5 0 3-.2 4.5-.7l-1.5-1.5c-.3 0-.6.1-.9.1-2.2 0-4-1.8-4-4 0-.3 0-.6.1-.9L2 12z"/>
                  </>
                )}
              </svg>
            </button>
          </div>
          {isSignUpMode && (
            <div style={{ 
              fontSize: '12px', color: 'var(--text-muted)', textAlign: 'left', 
              background: '#25292a', padding: '10px', borderRadius: '6px', lineHeight: '1.5'
            }}>
              <strong style={{ color: 'var(--accent-brand-green)' }}>Password Requirements:</strong>
              <div>✓ At least 6 characters</div>
              <div>✓ 1 uppercase letter (A-Z)</div>
              <div>✓ 1 lowercase letter (a-z)</div>
              <div>✓ 1 number (0-9)</div>
              <div>✓ 1 special character (@$!%*?&)</div>
            </div>
          )}
          <button type="submit" className="action-submit-btn" style={{ width: '100%', marginTop: '8px' }}>
            {isSignUpMode ? "Sign up" : "Login"}
          </button>
        </form>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', cursor: 'pointer', marginTop: '15px' }} onClick={() => setIsSignUpMode(!isSignUpMode)}>
          {isSignUpMode ? "Already have an account? Login" : "Don't have an account? Sign up"}
        </p>
      </div>
    );
  }

  return (
    <div>
      <header className="navbar-header">
        <div className="brand-logo" onClick={() => setCurrentView('home-feed')}>Priority<span>Connect</span></div>
        <nav className="nav-button-group">
          <button className={`nav-link-item ${currentView === 'home-feed' ? 'current-active' : ''}`} onClick={() => setCurrentView('home-feed')}>Home Feed</button>
          <button className={`nav-link-item ${currentView === 'post-creation' ? 'current-active' : ''}`} onClick={() => setCurrentView('post-creation')}>Post Creation</button>
          <button className={`nav-link-item ${currentView === 'profile' ? 'current-active' : ''}`} onClick={() => setCurrentView('profile')}>Profile Page</button>
          <button className={`nav-link-item ${currentView === 'messages' ? 'current-active' : ''}`} onClick={() => setCurrentView('messages')}>Message Page</button>
          <button className="nav-link-item" style={{ background: '#ff3344', color: '#fff' }} onClick={() => signOut(auth)}>Logout</button>
        </nav>
      </header>

      <div className="app-viewport-wrapper">
        
        {/* VIEW 1: HOME FEED DYNAMIC CHANNELS MATRIX */}
        {currentView === 'home-feed' && (
          <>
            <div className="teams-badge-banner">
              <strong>Your Active Functional Team Clusters:</strong> {myTeams.length === 0 ? "Standby mode (No active channels matched)." : ""}
              <div>
                {myTeams.map(pin => {
                  const tMeta = globalTeamsList.find(g => g.pin === pin);
                  return (
                    <span key={pin} className="team-pill-node">
                      {tMeta ? `${tMeta.name} (#${pin})` : `Team #${pin}`}
                      <button className="leave-team-action" onClick={() => leaveTeamByPin(pin)}>×</button>
                    </span>
                  );
                })}
              </div>
            </div>

            <div className="grid-layout-dashboard">
              <div className="dashboard-column">
                <div className="content-display-pane">
                  <h3 className="section-title">Live Company Posts (Public):</h3>
                  <div className="scrollable-list-box" style={{ maxHeight: '500px' }}>
                    {visiblePosts.map(p => (
                      <div key={p.id} className="wireframe-item-card">
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 'bold', marginBottom: '8px' }}>
                          <span style={{ color: 'var(--accent-brand-green)' }}>{p.author}</span>
                          <span style={{ color: p.scope === 'team' ? '#e67e22' : '#2980b9' }}>
                            {p.scope === 'team' ? `🔒 TEAM ${p.teamPin}` : '🌐 PUBLIC'}
                          </span>
                        </div>
                        <p style={{ fontSize: `${p.fontSize}px`, fontFamily: p.fontFamily, textAlign: p.alignment, color: 'var(--text-light-pure)', margin: '8px 0' }}>{p.text}</p>
                        {p.imageUrl && <img src={p.imageUrl} alt="payload" style={{ width: '100%', marginTop: '12px', borderRadius: '6px', opacity: p.opacity / 10, filter: `blur(${p.blur}px)`, boxShadow: p.shadow === 'drop' ? '0px 4px 15px rgba(0,0,0,0.3)' : 'none' }} />}
                      </div>
                    ))}
                    {visiblePosts.length === 0 && <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '20px' }}>No transmission records apply to your current credentials.</div>}
                  </div>
                </div>
              </div>

              <div className="dashboard-column">
                <div className="content-display-pane">
                  <h3 className="section-title">Team Alerts:</h3>
                  <div className="scrollable-list-box" style={{ maxHeight: '180px' }}>
                    {myTeams.length === 0 ? (
                      <div style={{ color: '#ff3344', fontSize: '14px', fontWeight: '600' }}>Join or build a functional team node to start receiving secure transmission alerts.</div>
                    ) : filteredTeamPosts.length === 0 ? (
                      <div style={{ color: 'var(--text-muted)', fontSize: '14px' }}>No active team communication alerts in queue data streams.</div>
                    ) : (
                      filteredTeamPosts.map(tp => (
                        <div key={tp.id} style={{ background: '#25292a', padding: '12px', borderRadius: '6px', marginBottom: '10px', borderLeft: '4px solid #e67e22' }}>
                          <strong style={{ fontSize: '13px', color: '#fff' }}>Alert from team channel node ({tp.teamPin})</strong>
                          <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--text-muted)' }}>{tp.author}: "{tp.text.substring(0, 45)}..."</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="content-display-pane">
                  <h3 className="section-title">Notifications:</h3>
                  <div className="scrollable-list-box" style={{ maxHeight: '180px' }}>
                    {notifications.map(n => (
                      <div key={n.id} style={{ display: 'flex', justifyContent: 'space-between', background: '#25292a', padding: '12px', borderRadius: '6px', marginBottom: '10px' }}>
                        <div style={{ fontSize: '13px', color: '#fff' }}>{n.text}</div>
                        <input type="checkbox" style={{ accentColor: 'var(--accent-brand-green)', cursor: 'pointer' }} onChange={async () => await deleteDoc(doc(db, "notifications", n.id))} />
                      </div>
                    ))}
                    {notifications.length === 0 && <div style={{ color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center' }}>No active alert notifications listed.</div>}
                  </div>
                </div>

                {/* Team Matrix Hub Panel - Hidden safely away if user has established nodes */}
                {myTeams.length === 0 && (
                  <div className="content-display-pane">
                    <h3 className="section-title">Team Network Hub:</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <input type="text" className="form-input-element dark-mode" placeholder="Enter Team Name Designation" value={createTeamName} onChange={e => setCreateTeamName(e.target.value)} />
                      <input type="text" maxLength={5} className="form-input-element dark-mode" placeholder="Assign 5-Digit PIN routing ID" value={createTeamPin} onChange={e => setCreateTeamPin(e.target.value)} />
                      <button className="action-submit-btn" onClick={handleCreateNewTeamNode}>Create New Team</button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <button className="floating-trigger-button" onClick={() => setShowFloatingJoin(!showFloatingJoin)}>+</button>
            {showFloatingJoin && (
              <div style={{ position: 'fixed', bottom: '110px', right: '35px', zIndex: 999, background: '#1e2223', border: '2px solid #00c875', padding: '20px', borderRadius: '8px', width: '280px', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}>
                <h4 style={{ margin: '0 0 12px 0', color: 'var(--accent-brand-green)' }}>Enter Team 5-Digit Routing Pin</h4>
                <input type="text" maxLength={5} className="form-input-element dark-mode" style={{ marginBottom: '12px' }} placeholder="e.g. 94810" value={teamPinInput} onChange={e => setTeamPinInput(e.target.value)} />
                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                  <button className="action-submit-btn" style={{ padding: '6px 12px', fontSize: '13px', background: '#555', color: '#fff' }} onClick={() => setShowFloatingJoin(false)}>Cancel</button>
                  <button className="action-submit-btn" style={{ padding: '6px 12px', fontSize: '13px' }} onClick={joinTeamByPin}>Join Node</button>
                </div>
              </div>
            )}
          </>
        )}

        {/* VIEW 2: POST CREATION WORKSPACE ENVIRONMENT WITH MIXED GRAY CONTROL BOX */}
        {currentView === 'post-creation' && (
          <div className="post-creation-split-grid">
            <div className="canvas-preview-frame">
              <h4 style={{ margin: '0 0 10px 0', color: 'var(--text-light-pure)' }}>Preview</h4>
              <div className="canvas-media-placeholder" style={{ 
                backgroundImage: postImgPreview ? `url(${postImgPreview})` : 'none',
                backgroundSize: 'cover', backgroundPosition: 'center',
                opacity: imgOpacity / 10, filter: `blur(${imgBlur}px)`,
                boxShadow: imgShadow === 'drop' ? '0px 10px 25px rgba(0,0,0,0.3)' : 'none'
              }} />
              <textarea 
                className="form-input-element" style={{ border: '1px dashed #ccc', resize: 'none', flex: 1, fontSize: `${textSize}px`, fontFamily: textFont, textAlign: textAlign }}
                placeholder="Your post text will appear here..." value={postText} onChange={e => setPostText(e.target.value)}
              />
            </div>

            <div className="studio-settings-panel">
              <h3 style={{ margin: 0, fontWeight: 'bold' }}>Composition Studio</h3>
              
              <div className="studio-row-item">
                <span>Post Text:</span>
                <input type="text" className="form-input-element" placeholder="Type text context..." value={postText} onChange={e => setPostText(e.target.value)} />
              </div>
              <div className="studio-row-item">
                <span>Scope:</span>
                <select className="form-input-element" value={postTargetScope} onChange={e => setPostTargetScope(e.target.value)}>
                  <option value="public">Public</option>
                  <option value="team">Team Channel Only</option>
                </select>
              </div>

              {postTargetScope === 'team' && (
                <div className="studio-row-item">
                  <span>Routing Pin:</span>
                  <input type="text" maxLength={5} className="form-input-element" placeholder="Specify 5-digit pin..." value={targetTeamPin} onChange={e => setTargetTeamPin(e.target.value)} />
                </div>
              )}

              <div className="studio-row-item">
                <span>Font Size:</span>
                <input type="number" className="form-input-element" value={textSize} onChange={e => setTextSize(e.target.value)} />
              </div>
              <div className="studio-row-item">
                <span>Font Face:</span>
                <select className="form-input-element" value={textFont} onChange={e => setTextFont(e.target.value)}>
                  <option value="'Georgia', serif">Georgia</option>
                  <option value="Arial, sans-serif">Arial</option>
                  <option value="Courier New">Courier</option>
                </select>
              </div>
              <div className="studio-row-item">
                <span>Alignment:</span>
                <select className="form-input-element" value={textAlign} onChange={e => setTextAlign(e.target.value)}>
                  <option value="left">Left</option>
                  <option value="center">Center</option>
                  <option value="right">Right</option>
                </select>
              </div>
              <div className="studio-row-item">
                <span>Upload Image:</span>
                <input type="file" accept="image/*" className="form-input-element" onChange={handlePostImageSelect} />
              </div>
              <div className="studio-row-item">
                <span>Image Opacity:</span>
                <input type="number" className="form-input-element" min="1" max="10" value={imgOpacity} onChange={e => setImgOpacity(e.target.value)} />
              </div>
              <div className="studio-row-item">
                <span>Blur Scale:</span>
                <input type="number" className="form-input-element" min="0" max="15" value={imgBlur} onChange={e => setImgBlur(e.target.value)} />
              </div>
              <div className="studio-row-item">
                <span>Shadow:</span>
                <select className="form-input-element" value={imgShadow} onChange={e => setImgShadow(e.target.value)}>
                  <option value="none">None</option>
                  <option value="drop">Drop Shadow</option>
                </select>
              </div>

              <button className="action-submit-btn" style={{ background: 'var(--accent-brand-green)', color: '#000', width: '100%', marginTop: '10px' }} onClick={publishPost}>Publish Post</button>
            </div>
          </div>
        )}

        {/* VIEW 3: PROFILE SETTINGS CONSOLE NODE */}
        {currentView === 'profile' && (
          <div className="content-display-pane" style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: '40px' }}>
            <div style={{ textAlign: 'center', borderRight: '1px solid #2d3234', paddingRight: '20px' }}>
              <div className="avatar-large-profile-node" style={{ 
                backgroundColor: profile.avatarType === 'color' ? profile.avatarColor : 'transparent',
                backgroundImage: profile.avatarType === 'image' && profile.photoURL ? `url(${profile.photoURL})` : 'none'
              }} />
              <button className="action-submit-btn" style={{ padding: '8px 16px', fontSize: '13px', marginBottom: '20px' }} onClick={() => document.getElementById('avatar-file-up').click()}>Upload Picture</button>
              <input type="file" id="avatar-file-up" hidden accept="image/*" onChange={async (e) => {
                const f = e.target.files[0]; if(!f) return;
                const r = ref(storage, `avatars/${user.uid}`);
                await uploadBytes(r, f); const url = await getDownloadURL(r);
                const update = { ...profile, photoURL: url, avatarType: 'image' };
                setProfile(update); await setDoc(doc(db, "users", user.uid), update);
              }} />

              <div style={{ margin: '15px 0' }}>
                <span style={{ fontSize: '13px', display: 'block', color: 'var(--text-muted)', marginBottom: '5px' }}>Or Select Color Node:</span>
                <div className="color-node-selector" style={{ background: '#00c875' }} onClick={async () => {
                  const update = { ...profile, avatarColor: '#00c875', avatarType: 'color' }; setProfile(update);
                  await setDoc(doc(db, "users", user.uid), update);
                }} />
              </div>

              <h4 style={{ margin: '20px 0 8px 0', textAlign: 'left', color: 'var(--text-muted)' }}>Bio Logs</h4>
              <textarea className="form-input-element dark-mode" style={{ height: '110px', resize: 'none' }} placeholder="Type profile bio logs here..." value={profile.bio || ''} onChange={e => setProfile({...profile, bio: e.target.value})} />
            </div>

            <div>
              <h3 className="section-title" style={{ fontSize: '22px' }}>Profile Settings</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                <div>
                  <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>First Name:</span>
                  <input type="text" className="form-input-element dark-mode" style={{ marginTop: '5px' }} placeholder="First Name" value={profile.firstName || ''} onChange={e => setProfile({...profile, firstName: e.target.value})} />
                </div>
                <div>
                  <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Last Name:</span>
                  <input type="text" className="form-input-element dark-mode" style={{ marginTop: '5px' }} placeholder="Last Name" value={profile.lastName || ''} onChange={e => setProfile({...profile, lastName: e.target.value})} />
                </div>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '30px' }}>
                <div>
                  <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Preferred Name:</span>
                  <input type="text" className="form-input-element dark-mode" style={{ marginTop: '5px' }} placeholder="Preferred Name" value={profile.preferredName || ''} onChange={e => setProfile({...profile, preferredName: e.target.value})} />
                </div>
                <div>
                  <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Pronouns Node:</span>
                  <select className="form-input-element dark-mode" style={{ marginTop: '5px' }} value={profile.pronouns || 'He/Him'} onChange={e => setProfile({...profile, pronouns: e.target.value})}>
                    <option value="He/Him">He/Him</option>
                    <option value="She/Her">She/Her</option>
                    <option value="They/Them">They/Them</option>
                    <option value="Other">Other / Select Identity</option>
                  </select>
                </div>
              </div>

              <button className="action-submit-btn" style={{ width: '100%', padding: '16px' }} onClick={async () => {
                await setDoc(doc(db, "users", user.uid), { ...profile, joinedTeams: myTeams });
                alert("Identity mapping attributes saved successfully to registry lines.");
              }}>Save Profile</button>
            </div>
          </div>
        )}

        {/* VIEW 4: LIVE DIRECT LINE MESSAGING SUITE */}
        {currentView === 'messages' && (
          <div className="messaging-master-wrapper">
            <aside className="people-drawer-sidebar">
              <div className="people-drawer-header">Messages</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <input type="text" className="form-input-element dark-mode" style={{ padding: '8px', fontSize: '13px' }} placeholder="Friend name..." value={friendNameInput} onChange={e => setFriendNameInput(e.target.value)} />
                <button className="action-submit-btn" style={{ padding: '8px', fontSize: '13px' }} onClick={handleAddFriend}>Add Friend</button>
              </div>
              <div style={{ marginTop: '20px', display: 'flex', flex: 1, flexDirection: 'column', overflowY: 'auto' }}>
                {friendsList.map(f => (
                  <div key={f.uid} className={`drawer-person-node ${activeChatPartner?.uid === f.uid ? 'node-active' : ''}`} onClick={() => setActiveChatPartner(f)}>
                    <div className="drawer-avatar-circle active-ring" style={{
                      backgroundColor: f.avatarType === 'color' ? f.avatarColor : 'transparent',
                      backgroundImage: f.avatarType === 'image' && f.photoURL ? `url(${f.photoURL})` : 'none'
                    }} />
                    <span style={{ fontWeight: '500', fontSize: '14px' }}>{f.preferredName || `${f.firstName} ${f.lastName}`}</span>
                  </div>
                ))}
              </div>
            </aside>

            <div className="content-display-pane" style={{ display: 'flex', flexDirection: 'column', height: '520px', justifyContent: 'space-between' }}>
              {activeChatPartner ? (
                <>
                  <div style={{ paddingBottom: '12px', borderBottom: '1px solid #2d3234', fontWeight: 'bold', color: 'var(--accent-brand-green)' }}>
                    Active Peer Stream ID: {activeChatPartner.preferredName || `${activeChatPartner.firstName} ${activeChatPartner.lastName}`}
                  </div>
                  <div className="scrollable-list-box" style={{ flex: 1, margin: '15px 0' }}>
                    {messages.map(m => (
                      <div key={m.id} style={{
                        background: m.sender === user.uid ? '#00c875' : '#2d3234',
                        color: m.sender === user.uid ? '#000000' : '#ffffff',
                        marginLeft: m.sender === user.uid ? 'auto' : '0',
                        padding: '12px 16px', borderRadius: '8px', marginBottom: '10px', width: 'fit-content', maxWidth: '65%', fontWeight: '500'
                      }}>
                        {m.text}
                      </div>
                    ))}
                    <div ref={chatEndRef} />
                  </div>
                  <div style={{ display: 'flex', gap: '15px' }}>
                    <input type="text" className="form-input-element dark-mode" placeholder="Type your message..." value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendChatMessage()} />
                    <button className="action-submit-btn" onClick={sendChatMessage}>Send</button>
                  </div>
                </>
              ) : (
                <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--text-muted)', fontSize: '15px' }}>
                  Select a friend to start messaging
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
