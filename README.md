# .NET CI/CD Optimization Lab

Isolated copy of the .NET Docker `MultiProjectApp` sample for measuring CI/CD
optimizations one at a time. Provenance: `UPSTREAM.md`. License: `LICENSE`.

Stack: .NET 11 console app, two libraries, xUnit tests, Docker multi-stage
build, GitHub Actions on `ubuntu-latest`, deploy to EC2 over SSH (trusted
`main` only).

## Workflows

| Workflow | Purpose |
|---|---|
| `ec2-connectivity.yml` | Manual SSH and Docker sanity check on EC2 |
| `project4-baseline.yml` | Preserved manual unoptimized CI/CD baseline |
| `project4-nuget-cache.yml` | Optimization 1: NuGet `~/.nuget/packages` cache via `actions/cache@v6` |
| `project4-buildkit-cache.yml` | Optimization 2: BuildKit layer cache via GitHub Actions cache |
| `project4-incremental-build.yml` | Optimization 3: build once, then test and publish with `--no-build` |
| `project4-jobs-sequential.yml` | Topic 4 sequential multi-job control |
| `project4-jobs-parallel.yml` | Default CI/CD: test and image jobs run concurrently |
| `project4-no-artifact-control.yml` | Topic 5 control: deployment job rebuilds the image |

Detailed numbers and run links: `BASELINE.md` and the files under
`measurements/`.

---

## CI/CD timing: before vs after (Optimization 1 — NuGet dependency cache)

Measurements are **GitHub Actions** on `ubuntu-latest`, same commit family,
Docker still `--no-cache`, EC2 deployment unchanged. Times are **averages**
unless noted. **Improvement** = baseline minus optimized (positive = faster).

### End-to-end pipeline

| Metric | Before (baseline) | After (NuGet cache, warm) | Change |
|---|---:|---:|---|
| GitHub job duration | 61.3 s | 65.3 s | **−4.0 s (6.5% slower)** |
| Instrumented pipeline duration | 56.840 s | 59.354 s | **−2.5 s (4.4% slower)** |

Total pipeline time includes Docker build, image archive, SCP to EC2, load, and
smoke test—not only restore—so it can move with network variance even when
restore improves.

### Dependency restore (where caching applies)

| Metric | Before (baseline) | After (warm cache hit) | Change |
|---|---:|---:|---|
| `dotnet restore` only | 4.278 s | 2.757 s | **+1.5 s (35.6% faster)** |
| Cache restore action (`actions/cache`) | — (cleared each run) | 2.084 s | overhead |
| **Cache action + restore combined** | **4.278 s** | **4.841 s** | **−0.56 s (13.2% slower)** |

Cold cache run (first miss, then save ~40 MB): job 66 s, pipeline 59.2 s,
restore 3.741 s, cache lookup 0.433 s.

### Other steps (unchanged by design; for context)

| Metric | Before (baseline avg) | After (NuGet cache warm avg) |
|---|---:|---:|
| Tests | 6.252 s | 6.106 s |
| Publish | 1.858 s | 1.617 s |
| Docker build (`--no-cache`) | 20.958 s | 19.308 s |
| Transfer to EC2 | 3.563 s | 6.020 s |
| EC2 image load | 4.343 s | 4.471 s |
| EC2 smoke test | 0.420 s | 0.398 s |
| Image size | 230,839,331 bytes | same |

All runs: 3 tests passed; EC2 output validated.

### Conclusion for this repository

NuGet caching **speeds up the restore command** but **does not reduce overall
CI/CD time** here because cache download/extraction costs more than the saved
downloads. **Not promoted** to the default workflow; baseline stays canonical.

## CI/CD timing: before vs after (Optimization 2 — BuildKit cache)

The warm BuildKit experiment reused an average of 13.7 of 14 eligible
Dockerfile steps.

| Metric | Before | After (warm cache) | Change |
|---|---:|---:|---:|
| Docker build action | 20.958 s | 10.579 s | **49.5% faster** |
| Docker work including Buildx setup | 20.958 s | 19.497 s | **7.0% faster** |
| Instrumented pipeline | 56.840 s | 53.185 s | **6.4% faster** |
| GitHub job | 61.3 s | 59.0 s | **3.8% faster** |
| Image size | 230,839,331 bytes | same | unchanged |

