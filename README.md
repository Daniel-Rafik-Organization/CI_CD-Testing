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
| `project4-baseline.yml` | Unoptimized CI/CD (no NuGet cache, Docker `--no-cache`) |
| `project4-nuget-cache.yml` | Optimization 1: NuGet `~/.nuget/packages` cache via `actions/cache@v6` |
| `project4-buildkit-cache.yml` | Optimization 2: BuildKit layer cache via GitHub Actions cache |

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
