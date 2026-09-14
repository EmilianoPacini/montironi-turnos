# QA PR #17 — MT-P0-09 + login (`8c5f51c`)

**Verdict: FAIL (compile / no-go live)**  
**SHA:** `8c5f51c` on `cursor/fix-form-preserve-on-error-205c`  
**Date:** 2026-09-11  
**Env:** Next `:43123` + vitest local

## Evidence

| Check | Result | Notes |
|---|---|---|
| `tests/unit/form-action-state.test.ts` | PASS 4/4 | preserve values + fieldErrors + focusField; cliente/turno mappings |
| AC1 validación no reset + foco | CODE OK / LIVE BLOCKED | `formActionError` + `useFormFieldErrors` focus `[data-field]` |
| AC2 reintento conserva | CODE OK / LIVE BLOCKED | `state.values` rehydrate on `formKey` (turno/reprog/bloqueo) |
| AC3 4xx no limpia | CODE OK / LIVE BLOCKED | domain errors return `formActionError(..., values, ...)` |
| AC4 modal × limpia al reabrir | CODE OK / LIVE BLOCKED | `InlineClienteModal` / `InlineVehiculoModal` reset on `open` |
| AC5 turno/reprog/bloqueo/cancel | PARCIAL | cancel = `confirm()` sin form (no hay valores que preservar) |
| Login fondo neutral | CODE OK / LIVE BLOCKED | `bg-slate-100`; quitó `from-blue-700 via-blue-600 to-sky-500` |

## Blocker (P0)

`GET /login` → **500**. Turbopack:

```
./src/components/ui/use-form-field-errors.ts:41:10
Error: Expected '>', got 'ident'
Parsing ecmascript source code failed
```

`FieldErrorMessage` es JSX dentro de un archivo `.ts`. Vitest lo parsea; Next/Turbopack no. El error entra al grafo de Client Components (`NuevoTurnoForm`) y tumba el dev server (incluido `/login`).

**Fix esperado:** renombrar a `use-form-field-errors.tsx` (y actualizar imports).

## Residual

- Cancel no comparte el patrón de form state (no hay campos). No es el blocker.
- No se pudo smoke live de AC1–5 ni el fondo de login por el 500.

## Commits in scope

- `bc22102` fix(forms): preserve input values on validation and 4xx errors
- `c99fc43` feat(forms): highlight and focus invalid fields on validation error
- `5406247` feat(MT-P0-09): extend form recovery to S04/S10/S11/S13 and modal AC4
- `8c5f51c` style(login): replace saturated blue gradient with neutral background