The cold cache was expensive: 129 s job duration, including a 54.5 s initial
cache export. Warm layer reuse roughly halved the build action, but creating a
fresh Buildx builder added about 8.9 s per runner and consumed most of that
saving.

Detailed results: `measurements/02-docker-buildkit-cache.md`.

## CI/CD timing: before vs after (Optimization 3 — incremental build reuse)

The experiment explicitly builds the solution once, then tests and publishes
the existing Release outputs.

| Metric | Before | After | Change |
|---|---:|---:|---:|
| Test command | 6.252 s | 3.538 s | **43.4% faster** |
| Publish command | 1.858 s | 0.767 s | **58.7% faster** |
| Explicit build | — | 3.861 s | new work |
| Combined compile/test/publish | 8.110 s | 8.166 s | **0.7% slower** |
| Instrumented pipeline | 56.840 s | 57.523 s | **1.2% slower** |
| GitHub job | 61.3 s | 63.0 s | **2.8% slower** |

The faster test and publish commands are not a net saving: compilation moved
into the explicit build step. The baseline already lets MSBuild reuse current
outputs within the same workspace.

Detailed results: `measurements/03-incremental-dotnet-build.md`.

## CI/CD timing: before vs after (Optimization 4 — parallel jobs)

Both workflows use identical jobs and image-artifact handoff. Only the job
dependency graph changes.

| Metric | Sequential control | Parallel jobs | Change |
|---|---:|---:|---:|
| Workflow wall time | 97.0 s | 64.0 s | **34.0% faster** |
| Test job | 20.278 s | 19.807 s | comparable |
| Image job | 47.861 s | 44.005 s | normal run variance |
| Deployment job | 12.044 s | 9.818 s | network variance |
| Peak runner concurrency | 1 | 2 | increased |
| Image size | 230,839,331 bytes | same | unchanged |

The reliable improvement is the 33-second reduction in elapsed time from
overlapping test and image work. Parallelism does not inherently reduce total
compute; observed compute differences include runner and network variation.
This dependency graph was promoted to the default pipeline after approval.
Pull requests do not deploy to EC2.

Detailed results: `measurements/04-parallel-jobs.md`.

## CI/CD timing: before vs after (Optimization 5 — artifact reuse)

The control rebuilds the validated image on the deployment runner. The
optimized workflow uploads and downloads the exact image built earlier.

| Metric | Rebuild in deploy job | Reuse artifact | Change |
|---|---:|---:|---:|
| Workflow wall time | 87.667 s | 64.333 s | **26.6% faster** |
| Total runner execution | 110.0 s | 87.0 s | **20.9% lower** |
| Duplicate rebuild | 22.035 s | — | eliminated |
| Artifact upload + download | — | 3.887 s | added |
| Image size | 230,839,331 bytes | same | unchanged |

Artifact reuse saved approximately 18.1 seconds versus rebuilding, before
checkout overhead and run variance. It also guarantees that deployment uses
the exact image produced by the validated build job. Artifact reuse remains in
the promoted pipeline.

Detailed results: `measurements/05-build-artifacts-between-jobs.md`.

## CI/CD timing: before vs after (Optimization 6 — multi-stage build)

The single-stage control retains the SDK, source, NuGet state, and build
outputs. The existing multi-stage Dockerfile copies only published output into
the runtime image.

| Metric | Single stage | Multi-stage | Change |
|---|---:|---:|---:|
| Final image | 867.9 MB | 230.8 MB | **73.4% smaller** |
| Compressed artifact | 364.0 MB | 101.6 MB | **72.1% smaller** |
| Docker build | 21.888 s | 19.530 s | **10.8% faster** |
| Archive creation | 15.729 s | 5.233 s | **66.7% faster** |
| EC2 transfer | 12.256 s | 4.286 s | **65.0% faster** |
| EC2 image load (median) | 14.887 s | 4.282 s | **71.2% faster** |
| Workflow wall time (median) | 138 s | 69 s | **50.0% faster** |

