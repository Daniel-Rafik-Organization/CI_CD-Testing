# Lab measurements (Docker-focused)

From Project 4 `.NET MultiProjectApp` in `Daniel-Rafik-Organization/CI_CD-Testing`.

## Multi-stage (topic 6)

| Metric | Single stage | Multi-stage |
|---|---:|---:|
| Final image | 867.9 MB | 230.8 MB |
| Compressed artifact | 364.0 MB | 101.6 MB |
| EC2 transfer (avg) | 12.3 s | 4.3 s |
| EC2 load (median) | 14.9 s | 4.3 s |

## Layer ordering (topic 7)

| Metric | Poor order | Manifest-first |
|---|---:|---:|
| Rebuild after source-only change | 5.82 s | 4.32 s |
| Restore reran | 3/3 | 0/3 |

Control file: `Dockerfile.bad-order`.

## BuildKit cache (topic 2)

| Metric | No GHA cache | Warm GHA cache |
|---|---:|---:|
| Docker build step | ~21 s | ~10.6 s |
| Pipeline (instrumented) | ~56.8 s | ~53.2 s |

Cold run with cache export: ~129 s job (outlier).

## Image handoff (topics 5 + 12)

- Rebuild on deploy job vs artifact reuse: **87.7 s → 64.3 s** wall (~26.6%).
- Archive SHA-256 verify on EC2: ~**1.08 s** combined overhead.
- Docker `image ID` mismatch across runner vs EC2 Docker 29 — use archive hash or registry digest.

Workflow reference: `project4-jobs-parallel.yml`, measurements `02`, `05`, `06`, `07`, `12`.
