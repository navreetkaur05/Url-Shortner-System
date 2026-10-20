import { lazy, Suspense, useEffect, useState } from "react";
import QRCode from "qrcode";

const ClickChart = lazy(() => import("./ClickChart.jsx"));

const tokenStorageKey = "shortly-token";

async function apiRequest(path, options = {}, token = "") {
  let response;
  try {
    response = await fetch(path, {
      ...options,
      headers: {
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    });
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error(
        "Cannot reach the API. Restart the server and check its terminal for MongoDB connection errors."
      );
    }
    throw error;
  }

  let data = {};
  if (response.status !== 204) {
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      data = await response.json().catch(() => ({}));
    }
  }
  if (!response.ok) {
    const message =
      data.error ||
      (response.status === 404
        ? "The API route was not found. Restart the backend and try again."
        : `The API returned an error (HTTP ${response.status}). Check the backend terminal for details.`);
    throw new Error(message);
  }
  return data;
}

function LinkIcon({ className = "" }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        d="M10 13.5a4 4 0 0 0 5.66 0l3-3A4 4 0 0 0 13 4.84l-1.72 1.72m2.72 3.94a4 4 0 0 0-5.66 0l-3 3A4 4 0 0 0 11 19.16l1.72-1.72"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function QrDownload({ url, compact = false }) {
  const [image, setImage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    QRCode.toDataURL(url, {
      errorCorrectionLevel: "M",
      margin: 1,
      width: 220,
    })
      .then((dataUrl) => {
        if (active) setImage(dataUrl);
      })
      .catch(() => {
        if (active) setError("QR code unavailable");
      });
    return () => {
      active = false;
    };
  }, [url]);

  if (compact) {
    return (
      <a
        aria-label="Download QR code"
        className="icon-action"
        download="shortly-qr.png"
        href={image || undefined}
        onClick={(event) => {
          if (!image) event.preventDefault();
        }}
        title={error || "Download QR code"}
      >
        QR
      </a>
    );
  }

  return (
    <div className="qr-preview">
      {image ? (
        <img alt="QR code for your short link" height="76" src={image} width="76" />
      ) : (
        <span className="qr-placeholder" aria-label={error || "Generating QR code"}>
          {error || <span className="spinner spinner-dark" />}
        </span>
      )}
      <a
        className="qr-download"
        download="shortly-qr.png"
        href={image || undefined}
        onClick={(event) => {
          if (!image) event.preventDefault();
        }}
      >
        Download QR
      </a>
    </div>
  );
}

