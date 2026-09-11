# montironi-turnos-v1 — DDL Datos (shared box)

**Fuente de verdad:** archivos en `/workspace/montironi-turnos-v1/` entregados por **Datos**.

| Archivo | md5 esperado | Estado |
|---------|--------------|--------|
| `005_comunicaciones_wah.sql` | `6f528869649dbbb4a4ef1782e6ee18b5` | requiere header `★ FUENTE OFICIAL` |
| `006_fix_intervalo_condicion.sql` | `a06011fe8277a55c99f95c4ff8231799` | hotfix DBs sucias |
| `ERD_COMUNICACIONES.md` | — | copiar verbatim desde box |
| `MIGRATIONS_LINEA_UNICA.md` | — | documentación cadena migraciones |

**No reescribir** desde spec de agente. Copiar verbatim desde shared box; validar:

```bash
bash scripts/validate-datos-005.sh
bash scripts/validate-datos-006.sh   # cuando 006 esté en box
```

Prisma/migraciones: alinear solo contra 005 oficial confirmado por Datos/PO.
