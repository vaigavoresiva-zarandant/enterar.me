import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { LoginForm } from "@/components/auth/login-form";

export const metadata = { title: "Login · ENTERAR.ME Super Admin" };

export default async function LoginPage() {
  const session = await getServerSession(authOptions);
  if (session) redirect("/");

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-background via-background to-muted/30">
      <div className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="mb-8 flex flex-col items-center gap-4">
            <img
              src="/logo.svg"
              alt="ENTERAR.ME"
              className="h-20 w-auto"
            />
            <div className="text-center">
              <h1 className="wordmark text-2xl">
                ENTERAR<span className="dot">.</span>ME
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Panel del Super Admin
              </p>
            </div>
          </div>
          <LoginForm />
        </div>
      </div>
      <footer className="border-t py-4 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} ENTERAR.ME · Acceso restringido a administradores
      </footer>
    </div>
  );
}
