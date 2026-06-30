"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username || !password) { setError("أدخل اسم المستخدم وكلمة السر"); return; }
    setLoading(true);
    setError("");
    const d = await login(username, password);
    setLoading(false);
    if (d.success) router.push("/");
    else setError(d.error || "فشل تسجيل الدخول");
  };

  return (
    <div className="login-page">
      <div className="login-card glass">
        <h1>🔐 النظام المحاسبي المتكامل</h1>
        <p className="text-muted">أكرم لتأجير الخيام والتجهيزات</p>
        <form onSubmit={handleSubmit} className="login-form">
          <input type="text" className="form-control" placeholder="اسم المستخدم" value={username} onChange={(e) => setUsername(e.target.value)} autoFocus />
          <input type="password" className="form-control" placeholder="كلمة السر" value={password} onChange={(e) => setPassword(e.target.value)} />
          {error && <p className="text-red" style={{ fontSize: "0.85rem" }}>{error}</p>}
          <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
            {loading ? "جاري..." : "دخول"}
          </button>
        </form>
      </div>
      <style>{`
        .login-page { display: flex; min-height: 100vh; align-items: center; justify-content: center; }
        .login-card { padding: 3rem; max-width: 400px; width: 100%; text-align: center; }
        .login-card h1 { font-size: 1.25rem; margin-bottom: 0.5rem; }
        .login-form { display: flex; flex-direction: column; gap: 1rem; margin-top: 1.5rem; }
        .login-form input { width: 100%; }
        .btn-block { width: 100%; }
      `}</style>
    </div>
  );
}