One single-stage artifact download was a large network outlier, so medians are
used for the end-to-end comparison. The multi-stage Dockerfile remains the
default; `Dockerfile.single-stage` is only a learning control.

Detailed results: `measurements/06-docker-multi-stage-build.md`.

## CI/CD timing: before vs after (Optimization 7 — layer ordering)

Each run populated a local Docker cache, changed only application source, then
measured the rebuild.

| Metric | Poor ordering | Manifest-first ordering | Change |
|---|---:|---:|---:|
| Source-change rebuild | 5.824 s | 4.316 s | **25.9% faster** |
| Cached steps | 4 | 8 | doubled |
| Restore after source change | 3 of 3 runs | 0 of 3 runs | eliminated |
| Image size | 230,839,331 bytes | same | unchanged |

Correct ordering copies dependency manifests and restores before copying
frequently changing source. Total experiment duration was affected by unrelated
first-build and network variation, so only the isolated rebuild is attributed
to layer ordering.

Detailed results: `measurements/07-docker-layer-ordering.md`.

## CI/CD timing: before vs after (Optimization 8 — path filtering)

A documentation-only push previously started the complete default pipeline,
including an unnecessary EC2 deployment. The same kind of commit was pushed
after adding application-focused `paths` filters.

| Metric for a docs-only commit | Before | After | Change |
|---|---:|---:|---:|
| Workflow wall time | 71 s | 0 s | **100% avoided** |
| Total runner execution | 90 s | 0 s | **100% avoided** |
| Image builds | 1 | 0 | eliminated |
| EC2 deployments | 1 | 0 | eliminated |

Relevant source and build-input changes still start the full pipeline. A
separate manual dispatch succeeded, proving deliberate runs remain available.
Path filters must be maintained as the project changes and require care when a
filtered workflow is configured as a required branch-protection check.

Detailed results: `measurements/08-path-filtering.md`.

## CI/CD timing: before vs after (Optimization 9 — concurrency control)

Two same-ref workflows were dispatched rapidly. Before concurrency control,
both completed and both deployed. After adding a branch-specific concurrency
group, GitHub cancelled the older run and only the newer run successfully
deployed.

| Metric for two overlapping runs | Before | After | Change |
|---|---:|---:|---:|
| Pair elapsed time | 74 s | 156 s | **82 s slower** |
| Total runner execution | 182 s | 180 s | **1.1% lower** |
| Completed image builds | 2 | 2 | unchanged |
| Successful EC2 deployments | 2 | 1 | **duplicate prevented** |

Cancellation occurred late, after the older run had built its image, so this
sample saved almost no compute and queueing increased elapsed time. An
uncontended pipeline still completed normally in 72 seconds. The setting is
retained for deployment correctness: obsolete same-branch runs should not be
allowed to complete after newer runs.

Detailed results: `measurements/09-concurrency-control.md`.

## CI/CD timing: before vs after (Optimization 10 — runner sizing)

The lightweight test job was compared on the free public-repository
`ubuntu-latest` runner (4 vCPU, 16 GB) and `ubuntu-slim` runner (1 vCPU, 5 GB).
Image and deployment jobs were unchanged.

| Three-run average | `ubuntu-latest` | `ubuntu-slim` | Change |
|---|---:|---:|---:|
| Workflow wall time | 76.0 s | 88.3 s | **16.2% slower** |
| Total runner execution | 93.0 s | 128.3 s | **38.0% higher** |
| Test job | 24.0 s | 57.3 s | **138.9% slower** |
| Estimated allocated test CPU capacity | 96 vCPU-s | 57.3 vCPU-s | **40.3% lower** |
| Actual Actions cost | $0 | $0 | unchanged |

The slim runner reduced allocated capacity but provided no cost saving and
occasionally extended the critical path. It was not promoted; automatic runs
retain `ubuntu-latest`. A manual runner selector remains for learning.

Detailed results: `measurements/10-right-sized-runners.md`.

## CI/CD timing: before vs after (Optimization 11 — test parallelization)

The three-test suite was compared as one test job and as two parallel matrix
jobs split by test class. No artificial delays were added.

