---
name: optimize-dockerfile
description: Optimizes Dockerfiles and CI Docker build steps using multi-stage builds, layer ordering, BuildKit cache import/export, and smaller runtime images. Use when the user mentions Dockerfile, docker build, BuildKit, container image size, layer cache, or pairing Docker builds with GitHub Actions.
---

# Optimize Dockerfile and container builds

Apply Dockerfile changes **separately** from generic CI graph tuning (use `optimize-github-actions-cicd` for job parallelism, path filters, and artifacts).

Measure **cold** vs **warm** builds; layer ordering experiments need a controlled source-only change after a warm cache.

## 1. Inspect before editing

| Check | Action |
|---|---|
| Base image tags | Prefer immutable digests or frequently rebuilt tags for production |
| Build context | Add `.dockerignore` to exclude `.git`, tests, docs, local artifacts |
| Single vs multi-stage | SDK/build tools should not ship in runtime image |
| Dependency vs app layers | Manifests copied before source |
| CI integration | `docker/build-push-action` + BuildKit vs plain `docker build` |

Read existing `Dockerfile`, `docker-compose`, and CI job that builds the image.

## 2. Multi-stage builds

**Use when:** compile-time tooling (SDK, Node devDependencies, headers) is not needed at runtime.

**Lab (.NET sample):** single stage **867.9 MB** → multi-stage **230.8 MB** (~**73%** smaller); compressed artifact ~**72%** smaller; median workflow ~**50%** faster end-to-end due to transfer/load.

**Pattern:**

```dockerfile
FROM mcr.microsoft.com/dotnet/sdk:11.0 AS build
WORKDIR /src
COPY *.sln* *.props *.config ./
COPY ProjectDir/*.csproj ./ProjectDir/
RUN dotnet restore
COPY . .
RUN dotnet publish ProjectDir/ProjectDir.csproj -c Release -o /app/publish

FROM mcr.microsoft.com/dotnet/runtime:11.0 AS final
WORKDIR /app
COPY --from=build /app/publish .
ENTRYPOINT ["dotnet", "ProjectDir.dll"]
```

Adapt stages for Node (build assets → nginx/alpine), Go (static binary in `scratch`/`distroless`), Python (wheel build → slim runtime).

**Anti-pattern:** one stage that keeps SDK, source, and `node_modules` in the shipped image.

## 3. Layer ordering (cache-friendly)

Order layers from **least frequent** to **most frequent** change:

1. OS packages / runtime base
2. Dependency manifests only (`package*.json`, `*.csproj`, `go.mod`, `requirements.txt`)
3. Dependency install (`npm ci`, `dotnet restore`, `pip install`)
4. Application source
5. Compile / publish

**Lab:** copying all source before `dotnet restore` invalidated restore on every source edit; manifest-first ordering cut source-only rebuild ~**26%** and doubled cached steps.

**Rules:**

- Never `COPY . .` before dependency install unless the dependency step truly needs full tree.
- Pin tool versions in base image or early layer.
- Combine rarely changed RUN instructions to reduce layer count, but do not merge manifest and source copies.

## 4. BuildKit cache in CI

**Use when:** Docker build is a recurring cost and layers are reused across commits (warm cache).

**Lab:** docker build action ~**50%** faster warm; first cold cache export ~**54 s** penalty; Buildx setup ~**9 s** on ephemeral runners.

**GitHub Actions pattern (conceptual):**

```yaml
- uses: docker/setup-buildx-action@v3
- uses: docker/build-push-action@v6
  with:
    context: .
    push: false
    tags: app:${{ github.sha }}
    cache-from: type=gha
    cache-to: type=gha,mode=max
```

**Notes:**

- `mode=max` exports more layers; larger cache artifact, better hit rate.
- On public repos, GHA cache is convenient; for production, consider registry cache (`type=registry`) for sharing across branches.
- Plain `docker build --no-cache` in CI defeats layer reuse unless intentional baseline.

## 5. CI coupling (without rewriting full pipeline)

When a workflow builds once and deploys elsewhere:

- Build and test image in **build-image** job; pass via **artifact** or **registry**, not rebuild on deploy (lab: ~**22 s** saved).
- Record **archive SHA-256** after `docker save | gzip`; verify on target before `docker load`.
- Do **not** rely on `docker image inspect .Id` matching across Docker Engine 29 **containerd** store vs legacy graph driver — IDs can differ for the same tarball ([docker/cli#6670](https://github.com/docker/cli/issues/6670)). Use digest of transported bytes or registry manifest digest.

## 6. Runtime image hygiene

- Run as non-root when possible (`USER`).
- No secrets in layers; use runtime env or orchestrator secrets.
- Minimal runtime base (`*-slim`, `distroless`, Alpine only if compatible).
- One process per container unless the platform requires otherwise.

## 7. When not to over-optimize Dockerfile

- Tiny images with no Docker in CI (serverless zip deploy).
- Generated Dockerfiles from framework (`pack`, `jib`) — tune the builder instead.
- Local-only dev Compose files — keep production Dockerfile strict.

## 8. Validation checklist

- [ ] `docker build` succeeds locally and in CI
- [ ] Image size reported (`docker image inspect --format '{{.Size}}'`)
- [ ] Source-only change rebuild reuses dependency layers (build log shows CACHED)
- [ ] Container starts and health/smoke check passes
- [ ] `.dockerignore` excludes irrelevant context

## 9. Agent deliverables

When applying this skill:

1. Before/after Dockerfile hunks with rationale per layer.
2. Whether multi-stage, ordering, or BuildKit cache applies to **this** project.
3. Expected cold vs warm behavior.
4. CI snippet changes only if needed for BuildKit or build-args.
5. Explicit “not worth it” cases.

## Reference

Lab numbers and controls: [lab-measurements.md](lab-measurements.md). Example Dockerfiles in the lab repo: `Dockerfile`, `Dockerfile.single-stage`, `Dockerfile.bad-order`.
