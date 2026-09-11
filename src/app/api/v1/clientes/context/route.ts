import { NextRequest } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { getClienteContext } from "@/lib/modules/customers/service";
import { domainErrorResponse } from "@/lib/modules/agenda/api/http";
import { ClienteValidationError } from "@/lib/modules/customers/validation";

export async function GET(request: NextRequest) {
  try {
    const session = await requireSession();
    const telefono = request.nextUrl.searchParams.get("telefono");
    const id = request.nextUrl.searchParams.get("id");

    if (!telefono && !id) {
      return Response.json(
        { error: "Parámetro id o telefono requerido", code: "VALIDATION" },
        { status: 400 }
      );
    }

    const context = await getClienteContext({
      empresaId: session.empresaId,
      id: id ?? undefined,
      telefono: telefono ?? undefined,
    });

    if (!context) {
      return Response.json({ error: "Cliente no encontrado", code: "RecursoNoEncontrado" }, { status: 404 });
    }

    return Response.json({ cliente: context });
  } catch (e) {
    if (e instanceof ClienteValidationError) {
      return Response.json({ error: e.message, code: "ValidacionCliente" }, { status: 422 });
    }
    return domainErrorResponse(e);
  }
}
