export { default } from "next-auth/middleware";

export const config = {
  // Protege todo menos login, api y archivos estáticos
  matcher: ["/((?!login|api|_next/static|_next/image|favicon.ico|logo.svg).*)"],
};
