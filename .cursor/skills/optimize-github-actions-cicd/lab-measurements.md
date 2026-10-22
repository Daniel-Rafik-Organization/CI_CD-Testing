# Lab measurements (Project 4)

Source repository: `Daniel-Rafik-Organization/CI_CD-Testing` (local clone often named `project4-dotnet-optimization-lab`).

| Topic | Promoted? | Headline result |
|---|---|---|
| NuGet cache | No | Restore command faster; pipeline slower on small graph |
| BuildKit cache | Manual workflow | ~50% faster docker build step warm; cold export costly |
| Incremental .NET build | No | No net win when workspace already reuses outputs |
| Parallel jobs | Yes | ~34% wall time |
| Artifacts | Yes | ~27% wall vs redeploy rebuild |
| Multi-stage | Yes (Dockerfile skill) | ~73% smaller image; large transfer savings |
| Layer order | Yes (Dockerfile skill) | ~26% faster source-only rebuild |
| Path filters | Yes | 100% skip for docs-only |
| Concurrency | Yes | Prevents stale deploy; minimal compute savings |
| Runner sizing | No | Slim runner slower |
| Test sharding | No | Overhead >> ms tests |
| Image reuse + digest | Yes | ~27% vs rebuild; ~1 s verify overhead |

Full markdown: `measurements/01` through `12` in the lab repo README.
