# InterviewOps

Private admin-only MVP foundation for an AI-powered technical interview copilot.

## Local setup (macOS)

### Prereqs
- Node.js 20+
- PostgreSQL (local)

### 1) Install dependencies
```bash
npm install
```

### 2) Configure environment
```bash
cp .env.example .env
```

Set `DATABASE_URL` to your local PostgreSQL connection string. The database name should be `interviewops_dev`.

### 3) Initialize the database
```bash
npm run prisma:migrate:dev -- --name init
npm run prisma:generate
```

### 4) Seed the initial admin user
Set `ADMIN_EMAIL` and `ADMIN_PASSWORD` in `.env`, then run:
```bash
npm run seed
```

### 5) Run the app
```bash
npm run dev
```

App: http://localhost:3000

## Prisma tools
```bash
npm run prisma:studio
```
