---
name: optimize-github-actions-cicd
description: Designs and improves GitHub Actions CI/CD for an application repo by selecting dependency caching, job parallelism, artifacts, path filters, concurrency, runner sizing, and test parallelization based on stack and measured bottlenecks. Use when the user asks for CI/CD, GitHub Actions, pipeline optimization, deploy workflows, or faster builds/tests without Dockerfile-only changes.
---

# Optimize GitHub Actions CI/CD

Build or refine pipelines **one meaningful change at a time** when measuring impact. Preserve a baseline workflow for comparison. Never commit secrets; use repository secrets and variables.

For **Dockerfile, BuildKit, multi-stage, and layer ordering**, use the separate skill `optimize-dockerfile` instead of duplicating that guidance here.

## 1. Discover the project

Before editing workflows, inventory:

| Signal | Where to look |
|---|---|
| Language / runtime | `package.json`, `*.csproj`, `go.mod`, `pyproject.toml`, `pom.xml`, etc. |
| Lockfiles / cache keys | `package-lock.json`, `pnpm-lock.yaml`, `packages.lock.json`, `Gemfile.lock` |
| Test & lint entrypoints | `npm test`, `dotnet test`, `pytest`, `mvn test`, scripts in CI today |
| Build outputs | `dist/`, `publish/`, `target/`, Docker image |
| Deploy target | container registry, SSH host, Kubernetes, none |
| Existing workflows | `.github/workflows/*.yml` |
| PR vs main behavior | deploy only on trusted refs; never deploy untrusted PR code to production |

Record baseline: wall time, per-job duration, restore/install, test, build, deploy (if any). Compare cold vs warm cache separately.

## 2. Choose techniques (decision rules)

Apply only when expected benefit exceeds overhead. Lab evidence below comes from a small .NET + Docker + EC2 repo; **re-measure** on the target project when stakes are high.

### Dependency caching (NuGet, npm, pip, Maven, Go modules)

**Use when:**

- Restore/install is a large fraction of job time (many or heavy packages).
- Lockfiles or dependency manifests change infrequently (high hit rate).
- Runners are ephemeral (GitHub-hosted) with no persistent local cache.
- Registry is slow, private, or rate-limited.

**Skip or defer when:**

- Restore is already fast (lab: ~4 s NuGet restore; cache restore + extract made **combined** restore **13% slower** and pipeline **4% slower**).
- Dependencies change every commit (miss + save overhead).
- Self-hosted runners already keep cache on disk.

**Implementation hints:**

- Prefer ecosystem actions (`actions/setup-node` with `cache`, `actions/setup-dotnet`, `actions/cache` with correct paths and keys from lockfiles).
- Key on lockfile hash + runner OS + toolchain version.
- Report: restore-only time, cache action time, and **full job** time.

### Incremental application builds

**Use when:**

- Jobs are split and later steps can reuse compiler output (`--no-build`, Gradle build cache, Bazel, Nx affected).
- The same job currently recompiles for test then publish without reuse.

**Skip when:**

- Single job already compiles once and MSBuild/npm/vite reuse workspace outputs (lab: explicit build + `--no-build` test/publish was **0.7% slower** overall).

### Parallel jobs

**Use when:**

- Independent stages exist (e.g. unit tests vs Docker image build vs lint) with similar or overlapping duration.
- Wall-clock time matters more than total runner-minutes.

**Lab:** Sequential 97 s → parallel 64 s wall (**34%**); total compute unchanged in theory.

**Pattern:**

```yaml
jobs:
  test:
    ...
  build-image:
    ...
  deploy:
    needs: [test, build-image]
    if: github.event_name != 'pull_request' && github.ref == 'refs/heads/main'
```

Avoid false parallelism: steps that must share one workspace stay in one job.

### Build artifacts between jobs

**Use when:**

- A later job would **repeat** an expensive build (lab: redeploy rebuild **22 s**; artifact up+down **~4 s** → **26.6%** faster wall, **20.9%** less runner time).
- You must deploy the **exact** artifact that passed tests (images, `dist/`, mobile bundles).

