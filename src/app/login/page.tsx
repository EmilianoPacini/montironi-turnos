"use client";

import { useActionState } from "react";
import { loginAction } from "@/lib/modules/auth/actions";

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(
    async (_prev: { error?: string } | undefined, formData: FormData) => {
      return (await loginAction(formData)) ?? undefined;
    },
    undefined
  );

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200/80 bg-white p-8 shadow-lg shadow-slate-900/5">
        <div className="mb-8 text-center">
          <p className="text-sm font-semibold uppercase tracking-wider text-sky-700">
            Montironi
          </p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">Cima AI</h1>
          <p className="mt-2 text-sm text-slate-600">
            Agenda compartida para taller y agentes
          </p>
        </div>

        <form action={formAction} className="space-y-4">
          <div>
            <label htmlFor="email" className="mb-1 block text-sm font-medium text-slate-700">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              defaultValue="admin@montironi.com"
              className="input-field"
            />
          </div>
          <div>
            <label htmlFor="password" className="mb-1 block text-sm font-medium text-slate-700">
              Contraseña
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              defaultValue="admin123"
              className="input-field"
            />
          </div>

          {state?.error ? (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {state.error}
            </p>
          ) : null}

          <button type="submit" disabled={pending} className="btn-primary-lg w-full">
            {pending ? "Ingresando..." : "Ingresar"}
          </button>
        </form>

        <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
          <p className="font-medium text-slate-800">Usuarios de prueba:</p>
          <p>Admin: admin@montironi.com / admin123</p>
          <p>Empleado: empleado@montironi.com / empleado123</p>
        </div>
      </div>
    </div>
  );
}
