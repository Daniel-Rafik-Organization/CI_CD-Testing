# Baseline measurements

Environment observed on 2026-10-12:

- Host: Windows 10.0.26200
- Git: 2.56.0.windows.2
- Docker CLI: 29.8.2
- Docker Buildx: 0.37.2
- Docker daemon: unavailable (Docker Desktop Linux engine was not running)
- Host .NET SDK: unavailable

No timing or image-size result is reported until a build actually succeeds.

| Metric | Cold baseline | Warm baseline | Status |
|---|---:|---:|---|
| Total validation duration | — | — | Not measured |
| Docker build duration | — | — | Not measured |
| Dependency restore duration | — | — | Not measured |
| Cache hits/misses | — | — | Not measured |
| Test duration | — | — | Not measured |
| Image size | — | — | Not measured |
| Host resource usage | — | — | Not measured |
| Infrastructure cost | $0 | $0 | Local preparation only |

For comparable runs, keep source, base-image digest, builder, platform, and
runner size fixed. Record cold-cache and warm-cache runs separately and repeat
timed runs where practical.
