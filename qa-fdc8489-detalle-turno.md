# QA post-merge FE — detalle turno `fdc8489`

**Fecha:** 2026-09-11  
**SHA:** `fdc8489`  
**Veredicto:** **PASS**

| Check | Resultado |
|-------|-----------|
| Página `/turnos/[id]` | 200, título "Detalle del turno" |
| `TurnoStateDropdown` | cableado; live `en_servicio` renderiza `<select>` |
| `getProximosKmForTurno` | import + call en server component |
| `TurnoActions` | no import, no archivo, no en HTML |
| Sin cookie | 307 (gate B5) |
| v11 transiciones/ocupación | 11/11 PASS |

Live: turno `c34153ad-…` estado `en_servicio` — dropdown sí, TurnoActions no. Heading "Próximo servicio por km" solo si hay intervalos (vacío en este seed, esperado).