| Three-run average | Single job | Two shards | Change |
|---|---:|---:|---:|
| Workflow wall time | 75.3 s | 73.0 s | 3.1% lower, unrelated path variance |
| Test-stage elapsed time | 22.3 s | 25.7 s | **14.9% slower** |
| Test-runner execution | 22.3 s | 49.0 s | **119.4% higher** |
| Critical test command | 4.7 s | 6.0 s | **28.6% slower** |

The image/deployment path determined end-to-end time, so its variance cannot
be credited to test sharding. Duplicate runner setup, restore, compilation,
and discovery outweighed parallel execution of millisecond-scale tests.
Single-job testing remains the default; sharding remains a manual control.

Detailed results: `measurements/11-test-parallelization.md`.

Future optimizations will get their own rows here and files under
`measurements/`.

---

## What affects dependency caching in CI/CD

Caching helps only when:

```text
(time saved on restore/build) > (time to restore cache archive + any extra work)
```

It is **not** determined by dependency size alone.

### Factors that tend to **help**

| Factor | Why |
|---|---|
| **Large dependency graph** | Many or heavy packages (SDKs, ML wheels, Android/Gradle deps) → long uncached downloads |
| **Slow or private registry** | High latency, rate limits, or VPN-only feeds → cache avoids repeated fetches |
| **Stable dependency keys** | Infrequent changes to lock files / `.csproj` / config → high **cache hit rate** |
| **Ephemeral hosted runners** | Fresh VM every job; no local `~/.nuget` unless you cache |
| **Small cache artifact vs huge download** | Compressed cache smaller/faster than re-pulling everything |
| **Stack stores restorable blobs** | NuGet global-packages, npm cache, Maven `.m2`, etc. map well to `actions/cache` |

### Factors that tend **not** to help (or hurt)

| Factor | Why |
|---|---|
| **Few small packages** (this lab) | Restore already ~4 s; ~40 MB cache + decompress ~2 s → net loss |
| **Fast public feeds** (e.g. NuGet.org from GitHub-hosted runners) | Network download cheap relative to cache I/O |
| **Frequent dependency changes** | New cache key every commit → misses + upload overhead |
| **Cache miss on every run** | Pay lookup + save without warm benefit |
| **Many small files in cache** | Tar/compress/extract overhead grows |
| **Self-hosted runner with persistent disk** | Packages already on disk; remote GitHub cache duplicates work |
| **Wrong cache path or key** | Restores nothing useful or wrong versions |
| **PR/untrusted jobs** | Read-only or no cache write; limited benefit |
| **Only measuring `dotnet restore`** | Ignores cache download—can look “fast” while job gets slower |

### Stack and language (same idea, different mechanics)

| Ecosystem | What is usually cached | Notes |
|---|---|---|
| **.NET / NuGet** | `~/.nuget/packages` | `setup-dotnet` cache often wants `packages.lock.json`; we used `actions/cache` + project hash |
| **Node / npm** | npm cache dir | `node_modules` caching is separate; lockfile drives key |
| **Java / Maven** | `~/.m2/repository` | Large transitive trees often benefit |
| **Python / pip** | Wheel cache | Large wheels (CUDA, ML) often benefit |
| **Go** | Module + build cache | Module download vs compile cache differ |
| **Docker** | Layer/build cache | Different topic (BuildKit); not the same as NuGet cache |

### How we measured fairly

- One optimization at a time; baseline workflow preserved.
- Cold cache (miss + save) vs warm cache (hit) reported separately.
- Same runner OS, pinned SDK (`global.json`), same Docker `--no-cache` for apples-to-apples on restore.
- Repeat runs; compare median/average, not a single run.

---

## Local validation

**.NET 11 SDK:**

```powershell
dotnet restore MultiProjectApp.slnx
dotnet test MultiProjectApp.slnx --no-restore
dotnet publish MultiProjectApp/MultiProjectApp.csproj --no-restore -c Release
```

**Docker:**

```powershell
docker build --target test -t dotnet-optimization-tests .
docker run --rm dotnet-optimization-tests
docker build -t dotnet-optimization-app .
docker run --rm dotnet-optimization-app
```

Local Docker cold/warm numbers: `BASELINE.md`.
