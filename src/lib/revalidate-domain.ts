import { revalidatePath } from "next/cache";

/** Invalidar todas las pantallas que leen catálogo / agenda / clientes. */
export function revalidateDomainSurfaces(
  extra: string[] = [],
  scope: "catalogo" | "agenda" | "clientes" | "all" = "all"
) {
  const byScope: Record<typeof scope, string[]> = {
    catalogo: ["/servicios", "/turnos/nuevo", "/agenda", "/bahias"],
    agenda: ["/agenda", "/turnos/nuevo"],
    clientes: ["/clientes", "/turnos/nuevo", "/agenda"],
    all: ["/servicios", "/turnos/nuevo", "/agenda", "/bahias", "/clientes"],
  };

  const paths = new Set([...byScope[scope], ...extra]);
  for (const path of paths) {
    revalidatePath(path);
  }
}
