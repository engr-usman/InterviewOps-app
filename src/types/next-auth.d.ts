import type { DefaultSession } from "next-auth";
import type { UserRole as PrismaUserRole } from "@prisma/client";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: PrismaUserRole;
    } & DefaultSession["user"];
  }

  interface User {
    role: PrismaUserRole;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: PrismaUserRole;
  }
}
