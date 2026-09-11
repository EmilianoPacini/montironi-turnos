import { describe, expect, it } from "vitest";
import { formatMovimientoDescripcion } from "@/lib/modules/audit/format-movimiento";

describe("formatMovimientoDescripcion", () => {
  it("formatea crear bahía con taller", () => {
    const label = formatMovimientoDescripcion(
      {
        entidad: "bahia",
        entidadId: "568efef4-5e00-0000-0000-000000000000",
        accion: "crear_bahia",
        detalle: { nombre: "Mecánica 1", tallerId: "t1" },
      },
      {
        bahia: { nombre: "Mecánica 1", taller: { nombre: "Taller Centro" } },
      }
    );
    expect(label).toBe("Crear bahía · Mecánica 1 (Taller Centro)");
  });

  it("formatea cancelar turno con cliente y patente", () => {
    const label = formatMovimientoDescripcion(
      {
        entidad: "turno",
        entidadId: "turno-1",
        accion: "cancelar",
        detalle: { motivo: "Cliente avisó" },
      },
      {
        turno: {
          cliente: { nombre: "María", apellido: "González" },
          vehiculo: { patente: "AB123CD" },
        },
      }
    );
    expect(label).toBe("Cancelar turno · María González · AB123CD");
  });

  it("formatea transición de estado", () => {
    const label = formatMovimientoDescripcion(
      {
        entidad: "turno",
        entidadId: "turno-1",
        accion: "transicion",
        detalle: { estadoPrev: "pendiente", estadoNuevo: "confirmado" },
      },
      {
        turno: {
          cliente: { nombre: "Juan", apellido: null },
          vehiculo: { patente: "XY999ZZ" },
        },
      }
    );
    expect(label).toBe("Cambiar estado · Juan · Pendiente → Confirmado");
  });

  it("usa detalle cuando no hay join de bahía", () => {
    const label = formatMovimientoDescripcion(
      {
        entidad: "bahia",
        entidadId: "b1",
        accion: "actualizar_bahia",
        detalle: { nombre: "Pintura 2" },
      },
      { taller: { nombre: "Taller Norte" } }
    );
    expect(label).toBe("Actualizar bahía · Pintura 2 (Taller Norte)");
  });
});
