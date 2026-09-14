import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { getConfiguracionTaller } from "@/lib/modules/catalog/service";
import {
  createTestFixture,
  destroyTestFixture,
  prisma,
  type TestFixture,
} from "../helpers/fixture";

describe("B3/PR7 · getConfiguracionTaller IDOR", () => {
  let empresaA: TestFixture;
  let empresaB: TestFixture;

  beforeAll(async () => {
    const suffix = `cfg-${Date.now()}`;
    empresaA = await createTestFixture(`cfg-a-${suffix}`);
    empresaB = await createTestFixture(`cfg-b-${suffix}`);
  });

  afterAll(async () => {
    await destroyTestFixture(empresaA.empresaId);
    await destroyTestFixture(empresaB.empresaId);
    await prisma.$disconnect();
  });

  it("getConfiguracionTaller(tallerA, empresaB) → RecursoNoEncontrado", async () => {
    await expect(
      getConfiguracionTaller(empresaA.tallerId, empresaB.empresaId)
    ).rejects.toMatchObject({ code: "RecursoNoEncontrado" });
  });

  it("getConfiguracionTaller same-tenant OK", async () => {
    const cfg = await getConfiguracionTaller(empresaA.tallerId, empresaA.empresaId);
    expect(cfg).toBeTruthy();
    expect(cfg?.tallerId).toBe(empresaA.tallerId);
  });
});
