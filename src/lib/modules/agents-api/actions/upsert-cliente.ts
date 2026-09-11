import { upsertCliente } from "@/lib/modules/customers/service";

export async function handleUpsertCliente(empresaId: string, body: Record<string, unknown>) {
  const cliente = await upsertCliente({
    empresaId,
    id: body.id ? String(body.id) : undefined,
    nombre: String(body.nombre),
    apellido: body.apellido ? String(body.apellido) : undefined,
    email: body.email ? String(body.email) : undefined,
    telefono: body.telefono ? String(body.telefono) : undefined,
    documento: body.documento ? String(body.documento) : undefined,
  });
  return {
    cliente: {
      id: cliente.id,
      nombre: cliente.nombre,
      apellido: cliente.apellido,
      telefono: cliente.telefono,
    },
  };
}
