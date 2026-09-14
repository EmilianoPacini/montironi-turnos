# QA PR #17 — MT-P0-09 + login (`f96fb85`)

**Verdict: PASS**  
**SHA:** `f96fb85` on `cursor/fix-form-preserve-on-error-205c`  
**Date:** 2026-09-12  
**Env:** Next `:43123` + vitest + `scripts/qa-mt-p0-09-f96fb85.ts`

## Evidence

| Check | Result | Notes |
|---|---|---|
| Compile JSX | PASS | `use-form-field-errors.tsx` (no `.ts`). `GET /login` 200 |
| Unit `form-action-state.test.ts` | PASS 4/4 | values + fieldErrors + focusField |
| Login fondo | PASS live | `bg-slate-100`; no `from-blue-700` / `via-blue-600` / `to-sky-500` |
| AC1 alta cliente validación | PASS | E.164 inválido → error en `telefono`, values `{nombre,apellido,telefono}` intactos, focus `telefono` |
| AC2 corregir solo ese campo | PASS | retry con `+5491112345678` → upsert OK (luego cleanup) |
| AC3 vehículo | PASS (action) | `createVehiculoInlineAction` / `saveVehiculoAction` guardan patente vacía con fieldError. Domain `upsertVehiculo("")` no tira (el action corta antes) |
| AC3 nuevo turno | PASS | `formActionError` conserva notas/cliente; focus `servicioIds` |
| AC4 modal × reabrir | PASS código | `InlineClienteModal` / `InlineVehiculoModal` reset on `open` |
| AC5 cancel | N/A | `confirm()` sin form |
| Pages live | PASS | `/clientes/nuevo` `/turnos/nuevo` `/agenda/bloquear` 200 |

## Residual

- No click-through Playwright del modal ×.
- Cancel no comparte form state.
- HEAD pin: `f96fb85` al cierre.

## Prior FAIL closed

`8c5f51c` Turbopack 500 por JSX en `.ts` — resuelto en este SHA.
