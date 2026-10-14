# Baseline measurements

Environment observed on 2026-10-13:

- Host: Windows 10.0.26200
- Git: 2.56.0.windows.2
- Docker client/server: 29.8.2
- Docker Buildx: 0.37.2
- BuildKit: 0.33.1 using Docker Desktop's Linux engine
- Builder resources: 12 CPUs, 8,131,325,952 bytes memory
- Builder platform: Linux x86_64 with overlayfs
- Host .NET SDK: unavailable
- Container SDK: .NET 11.0.100-rc.1.26425.128
- SDK/runtime base-image tags: `11.0`

The baseline uses the unmodified upstream Dockerfile. Cold builds used
`--no-cache`; warm builds immediately repeated the same build with BuildKit
cache enabled. The first cold build also downloaded the .NET SDK image, so its
duration includes network and image extraction time. The application cold
build ran after the base images were already present.

| Metric | Cold baseline | Warm baseline | Notes |
|---|---:|---:|---|
| Total local validation duration | 244.130 s | 6.191 s | Test build/run + app build/run, calculated |
| Test-image build duration | 224.229 s | 1.561 s | Cold includes initial SDK image pull |
| Application-image build duration | 13.750 s | 1.591 s | Base images already local |
| Application dependency restore step | 2.4 s | Cached | BuildKit step timing |
| Test dependency restore step | 17.8 s | Cached | BuildKit step timing |
| Eligible cached build steps | 0 | 29 | 15 test-image + 14 app-image steps |
| Test container wall time | 5.205 s | 2.267 s | Includes container startup |
| Test framework duration | 21 ms | 19 ms | 3 passed, 0 failed |
| Application container wall time | 0.946 s | 0.772 s | Output validated |
| Application image size | 347,810,675 bytes | Same | Docker image content size |
| Test image size | 1,398,607,190 bytes | Same | SDK and test dependencies included |
| EC2 resource usage | Not measured | Not measured | EC2 not configured |
| GitHub runner cost | Not measured | Not measured | Workflow not created |
| Local infrastructure cost | $0 | $0 | Existing local machine |

These are actual local measurements except for the calculated total. They are
not yet GitHub Actions or EC2 measurements and should not be used to estimate
runner billing.

## Validation results

- Test result: 3 passed, 0 failed, 0 skipped.
- Application output matched the expected original and reversed strings.
- Warm test and application builds reused every eligible Dockerfile step.
- The upstream .NET 11 image is currently an RC build and emits `NETSDK1057`.

## GitHub Actions and EC2 baseline

Three successful runs measured commit
`6dee7fc7e64e811d216b9092469d928dae9ad490` with NuGet caches cleared and
Docker `--no-cache` enabled:

- Run 1: https://github.com/Daniel-Rafik-Organization/CI_CD-Testing/actions/runs/38545461317
- Run 2: https://github.com/Daniel-Rafik-Organization/CI_CD-Testing/actions/runs/38545658166
- Run 3: https://github.com/Daniel-Rafik-Organization/CI_CD-Testing/actions/runs/38545878165

Measured results:

- GitHub job duration: 64 s, 60 s, 60 s; average 61.3 s.
- Instrumented pipeline duration: 57.117 s, 57.413 s, 55.991 s; average
  56.840 s and median 57.117 s.
- NuGet restore: average 4.278 s; median 4.264 s.
- Tests: average 6.252 s; median 6.229 s; all three tests passed each run.
- Application publish: average 1.858 s; median 1.861 s.
- Uncached Docker build: average 20.958 s; median 21.955 s.
- Image archive creation: average 5.238 s; median 5.247 s.
- Transfer to EC2: average 3.563 s; median 2.454 s. Run 1 was a 6.190 s
  network outlier.
- EC2 image load: average 4.343 s; median 4.434 s.
- EC2 smoke-test execution: average 0.420 s; median 0.417 s.
- Docker image size: 230,839,331 bytes.
- Compressed transfer size: average 101,585,744 bytes.
- EC2 target: Ubuntu 26.04 x86-64, 2 CPUs, 1.9 GiB RAM, and 16 GiB free
  disk before deployment.
- EC2 CPU and memory consumption during the short-lived smoke test were not
  measured.
- GitHub-hosted runner cost: $0 for this public repository.
- Additional infrastructure cost: $0; the existing EC2 instance was used.

These runs form the original GitHub Actions baseline. The workflow deploys
only trusted `main` or manually dispatched commits. Pull requests run CI on
GitHub-hosted runners and cannot reach EC2.

For comparable runs, keep source, base-image digest, builder, platform, and
runner size fixed. Record cold-cache and warm-cache runs separately and repeat
timed runs where practical.
