# Project 1 — Node.js CI/CD optimization lab

Minimal Node.js application paired with the GitHub
[Node.js CI starter workflow](https://github.com/actions/starter-workflows/blob/main/ci/node.js.yml).
Provenance: `UPSTREAM.md`.

## Application

- Runtime: Node.js 20+ (built-in test runner, no npm test dependencies).
- Scripts: `npm run lint`, `npm test`, `npm run build`.
- Build output: `dist/` (copied module plus `build-info.json`).

## Topics to practice (Project 1 scope)

| # | Topic | Planned in this project |
|---|---|---|
| 1 | Dependency caching | npm / `actions/setup-node` cache |
| 4 | Parallel jobs | split test, lint, build |
| 5 | Build artifacts | hand off `dist/` between jobs |
| 8 | Path filtering | skip CI for docs-only changes |
| 9 | Concurrency control | cancel obsolete runs on same ref |

Docker-specific topics (BuildKit, multi-stage, layer order) belong to Project 2
and Project 4, not here.

## Local validation

```bash
cd project1-node-optimization-lab
npm ci
npm run lint
npm test
npm run build
```

## Status

Stage 1 (inspect and baseline prep) in progress. Workflows and EC2 deployment
will be added after the Project 4 EC2 cleanup and your approval to start Project
1 CI/CD experiments in this repository.
