#!/bin/sh
set -eu

echo "Esperando PostgreSQL..."
i=0
until node -e 'const {PrismaClient}=require("@prisma/client"); const p=new PrismaClient(); p.$connect().then(()=>p.$disconnect()).then(()=>process.exit(0)).catch(()=>process.exit(1))'; do
  i=$((i + 1))
  if [ "$i" -gt 30 ]; then
    echo "PostgreSQL no respondió a tiempo."
    exit 1
  fi
  sleep 2
done

echo "Aplicando migraciones..."
npx prisma migrate deploy

AUTO_SEED="${AUTO_SEED:-true}"
if [ "$AUTO_SEED" = "true" ]; then
  COUNT="$(node -e 'const {PrismaClient}=require("@prisma/client"); const p=new PrismaClient(); p.empresa.count().then((c)=>{process.stdout.write(String(c)); return p.$disconnect();}).catch((e)=>{console.error(e); process.exit(1);})')"
  if [ "$COUNT" = "0" ]; then
    echo "Base vacía: ejecutando seed..."
    npx tsx prisma/seed.ts
  else
    echo "La base ya tiene datos; se omite el seed."
  fi
fi

exec npm run start
