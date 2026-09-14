# Release and Push Quality Gates

Use this checklist for every code change. A green local run authorizes a push for remote verification; it does not authorize a merge or release by itself.

## 1. Before pushing

1. Review `git status` and the complete staged diff. Confirm that only intended files are included.
2. Review the diff for credentials, tokens, private keys, connection strings, SMTP passwords, provider keys, and realistic username/password pairs. Test credentials must be generated at runtime rather than committed as literals.
3. Use Node.js 24 and run the backend gate:

   ```sh
   cd backend
   npm ci
   npm audit --omit=dev --audit-level=high
   npm test
   ```

4. Use Node.js 24 and run the frontend/Vercel build gate:

   ```sh
   cd frontend
   npm ci
   npm audit --omit=dev --audit-level=high
   npm run lint --if-present
   npm test
   npm run build
   ```

5. When Railway-related files change, validate `backend/Dockerfile` with a clean Docker build when Docker is available. Confirm that the service binds to `PORT` and that `/health/live` returns HTTP 2xx.
6. Do not push if any command fails. Do not bypass or weaken a test merely to make the gate green.

## 2. After pushing the verification commit

Check all remote results for the exact same commit SHA:

- GitGuardian: no unresolved secret incident.
- GitHub Actions frontend job: passed, including the production build.
- GitHub Actions backend job: passed on Node.js 24.
- Vercel preview/production deployment: Ready, with the expected commit deployed.
- Railway deployment: Success/Active, followed by a successful `/health/live` request.

Do not merge, release, or promote the commit while any result is red, pending, cancelled, unexpectedly skipped, inaccessible, or attached to a different SHA.

## 3. Reporting

- Record the tested commit SHA and the result of every gate.
- Distinguish local evidence from provider-reported evidence.
- If access to GitGuardian, Vercel, or Railway is unavailable, report that gate as **unverified**, never as passed.
