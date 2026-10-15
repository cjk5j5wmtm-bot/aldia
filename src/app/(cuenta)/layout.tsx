import { Logo, Wordmark } from "@/lib/view";

export default function CuentaLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="auth">
      <div className="auth-card">
        <div className="brand"><Logo /> <Wordmark /></div>
        {children}
      </div>
    </div>
  );
}