function AuthPanel({ onAuthenticated, onClose }) {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await apiRequest(`/api/auth/${mode}`, {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      onAuthenticated(data);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-backdrop" onMouseDown={onClose}>
      <section
        aria-labelledby="auth-title"
        aria-modal="true"
        className="auth-panel"
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
      >
        <button aria-label="Close" className="auth-close" onClick={onClose} type="button">
          ×
        </button>
        <span className="auth-kicker">YOUR LINKS, IN ONE PLACE</span>
        <h2 id="auth-title">{mode === "login" ? "Welcome back" : "Create your account"}</h2>
        <p className="auth-copy">
          {mode === "login"
            ? "Sign in to manage links and see your click analytics."
            : "Save your links, customize them, and follow their performance."}
        </p>
        <form className="auth-form" onSubmit={submit}>
          <label htmlFor="auth-email">Email address</label>
          <input
            autoComplete="email"
            id="auth-email"
            onChange={(event) => setEmail(event.target.value)}
            required
            type="email"
            value={email}
          />
          <label htmlFor="auth-password">Password</label>
          <input
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            id="auth-password"
            minLength={8}
            onChange={(event) => setPassword(event.target.value)}
            required
            type="password"
            value={password}
          />
          {error && <p className="auth-error" role="alert">{error}</p>}
          <button className="auth-submit" disabled={loading} type="submit">
            {loading ? "Please wait..." : mode === "login" ? "Sign in" : "Create account"}
          </button>
        </form>
        <p className="auth-switch">
          {mode === "login" ? "New to Shortly?" : "Already have an account?"}{" "}
          <button
            onClick={() => {
              setMode(mode === "login" ? "register" : "login");
              setError("");
            }}
            type="button"
          >
            {mode === "login" ? "Create an account" : "Sign in"}
          </button>
        </p>
      </section>
    </div>
  );
}

function App() {
  const [url, setUrl] = useState("");
  const [customCode, setCustomCode] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [token, setToken] = useState(() => localStorage.getItem(tokenStorageKey) || "");
  const [user, setUser] = useState(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("shorten");
  const [links, setLinks] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [dashboardError, setDashboardError] = useState("");
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [deletingCode, setDeletingCode] = useState("");

  useEffect(() => {
    if (!token) {
      setUser(null);
      setLinks([]);
      return;
    }
    let active = true;
    Promise.all([
      apiRequest("/api/auth/me", {}, token),
      apiRequest("/api/urls/mine", {}, token),
    ])
      .then(([account, ownedLinks]) => {
        if (active) {
          setUser(account.user);
          setLinks(ownedLinks.urls);
        }
      })
      .catch((requestError) => {
        if (active) {
          setUser(null);
          setToken("");
          localStorage.removeItem(tokenStorageKey);
          if (requestError.message.includes("session")) setError(requestError.message);
        }
      });
    return () => {
      active = false;
    };
  }, [token]);

  useEffect(() => {
    if (!token || !user || activeTab !== "dashboard") return;
    let active = true;
    setDashboardLoading(true);
    setDashboardError("");
    apiRequest("/api/urls/analytics", {}, token)
      .then((data) => {
        if (active) setAnalytics(data);
      })
      .catch((requestError) => {
        if (active) setDashboardError(requestError.message);
      })
      .finally(() => {
        if (active) setDashboardLoading(false);
      });
    return () => {
      active = false;
    };
  }, [activeTab, token, user]);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setResult(null);
    setCopied(false);
    setIsLoading(true);
    try {
      const data = await apiRequest(
        "/api/urls",
        {
          method: "POST",
          body: JSON.stringify({
            url,
            ...(customCode.trim() ? { customCode: customCode.trim() } : {}),
            ...(expiresAt ? { expiresAt: new Date(expiresAt).toISOString() } : {}),
          }),
        },
        token
      );
      setResult(data);
      setUrl("");
      setCustomCode("");
      setExpiresAt("");
      if (token) {
        const ownedLinks = await apiRequest("/api/urls/mine", {}, token);
        setLinks(ownedLinks.urls);
      }
    } catch (requestError) {
      setError(
        requestError instanceof TypeError
          ? "Could not reach the server. Check that the API and MongoDB are running."
          : requestError.message
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function copyLink(shortUrl) {
    try {
      await navigator.clipboard.writeText(shortUrl);
      setCopied(shortUrl);
      window.setTimeout(() => setCopied(""), 1800);
    } catch {
      setError("Clipboard access is unavailable. Copy the link manually.");
    }
  }

  function authenticated(data) {
    localStorage.setItem(tokenStorageKey, data.token);
    setUser(data.user);
    setToken(data.token);
    setAuthOpen(false);
  }

  async function deleteLink(shortCode) {
    if (!window.confirm(`Delete the short link "${shortCode}" and its click history?`)) {
      return;
    }
    setDeletingCode(shortCode);
    setDashboardError("");
    try {
      await apiRequest(
        `/api/urls/${encodeURIComponent(shortCode)}`,
        { method: "DELETE" },
        token
      );
      setLinks((existing) => existing.filter((link) => link.shortCode !== shortCode));
      if (activeTab === "dashboard") {
        setAnalytics(await apiRequest("/api/urls/analytics", {}, token));
      }
    } catch (requestError) {
      setDashboardError(requestError.message);
    } finally {
      setDeletingCode("");
    }
  }

  function signOut() {
    localStorage.removeItem(tokenStorageKey);
    setToken("");
    setUser(null);
    setAnalytics(null);
    setActiveTab("shorten");
  }

  return (
    <div className="page-shell">
      <header className="topbar">
        <a aria-label="Shortly home" className="brand" href="/">
          <span className="brand-mark">
            <LinkIcon />
          </span>
          shortly
        </a>
        <nav aria-label="Main navigation" className="topbar-actions">
          {user && (
            <div className="main-tabs">
              <button
                className={activeTab === "shorten" ? "nav-tab active" : "nav-tab"}
                onClick={() => setActiveTab("shorten")}
                type="button"
              >
                Shorten
              </button>
              <button
                className={activeTab === "dashboard" ? "nav-tab active" : "nav-tab"}
                onClick={() => setActiveTab("dashboard")}
                type="button"
              >
                Dashboard
              </button>
            </div>
          )}
          {user ? (
            <div className="account-actions">
              <span className="account-email">{user.email}</span>
              <button className="sign-in-button" onClick={signOut} type="button">
                Sign out
              </button>
            </div>
          ) : (
            <>
              <span className="topbar-note">
                <span className="status-dot" />
                Free link shortener
              </span>
              <button className="sign-in-button" onClick={() => setAuthOpen(true)} type="button">
                Sign in
              </button>
            </>
          )}
        </nav>
      </header>

      <main className="main-content">
        {activeTab === "dashboard" ? (
          <section aria-labelledby="dashboard-title" className="dashboard">
            <div className="dashboard-heading">
              <div>
                <div className="eyebrow">
                  <span className="eyebrow-line" />
                  YOUR LINK PERFORMANCE
                </div>
                <h1 id="dashboard-title">Link <span>analytics.</span></h1>
                <p className="hero-copy">A clear view of your links and the people clicking them.</p>
              </div>
            </div>
            {dashboardError && (
              <div className="message message-error" role="alert">{dashboardError}</div>
            )}
            {dashboardLoading && <p className="dashboard-loading">Loading your analytics…</p>}
            {analytics && (
              <>
                <div className="stat-grid">
                  <article className="stat-card">
                    <span>Total clicks</span>
                    <strong>{analytics.totalClicks.toLocaleString()}</strong>
                    <small>Across your shortened links</small>
                  </article>
                  <article className="stat-card">
                    <span>Unique visitors</span>
                    <strong>{analytics.uniqueVisitors.toLocaleString()}</strong>
                    <small>Distinct browsers, estimated by cookie</small>
                  </article>
                  <article className="stat-card">
                    <span>Your links</span>
                    <strong>{analytics.totalLinks.toLocaleString()}</strong>
                    <small>{analytics.activeLinks} currently active</small>
                  </article>
                </div>

                <section aria-labelledby="click-chart-title" className="dashboard-panel chart-panel">
                  <div className="panel-heading">
                    <div>
                      <h2 id="click-chart-title">Clicks over time</h2>
                      <p>Daily clicks over the last 30 days</p>
                    </div>
                    <span className="chart-legend"><i /> Clicks</span>
                  </div>
                  <div className="chart-wrap">
                    <Suspense fallback={<p className="chart-loading">Loading chart…</p>}>
                      <ClickChart data={analytics.clicksOverTime} />
                    </Suspense>
                  </div>
                </section>

                <section aria-labelledby="popular-title" className="dashboard-panel">
                  <div className="panel-heading">
                    <div>
                      <h2 id="popular-title">Your links</h2>
                      <p>Most popular links, with QR downloads and expiry status</p>
                    </div>
                  </div>
                  {links.length === 0 ? (
                    <p className="empty-state">You haven’t created any links yet.</p>
                  ) : (
                    <div className="links-table">
                      {[...links].sort((a, b) => b.clicks - a.clicks).map((link) => (
                        <article className="link-row" key={link.id}>
                          <div className="link-details">
                            <a href={link.shortUrl} rel="noreferrer" target="_blank">{link.shortCode}</a>
                            <span title={link.originalUrl}>{link.originalUrl}</span>
                            <small>
                              {link.expired
                                ? "Expired"
                                : link.expiresAt
                                  ? `Expires ${new Date(link.expiresAt).toLocaleDateString()}`
                                  : "No expiration"}
                            </small>
                          </div>
                          <strong className="link-clicks">{link.clicks.toLocaleString()} <small>clicks</small></strong>
                          <div className="link-actions">
                            <QrDownload compact url={link.shortUrl} />
                            <button
                              aria-label={`Delete ${link.shortCode}`}
                              className="delete-action"
                              disabled={deletingCode === link.shortCode}
                              onClick={() => deleteLink(link.shortCode)}
                              type="button"
                            >
                              {deletingCode === link.shortCode ? "…" : "Delete"}
                            </button>
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                  {analytics.popularLinks.length > 0 && (
                    <div className="popular-strip">
                      <strong>Most clicked:</strong>{" "}
                      {analytics.popularLinks
                        .slice(0, 3)
                        .map((link) => `${link.shortCode} (${link.clicks})`)
                        .join(" · ")}
                    </div>
                  )}
                </section>
              </>
            )}
          </section>
        ) : (
          <>
            <section aria-labelledby="hero-title" className="hero">
              <div className="eyebrow">
                <span className="eyebrow-line" />
                LESS LINK. MORE SHARE.
              </div>
              <h1 id="hero-title">
                Big links,
                <br />
                <span>little effort.</span>
              </h1>
              <p className="hero-copy">
                Turn that long, unwieldy URL into something neat and ready to go.
              </p>

              <div className="shortener-card">
                <form className="shortener-form" onSubmit={handleSubmit}>
                  <label className="input-label" htmlFor="url-input">
                    Paste your long link here
                  </label>
                  <div className="input-row">
                    <span className="input-icon"><LinkIcon /></span>
                    <input
                      autoComplete="url"
                      id="url-input"
                      onChange={(event) => setUrl(event.target.value)}
                      placeholder="https://your-very-long-link.com/..."
                      required
                      type="url"
                      value={url}
                    />
                    <button disabled={isLoading} type="submit">
                      {isLoading ? (
                        <><span className="spinner" /> Making link</>
                      ) : (
                        <>Make it short <span aria-hidden="true" className="button-arrow">↗</span></>
                      )}
                    </button>
                  </div>

                  <div className="advanced-fields">
                    <div className="custom-code-field">
                      <label className="input-label" htmlFor="custom-code">Custom short link <span>optional</span></label>
                      <div className="slug-input-wrap">
                        <span>your-link/</span>
                        <input
                          autoComplete="off"
                          id="custom-code"
                          maxLength={32}
                          onChange={(event) => setCustomCode(event.target.value)}
                          pattern="[A-Za-z0-9_-]{3,32}"
                          placeholder="my-link"
                          title="3–32 letters, numbers, hyphens or underscores"
                          value={customCode}
                        />
                      </div>
                    </div>
                    <div className="expiry-field">
                      <label className="input-label" htmlFor="expires-at">Link expiration <span>optional</span></label>
                      <input
                        id="expires-at"
                        min={new Date(Date.now() + 60_000).toISOString().slice(0, 16)}
                        onChange={(event) => setExpiresAt(event.target.value)}
                        type="datetime-local"
                        value={expiresAt}
                      />
                    </div>
                  </div>
                  <p className="form-hint">
                    <span aria-hidden="true">✳</span> Works with any HTTP or HTTPS link
                    {!user && (
                      <button className="hint-link" onClick={() => setAuthOpen(true)} type="button">
                        Sign in to save and track your links
                      </button>
                    )}
                  </p>
                </form>

                {error && (
                  <div aria-live="polite" className="message message-error" role="alert">
                    <span aria-hidden="true">!</span>{error}
                  </div>
                )}

                {result && (
                  <div aria-live="polite" className="result-card" role="status">
                    <div className="result-heading">
                      <span className="result-check" aria-hidden="true">✓</span>
                      <div>
                        <p className="result-title">Your short link is ready</p>
                        <p className="result-original" title={result.originalUrl}>{result.originalUrl}</p>
                      </div>
                    </div>
                    <div className="result-link-row">
                      <a href={result.shortUrl} rel="noreferrer" target="_blank">{result.shortUrl}</a>
                      <button
                        aria-label={copied === result.shortUrl ? "Link copied" : "Copy short link"}
                        className={copied === result.shortUrl ? "copy-button is-copied" : "copy-button"}
                        onClick={() => copyLink(result.shortUrl)}
                        type="button"
                      >
                        {copied === result.shortUrl ? "Copied!" : "Copy link"}
                      </button>
                    </div>
                    <div className="result-footer">
                      <span>{result.expiresAt ? `Expires ${new Date(result.expiresAt).toLocaleString()}` : "This link doesn’t expire"}</span>
                      <QrDownload url={result.shortUrl} />
                    </div>
                  </div>
                )}
              </div>

              <div className="trust-note">
                <span aria-hidden="true" className="sparkle">✦</span>
                {user ? "Your saved links and analytics are ready in your dashboard." : "No account needed. Sign in to save links and see analytics."}
              </div>
            </section>

            <section aria-label="How it works" className="steps">
              <article className="step">
                <span className="step-number">01</span>
                <div><h2>Drop in your link</h2><p>Any long URL will do. Paste it in the box above.</p></div>
              </article>
              <span aria-hidden="true" className="step-divider" />
              <article className="step">
                <span className="step-number">02</span>
                <div><h2>Make it yours</h2><p>Choose a custom ending or set an expiration date.</p></div>
              </article>
              <span aria-hidden="true" className="step-divider" />
              <article className="step">
                <span className="step-number">03</span>
                <div><h2>Share it anywhere</h2><p>Copy your link or download its QR code.</p></div>
              </article>
            </section>
          </>
        )}
      </main>

      <footer className="footer">
        <span>Shortly</span>
        <span>Small links. Big possibilities.</span>
      </footer>
      {authOpen && (
        <AuthPanel
          onAuthenticated={authenticated}
          onClose={() => setAuthOpen(false)}
        />
      )}
    </div>
  );
}

export default App;