**Practice:**

- Upload once from the validating job; download in deploy job.
- Short retention for CI handoffs (e.g. 1 day), not long-term storage.
- For images without a registry: `docker save` + compressed archive + upload; verify integrity on the target (see lab: archive SHA-256, not Docker `image ID` across Docker 29 containerd vs legacy store).

### Path filtering

**Use when:**

- Docs, markdown, or unrelated paths should not trigger full CI/deploy (lab: docs-only commit **71 s → 0 s** workflow).

**Caveats:**

- Maintain path lists when adding modules.
- Required status checks can show **pending** if a filtered workflow never runs; use a small always-on check or adjust branch protection.

```yaml
on:
  push:
    paths:
      - 'src/**'
      - 'package-lock.json'
      - '.github/workflows/ci.yml'
  workflow_dispatch:
```

### Concurrency control

**Use when:**

- Rapid pushes to the same branch can overlap pipelines and **deploy stale** commits.
- You need at most one active run per ref.

**Not primarily for speed:** Lab overlapping runs saved **~1%** runner time but prevented duplicate deploys; cancellation can be late.

```yaml
concurrency:
  group: ci-${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true
```

### Right-sized runners

**Use when:**

- Profiling shows CPU/memory-bound steps and a larger runner is justified (private repos: compare billable minutes × rate).
- Test parallelization or heavy compilation needs more cores.

**Avoid blindly downsizing:** Lab `ubuntu-slim` (1 vCPU) made test job **139% slower** and pipeline **16% slower** on a public repo with **$0** savings.

Default: **`ubuntu-latest`** for mixed compile/test/Docker jobs unless measured otherwise.

### Test parallelization (matrix / sharding)

**Use when:**

- Test suite runtime is **minutes**, shards are balanced, and test stage is on the critical path.
- Cost of extra runners is acceptable.

**Skip when:**

- Tests finish in seconds (lab: 2 shards **14.9% slower** test stage, **119%** more test-runner time).

Prefer in-process parallelism (xUnit collections, Jest workers) before CI matrix sharding.

## 3. Recommended pipeline shape (container deploy)

When the app ships as a Docker image to a trusted host:

1. **Trigger** — `push`/`pull_request` with path filters; `workflow_dispatch` for manual runs.
2. **Parallel validate** — tests (and lint if separate) || image build (see `optimize-dockerfile`).
3. **Artifact** — upload immutable image archive (+ digest sidecar if verifying over SSH).
4. **Deploy** — only `main` (or protected env); download artifact; verify digest; load/run; smoke test.
5. **Concurrency** — one run per ref for deploy workflows.
6. **Secrets** — SSH keys, hosts via secrets; never in logs.

Do not disable tests or scans to improve benchmarks.

## 4. Measurement template

For each change, record:

| Metric | Baseline | After |
|---|---|---|
| Workflow wall time | | |
| Total runner execution (sum of jobs) | | |
| Critical path job | | |
| Install/restore | | |
| Test | | |
| Build/publish | | |
| Deploy | | |
| Cache hit/miss | | |

Run multiple times; report median for end-to-end, average for step-level when noted.

## 5. Security and cost

- No secrets in YAML or git; use GitHub Environments only when justified.
- PR workflows: read-only caches where applicable; no production deploy.
- Prefer OIDC over long-lived cloud keys when integrating AWS/GCP (lab used SSH by user choice).
- Call out paid features (larger runners, cache storage limits, registry egress) before adding them.

## 6. Output expected from the agent

When applying this skill, deliver:

1. Short bottleneck summary from repo inspection.
2. Ordered list of techniques (**with “skip because …”** for rejected ones).
3. Concrete workflow YAML changes (minimal diff).
4. Validation commands (local + expected CI behavior).
5. What to measure on the next run.

## Reference

Measured examples and run links: [lab-measurements.md](lab-measurements.md) (Project 4 CI/CD optimization lab).
