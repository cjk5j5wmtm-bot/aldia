import { Logo } from "@/lib/view";

export default function CuentaLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="auth">
      <div className="auth-card">
        <div className="brand"><Logo /> Al Día</div>
        {children}
      </div>
    </div>
  );
}
