# InterviewOps Manual QA Checklist (MVP)

## Environment Setup
- Install dependencies: `npm install`
- Ensure `.env` has valid `DATABASE_URL` and `NEXTAUTH_SECRET` (and `NEXTAUTH_URL` for invite links)
- Run Prisma client generation if needed: `npx prisma generate`
- Start dev server: `npm run dev`

## Smoke Checks
- Load `/login` successfully
- Login with a valid user
- Verify redirect to `/dashboard`
- Verify sidebar navigation works on list + detail pages (active state highlights correctly)
- Verify header org switcher renders and is keyboard accessible

## Organization & Multi-tenancy
- If user has no org, verify redirect to `/onboarding`
- Create organization
- Create a second organization using `/onboarding?mode=create`
- Switch active org using header org switcher
- Verify data isolation:
  - Create data in Org A
  - Switch to Org B
  - Org A data should not appear in Org B lists or detail pages

## Candidate Module
- List:
  - Empty state when no candidates
  - Search works
- Create:
  - Required full name validation
  - Invalid email/URL validation
- Detail:
  - Resume upload works and is org-scoped
  - Cross-org URL tampering (`/candidates/{id}` from another org) results in not-found
- Delete:
  - Deleting candidate with interviews should not break (cascade expected)

## Job Description Module
- List:
  - Empty state
  - Search works
- Create/Edit:
  - Required fields validation
- Detail:
  - Cross-org URL tampering results in not-found
- Delete:
  - Deleting JD with interviews should not break (cascade expected)

## Question Bank Module
- List:
  - Filters work (topic/difficulty/seniority/type)
  - Empty state if no questions
- Create/Edit:
  - Required fields validation
- Analytics snippets:
  - Should not crash with no usage data

## Interviews Module
- List:
  - Empty state when no interviews
  - Filters/search work
  - RBAC: users without permission cannot create/edit
- Create:
  - Candidate/JD selection required
  - Invalid date range handling (if start/end present)
- Detail:
  - Interview with no questions shows clean empty state
  - Question performance and timeline do not crash with no evaluations
  - Cross-org URL tampering results in not-found

## Live Interview Session
- Access:
  - RBAC: only permitted roles can conduct
- Per-question evaluation:
  - Score limits enforced (1–10)
  - Save shows success/failure feedback
  - Switching questions warns on unsaved changes
- Scorecard:
  - Save and refresh works
  - Recommendation and summary render correctly

## AI Assistant (If Enabled)
- Disabled by plan:
  - AI actions show upgrade/feature-not-available messaging
- Disabled by settings:
  - AI actions return clear “disabled” error
- Missing API key:
  - Provider errors show clean messages (no crashes)
- Generate flows:
  - Loading states appear during generation
  - Generated content is reviewable/editable before save where applicable

## Reports & Exports
- Generate report:
  - From interview detail scorecard section, Generate → redirects to `/reports/[id]`
  - Regenerate updates report and redirects
  - Generating without scorecard produces a partial report with warnings
- Reports list (`/reports`):
  - Report rows show candidate, role, type, score, recommendation, created date
- Report detail (`/reports/[id]`):
  - Layout is shareable/print-friendly
  - Print / Save as PDF opens browser print dialog
- Export gating:
  - If exports are not available for plan, Export buttons are disabled and message is clear
- Export JSON:
  - Downloads valid JSON file
- Export CSV:
  - Downloads CSV and opens in spreadsheet tools
- Security:
  - Cross-org report ID returns 404
  - Reports require `reports:view` permission

## Analytics & Dashboard
- Dashboard KPIs:
  - Render correctly with no data (0/— instead of crashes)
- Charts:
  - Do not crash on empty datasets
- Advanced analytics gating:
  - Non-eligible plans see clear upgrade messaging

## Settings
- General settings:
  - Toggles persist and show feedback
- Organization settings:
  - OWNER/ADMIN can edit; others read-only
  - Invalid website/logo URL shows clear validation error
- Team management:
  - RBAC: only team managers can access
  - Invite link creation validates email
  - Remove member guards (cannot remove self; cannot remove OWNER)

## Negative / Security Tests
- Unauthenticated access to protected routes redirects to `/login`
- Unauthorized role access returns “Access denied” UI where appropriate
- Attempt to access another org’s resources via URL id manipulation returns not-found
- Export endpoints require auth + permission + plan feature

## Final Validation
- Run: `npm run lint`
- Run: `npm run build`
