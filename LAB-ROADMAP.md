# CI/CD optimization lab roadmap

## Completed

- **Project 4 — .NET Docker sample**: all 12 topics measured and documented under
  `measurements/` and `README.md`.

## Remaining projects

| Project | Focus |
|---|---|
| 1 — Node.js + starter workflow | npm cache, parallel jobs, artifacts, path filters, concurrency |
| 2 — Docker publish workflow | BuildKit cache, image publish, multi-stage, layer order, digest reuse |
| 3 — Next.js (isolated exercise) | incremental build, parallel jobs, test parallelization, path filters |
| 5 — Moby BuildKit examples | cache mounts, import/export, layer invalidation |
| 6 — CI-Optimization | test execution, artifacts, parallelization, feedback time |

Each project follows the same lifecycle: inspect, prepare, push (same GitHub repo
when applicable), measure one optimization at a time, EC2 cleanup after approval.

## Post-lab deliverables (after all projects)

Two Cursor Agent Skills will be authored from measured results and decision rules:

1. **`optimize-github-actions-cicd`** — choose and apply CI/CD techniques
   (caching, parallelism, artifacts, path filters, concurrency, runner sizing,
   test sharding) based on stack, repo layout, and bottlenecks.
2. **`optimize-dockerfile`** — apply Docker-only techniques (multi-stage,
   layer ordering, BuildKit cache mounts, image reuse) when a Dockerfile is
   present.

Skills will reference this lab’s `measurements/` data and include when **not**
to apply a technique (negative results are part of the guidance).

Planned location: personal skills directory (`~/.cursor/skills/`) unless you
prefer project-scoped skills under `.cursor/skills/` in this repository.
