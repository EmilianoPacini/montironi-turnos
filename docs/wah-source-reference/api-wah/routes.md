# WAH API routes (literal paths — do not rename)

## Panel (session cookie, admin/empleado)

| Method | Path |
|--------|------|
| GET | `/api/wah/accounts` |
| GET | `/api/wah/dashboard?accountId=` |
| GET | `/api/wah/conversations?accountId=` |
| GET | `/api/wah/conversations/:id` |
| POST | `/api/wah/conversations/:id/messages` |
| POST | `/api/wah/conversations/:id/bot/resume` |
| GET | `/api/wah/media/:mediaId` |

## Integration (`X-Cima-Forward-Secret` = `CIMA_FORWARD_SECRET`)

| Method | Path |
|--------|------|
| POST | `/api/wah/integration/send-text` |
| POST | `/api/wah/integration/send-audio` |
| POST | `/api/wah/integration/send-file` |
| GET | `/api/wah/integration/media/:mediaId?empresa_id=` |
