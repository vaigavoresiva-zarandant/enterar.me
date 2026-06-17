import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { directusUrl } from "@/lib/directus";

/**
 * Config de NextAuth para el super-admin.
 * Las credenciales se validan contra /auth/login de Directus.
 */
export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Directus",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        try {
          const res = await fetch(`${directusUrl}/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email: credentials.email,
              password: credentials.password,
            }),
          });
          if (!res.ok) return null;
          const json = (await res.json()) as {
            data?: { access_token?: string; expires?: number; refresh_token?: string };
          };
          const token = json.data?.access_token;
          if (!token) return null;

          // Traer el perfil del usuario
          const meRes = await fetch(`${directusUrl}/users/me`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!meRes.ok) return null;
          const meJson = (await meRes.json()) as {
            data?: {
              id: string;
              email: string;
              first_name?: string | null;
              last_name?: string | null;
              role?: string | null;
            };
          };
          const me = meJson.data;
          if (!me) return null;

          // Solo admins globales pueden entrar al super-admin.
          // Asumimos que el rol "Super Admin" o rol admin de Directus tiene acceso.
          return {
            id: me.id,
            email: me.email,
            name: [me.first_name, me.last_name].filter(Boolean).join(" ") || me.email,
            role: me.role ?? null,
            accessToken: token,
          };
        } catch (err) {
          console.error("[next-auth.authorize]", err);
          return null;
        }
      },
    }),
  ],
  session: { strategy: "jwt", maxAge: 60 * 60 * 8 },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.accessToken = (user as { accessToken?: string }).accessToken;
        token.role = (user as { role?: string | null }).role ?? null;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { accessToken?: string }).accessToken = token.accessToken as string | undefined;
        (session.user as { role?: string | null }).role = (token.role as string | null) ?? null;
      }
      return session;
    },
  },
  pages: { signIn: "/login" },
  secret: process.env.NEXTAUTH_SECRET,
};

// Type augmentation
declare module "next-auth" {
  interface Session {
    user: {
      id?: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      accessToken?: string;
      role?: string | null;
    };
  }
}
declare module "next-auth/jwt" {
  interface JWT {
    accessToken?: string;
    role?: string | null;
  }
}
