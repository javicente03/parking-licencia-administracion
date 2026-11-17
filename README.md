# Plantilla Base: Node.js + Express + TypeScript + Prisma

Pasos probados para levantar desde cero un backend robusto, evadiendo errores comunes de versiones experimentales y problemas de tipado en Node 20+.

## 1. Inicialización y Dependencias Estables

```bash
# Inicializar
mkdir mi-proyecto-backend
cd mi-proyecto-backend
yarn init -y

# Instalar dependencias core (Forzando Prisma v5 estable para evitar bugs del CLI v8+)
yarn add express cors dotenv jsonwebtoken bcrypt @prisma/client@^5

# Instalar dependencias de desarrollo (Fijando TS en v5.x y usando tsx en lugar de ts-node-dev)
yarn add -D prisma@^5 typescript@5.4.5 tsx @types/node @types/express @types/cors @types/jsonwebtoken @types/bcrypt

# tsconfig.json
# {
#   "compilerOptions": {
#     "target": "ES2022",
#     "module": "node16",
#     "moduleResolution": "node16",
#     "rootDir": "./src",
#     "outDir": "./dist",
#     "paths": {
#       "@/*": ["./src/*"]
#     },
#     "esModuleInterop": true,
#     "forceConsistentCasingInFileNames": true,
#     "strict": true,
#     "skipLibCheck": true
#   },
#   "include": ["src/**/*"],
#   "exclude": ["node_modules", "dist"]
# }

# package.json
# "scripts": {
#   "dev": "tsx watch src/server.ts",
#   "build": "tsc",
#   "start": "node dist/server.js",
#   "db:push": "prisma db push",
#   "db:generate": "prisma generate"
# }