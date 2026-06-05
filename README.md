# InterviewOps

AI-Powered Technical Interview Management Platform

## Overview

InterviewOps is a modern interview management platform designed to streamline technical hiring processes. It enables organizations to manage candidates, job descriptions, interview sessions, interviewer collaboration, evaluation scorecards, and interview reports from a single platform.

The platform supports role-based access control, interview assignment workflows, reusable question banks, candidate evaluation reports, analytics dashboards, and future AI-powered interview assistance capabilities.

---

# Features

## Organization Management

- Multi-organization support
- Team member invitations
- Role-based permissions
- Organization onboarding
- Organization switching

---

## User Roles

### Owner

- Full organization access
- Manage team members
- Create and manage interviews
- Manage question bank
- View all reports
- Manage settings

### Admin

- Manage candidates
- Manage job descriptions
- Create interviews
- Manage reports
- Manage question bank

### Interviewer

- View assigned interviews only
- View assigned candidates only
- View assigned job descriptions only
- Conduct interviews
- Complete evaluations
- Generate reports for assigned interviews
- Create private/shared questions

### Viewer

- Read-only access

---

# Candidate Management

Features include:

- Candidate creation
- Resume upload
- Resume parsing
- Candidate profile management
- Candidate search
- Candidate evaluation history

Supported resume formats:

- PDF
- DOCX (future)
- TXT

---

# Job Description Management

- Create job descriptions
- Edit job descriptions
- Department management
- Seniority classification
- Skill requirements
- Job summary generation

---

# Interview Management

Features:

- Schedule interviews
- Assign interviewer
- Add candidate
- Link job description
- Add questions from question bank
- Interview progress tracking
- Evaluation workflow
- Completion tracking

Interview statuses:

- Scheduled
- In Progress
- Completed

---

# Question Bank

Question bank supports:

## Domains

### Cloud Computing

Sub-domains:

- AWS
- Azure
- GCP

### DevOps

Sub-domains:

- Linux
- Docker
- Kubernetes
- Terraform
- CI/CD

### SRE

Sub-domains:

- Monitoring
- Observability
- Incident Response

### Security

Sub-domains:

- IAM
- DevSecOps
- Vulnerability Management

---

## Question Visibility

### My Questions

Private questions visible only to creator.

### Shared Questions

Visible to all interviewers within the organization.

---

# Evaluation & Scorecards

Interviewers can score:

- Technical skills
- Communication
- Problem solving
- Overall assessment

Outputs include:

- Technical average
- Overall score
- Recommendation
- Strengths
- Weaknesses
- Interview notes

Recommendations:

- Strong Hire
- Hire
- Borderline
- No Hire

---

# Reports

Generated reports contain:

- Candidate summary
- Job description summary
- Evaluation breakdown
- Question-by-question scoring
- Recommendation summary
- Strengths and weaknesses
- Final notes

Report generation is available after interview completion.

---

# Analytics

Analytics include:

- Interview trends
- Recommendation breakdown
- Most used questions
- Hiring statistics
- Candidate score distributions

---

# Technology Stack

## Frontend

- Next.js 16
- React
- TypeScript
- TailwindCSS
- shadcn/ui

## Backend

- Next.js Server Actions
- Prisma ORM

## Database

- PostgreSQL

## Authentication

- Custom Authentication
- Organization-based RBAC

## Deployment

- AWS EC2
- PM2
- Nginx
- SSL via Let's Encrypt

---

# Local Development

## Install Dependencies

bash npm install 

## Configure Environment

Create a .env file:

env DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/interviewops"  NEXTAUTH_SECRET="CHANGE_ME"  NEXTAUTH_URL="http://localhost:3000"  APP_URL="http://localhost:3000" 

---

## Prisma

Generate Prisma Client:

bash npx prisma generate 

Run migrations:

bash npx prisma migrate dev 

---

## Start Development Server

bash npm run dev 

Application URL:

text http://localhost:3000 

---

# Production Deployment (AWS EC2)

## Directory Structure

text /var/www/InterviewOps 

---

## Clone Repository

bash cd /var/www  git clone <REPOSITORY_URL> InterviewOps  cd InterviewOps 

---

## Install Dependencies

bash npm install 

---

## Build Application

bash npm run build 

---

## Configure Environment

bash nano .env 

Example:

env NODE_ENV=production  DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/interviewops"  NEXTAUTH_SECRET="REPLACE_WITH_SECURE_SECRET"  NEXTAUTH_URL="https://interviewops.syedusmanahmad.com"  APP_URL="https://interviewops.syedusmanahmad.com" 

---

## Prisma Production Setup

bash npx prisma generate  npx prisma migrate deploy 

---

# PM2 Configuration

Create:

bash nano ecosystem.config.cjs 

javascript module.exports = {   apps: [     {       name: "interviewops",        cwd: "/var/www/InterviewOps",        script: "node_modules/next/dist/bin/next",        args: "start -p 3002",        instances: 1,        exec_mode: "fork",        autorestart: true,        watch: false,        max_memory_restart: "1G",        env: {         NODE_ENV: "production",         PORT: 3002       },        error_file: "/var/www/InterviewOps/logs/error.log",        out_file: "/var/www/InterviewOps/logs/out.log",        log_file: "/var/www/InterviewOps/logs/combined.log",        time: true     }   ] }; 

Create logs directory:

bash mkdir -p logs 

Start PM2:

bash pm2 start ecosystem.config.cjs 

Save PM2 configuration:

bash pm2 save 

Verify:

bash pm2 status 

---

# Nginx Configuration

Create:

bash sudo nano /etc/nginx/conf.d/interviewops.conf 

nginx server {     listen 80;      server_name interviewops.syedusmanahmad.com;      location / {         proxy_pass http://127.0.0.1:3002;          proxy_http_version 1.1;          proxy_set_header Upgrade $http_upgrade;         proxy_set_header Connection "upgrade";          proxy_set_header Host $host;          proxy_set_header X-Real-IP $remote_addr;          proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;          proxy_set_header X-Forwarded-Proto $scheme;          proxy_cache_bypass $http_upgrade;     } } 

Validate configuration:

bash sudo nginx -t 

Reload Nginx:

bash sudo systemctl reload nginx 

---

# SSL Configuration

Install SSL certificate:

bash sudo certbot --nginx -d interviewops.syedusmanahmad.com 

Verify:

text https://interviewops.syedusmanahmad.com 

---

# Monitoring

## PM2 Logs

bash pm2 logs interviewops 

## Application Logs

bash tail -f /var/www/InterviewOps/logs/combined.log 

## Nginx Logs

bash sudo tail -f /var/log/nginx/error.log 

---

# Deployment Checklist

Before production release:

- [ ] npm install
- [ ] npm run build
- [ ] prisma generate
- [ ] prisma migrate deploy
- [ ] PM2 start
- [ ] PM2 save
- [ ] Nginx test
- [ ] SSL configured
- [ ] DNS configured
- [ ] Login verified
- [ ] Candidate workflow tested
- [ ] Interview workflow tested
- [ ] Report generation tested
- [ ] RBAC permissions tested

---

# Future Roadmap

- OpenAI Integration
- Gemini Integration
- AI-generated Questions
- Resume Skill Matching
- AI Candidate Scoring
- AI Interview Summaries
- AI Recommendations
- PDF Report Export
- Email Notifications
- Calendar Integration
- Multi-language Support

---

# Maintainer

InterviewOps

Created and maintained by:

Usman Ahmad  
AWS Solutions Architect Professional  
Principal DevOps Consultant