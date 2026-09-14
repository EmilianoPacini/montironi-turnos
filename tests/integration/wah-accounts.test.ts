import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  createTestFixture,
  destroyTestFixture,
  prisma,
  type TestFixture,
} from "../helpers/fixture";
import { upsertWhatsappAccount } from "@/lib/modules/wah/account.service";
import { findWhatsappAccountByPhoneNumberId } from "@/lib/modules/wah/conversation.service";

const PHONE_NUMBER_ID = `55512${Date.now().toString().slice(-10)}`;
const WABA_ID = `55513${Date.now().toString().slice(-10)}`;
const SECOND_PHONE = `55514${Date.now().toString().slice(-10)}`;

describe("cuentas WhatsApp", () => {
  let fx: TestFixture;

  beforeAll(async () => {
    fx = await createTestFixture(`wah-acc-${Date.now()}`);
  });

  afterAll(async () => {
    await destroyTestFixture(fx.empresaId);
  });

  it("upsert crea la línea y el webhook la encuentra por phone_number_id", async () => {
    const created = await upsertWhatsappAccount({
      empresaId: fx.empresaId,
      phoneNumberId: PHONE_NUMBER_ID,
      wabaId: WABA_ID,
      label: "Línea test",
      displayPhoneNumber: "5492616106452",
    });

    expect(created.phoneNumberId).toBe(PHONE_NUMBER_ID);
    expect(created.wabaId).toBe(WABA_ID);

    const found = await findWhatsappAccountByPhoneNumberId(PHONE_NUMBER_ID);
    expect(found?.id).toBe(created.id);
    expect(found?.empresaId).toBe(fx.empresaId);
  });

  it("upsert del mismo phone_number_id actualiza etiqueta", async () => {
    const updated = await upsertWhatsappAccount({
      empresaId: fx.empresaId,
      phoneNumberId: PHONE_NUMBER_ID,
      wabaId: WABA_ID,
      label: "Línea Mendoza",
      displayPhoneNumber: "5492616106452",
    });

    const count = await prisma.whatsappAccount.count({
      where: { empresaId: fx.empresaId, phoneNumberId: PHONE_NUMBER_ID },
    });
    expect(count).toBe(1);
    expect(updated.label).toBe("Línea Mendoza");
  });

  it("permite una segunda cuenta con otro phone_number_id", async () => {
    const second = await upsertWhatsappAccount({
      empresaId: fx.empresaId,
      phoneNumberId: SECOND_PHONE,
      wabaId: WABA_ID,
      label: "Otra línea",
    });
    expect(second.phoneNumberId).toBe(SECOND_PHONE);
    const count = await prisma.whatsappAccount.count({ where: { empresaId: fx.empresaId } });
    expect(count).toBe(2);
  });
});
