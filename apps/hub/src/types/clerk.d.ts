import type { CustomJwtSessionClaims } from "@clerk/types";

declare global {
  interface CustomJwtSessionClaims {
    metadata?: {
      role?: string;
    };
  }
}

export {};
