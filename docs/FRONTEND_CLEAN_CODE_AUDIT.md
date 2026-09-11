# Frontend Clean Code / SOLID Audit — Montironi Turnos / Cima AI

**Base:** `main` @ `2d0ac02` (Sep 2026)  
**Scope:** `src/app/(panel)/**`, `src/components/**` (excluding WAH), `src/app/login/**`  
**Off-limits:** `src/components/wah/**`, `src/lib/modules/wah/**`, `/comunicaciones`, `/api/wah`

## Smell inventory (ranked by impact)

| # | File | ~LOC | Smell | Status |
|---|------|------|-------|--------|
| 1 | `src/components/turnos/NuevoTurnoForm.tsx` | 328 | God component: form + modals + inline actions | Partial — `ClienteCoreFields` dedup (PR #13); full split deferred |
| 2 | `src/components/agenda/AgendaGrid.tsx` | 256 | Huge: layout math + tiles mixed | Deferred |
| 3 | `src/components/layout/Sidebar.tsx` | 244 | Huge: inline SVG icons | Deferred |
| 4 | `src/app/(panel)/agenda/page.tsx` | 242 | God page + inline filters | Fixed — `AgendaFilters` extracted (PR #11) |
| 5 | `src/app/(panel)/turnos/[id]/page.tsx` | 192 | God page: fetch + domain rules | Fixed — `getProximosKmForTurno` (PR #14) |
| 6 | Duplicated action-runner | 3 files | `useTransition` + refresh + alert | Fixed — `useActionTransition` (PR #10) |
| 7 | Availability preview | 2 pages | Duplicated slots UI | Fixed — `AvailabilitySlotsPanel` (PR #12) |
| 8 | Cliente inline modal | NuevoTurnoForm | Duplicated form fields | Fixed — `ClienteCoreFields` (PR #13) |
| 9 | `src/components/turnos/TurnoActions.tsx` | 83 | Dead code | Removed (PR #10) |
| 10 | `src/components/turnos/TurnoCard.tsx` | 48 | Dead code | Deferred |
| 11 | `src/app/(panel)/servicios/page.tsx` | 141 | God page + duplicated selects | Deferred |
| 12 | Form styling drift | multiple | Mixed `input-field` vs inline classes | Deferred |

## PRs

| PR | Branch | Focus |
|----|--------|-------|
| #10 | `cursor/refactor-action-transition-hook-c33d` | `useActionTransition`, remove `TurnoActions` |
| #11 | `cursor/extract-agenda-filters-c33d` | `AgendaFilters` + constants-driven labels |
| #12 | `cursor/extract-availability-slots-c33d` | `AvailabilitySlotsPanel` |
| #13 | `cursor/extract-cliente-core-fields-c33d` | `ClienteCoreFields` |
| #14 | `cursor/move-proximos-km-service-c33d` | `getProximosKmForTurno` service helper |

## QA smoke checklist

- [ ] Login (Admin + Empleado roles)
- [ ] Agenda: grilla/lista, filtros estado/origen, pendientes toggle
- [ ] Nuevo turno: cliente/vehículo inline modals, crear turno
- [ ] Turno detail: confirmar, transiciones, cancelar, reprogramar
- [ ] Reprogramar: slots disponibles panel
- [ ] Bloquear bahía + quitar bloqueo desde grilla
- [ ] Comunicaciones / WAH inbox + chat (unchanged)
- [ ] Clientes CRUD forms

## Deferred (future PRs)

- Split `NuevoTurnoForm` into `TurnoSchedulingFields`, `ClienteVehiculoPicker`, modal shells
- Extract agenda grid layout math to `lib/agenda/grid-layout.ts`
- Extract `BahiaSelect`, `DateTimeFields` shared components
- Sidebar icon extraction to `sidebar-nav.ts` + `NavIcons.tsx`
- Remove or wire up unused `TurnoCard.tsx`
- `servicios/page.tsx` form component extraction
- Pre-existing build TS errors in `buyer/service.ts`, `intervalo.service.ts` (unrelated)
