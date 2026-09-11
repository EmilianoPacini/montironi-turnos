import { vi } from "vitest";
import dotenv from "dotenv";

dotenv.config();

export const cookieStore = new Map<string, string>();

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: (name: string) => {
      const value = cookieStore.get(name);
      return value !== undefined ? { name, value } : undefined;
    },
    set: (nameOrOpts: string | { name: string; value: string }, value?: string) => {
      if (typeof nameOrOpts === "string") {
        cookieStore.set(nameOrOpts, value!);
      } else {
        cookieStore.set(nameOrOpts.name, nameOrOpts.value);
      }
    },
    delete: (name: string) => {
      cookieStore.delete(name);
    },
  })),
  headers: vi.fn(async () => new Headers()),
}));
