import { useEffect, useState, type FormEvent, type ReactNode } from "react";

// A light client-side gate, not real security: the site is static, so anyone
// who reads the bundle can still see the app. It keeps casual visitors out.
// SHA-256 of the password (trimmed, lower-cased), so it isn't in the source.
const PASSWORD_SHA256 = "68cf8c6d1245ec31bca7331818165d8cc84a4f6a8ede3ccab45133d6865138e1";
const STORAGE_KEY = "mound-unlocked";

async function sha256(text: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function remembered() {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === PASSWORD_SHA256;
  } catch {
    return false;
  }
}

export function MoundGate({ children }: { children: ReactNode }) {
  // "checking" renders the same on the server and the first client pass, then
  // localStorage decides, so returning visitors never see the gate flash.
  const [state, setState] = useState<"checking" | "locked" | "open">("checking");
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setState(remembered() ? "open" : "locked");
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const hash = await sha256(value.trim().toLowerCase());
      if (hash === PASSWORD_SHA256) {
        try {
          window.localStorage.setItem(STORAGE_KEY, hash);
        } catch {
          // Private mode without storage: still let them in for this visit.
        }
        setState("open");
        return;
      }
      setError("Not that one. Try again.");
      setValue("");
    } catch {
      setError("This browser can't check the password. Try another browser.");
    } finally {
      setBusy(false);
    }
  }

  if (state === "open") return <>{children}</>;
  if (state === "checking") return <div className="mound mound-gate" aria-busy="true" />;

  return (
    <div className="mound mound-gate">
      <form className="mound-gate-card" onSubmit={submit}>
        <p className="mound-kicker">Edinburgh Fringe 2026</p>
        <h1 className="display mound-title">The Mound</h1>
        <label className="mound-gate-label" htmlFor="mound-password">
          Password
        </label>
        <div className="mound-gate-row">
          <input
            id="mound-password"
            type="password"
            autoComplete="current-password"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            autoFocus
            value={value}
            onChange={(event) => {
              setValue(event.target.value);
              if (error) setError("");
            }}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "mound-password-error" : undefined}
          />
          <button type="submit" className="solid" disabled={busy || !value.trim()}>
            Let me in
          </button>
        </div>
        <p id="mound-password-error" className="mound-gate-error" role="alert">
          {error}
        </p>
      </form>
    </div>
  );
}
