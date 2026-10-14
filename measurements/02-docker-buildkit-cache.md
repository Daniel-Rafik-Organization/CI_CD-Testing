# Optimization 2: Docker BuildKit cache

## Change

The optimized workflow uses:

- `docker/setup-buildx-action@v4`
- `docker/build-push-action@v7`
- `cache-from: type=gha,scope=project4-app`
- `cache-to: type=gha,scope=project4-app,mode=max`

`mode=max` exports both final-image and intermediate multi-stage layers. The
image is still loaded locally, archived, transferred to EC2, loaded there, and
smoke-tested. Host NuGet caching remains disabled and Docker behavior outside
the cache experiment remains unchanged.

The original workflow is preserved in `project4-baseline.yml`. The experiment
is preserved in `project4-buildkit-cache.yml` and is manually triggered.

## Same-commit baseline control

- Run: https://github.com/Daniel-Rafik-Organization/CI_CD-Testing/actions/runs/38587474903
- GitHub job duration: 64 s.
- Instrumented pipeline duration: 59.424 s.
- Uncached Docker build: 19.610 s.
- Tests: 5.756 s.
- Image size: 230,839,331 bytes.
- EC2 smoke test: passed.

The original three-run baseline averages were 61.3 s for the GitHub job,
56.840 s for the instrumented pipeline, and 20.958 s for the uncached Docker
build.

## Cold-cache result

- Run: https://github.com/Daniel-Rafik-Organization/CI_CD-Testing/actions/runs/38587668927
- Reused Dockerfile steps: 0.
- Buildx setup: 7.579 s.
- Build, image load, and cache export: 74.149 s.
- Cache export alone reported 54.5 s.
- Instrumented pipeline duration: 121.069 s.
- GitHub job duration: 129 s.
- Image size: 230,839,331 bytes.
- Tests and EC2 smoke test: passed.

The cold run was expected to be slower because it created and uploaded the
initial `mode=max` cache, including large SDK and runtime layers.

## Warm-cache results

- Run 1: https://github.com/Daniel-Rafik-Organization/CI_CD-Testing/actions/runs/38588103632
- Run 2: https://github.com/Daniel-Rafik-Organization/CI_CD-Testing/actions/runs/38588272628
- Run 3: https://github.com/Daniel-Rafik-Organization/CI_CD-Testing/actions/runs/38588434014

Warm-run averages:

- Reused Dockerfile steps: 13.7 of 14 eligible steps.
- Buildx setup: 8.918 s.
- Cached build, cache import/export, and local image load: 10.579 s.
- Combined Buildx setup and cached build: 19.497 s.
- Instrumented pipeline duration: 53.185 s.
- GitHub job duration: 59.0 s.
- Host NuGet restore: 3.721 s.
- Tests: 5.250 s.
- Application publish: 1.472 s.
- Image archive creation: 5.464 s.
- Image transfer to EC2: 3.033 s.
- EC2 image load: 4.304 s.
- EC2 smoke test: 0.381 s.
- Image size: 230,839,331 bytes, unchanged.
- Test result: 3 passed, unchanged.

## Result

Compared with the original three-run averages:

- The Docker build action improved by 10.379 s, or 49.5%.
- After including Buildx setup, the Docker portion improved by 1.461 s, or
  7.0%.
- The instrumented pipeline improved by 3.655 s, or 6.4%.
- The GitHub job improved by 2.3 s, or 3.8%.

Compared with the same-commit control:

- The Docker build action improved by 9.031 s, or 46.1%.
- Buildx setup plus cached build improved by only 0.113 s, or 0.6%.
- The instrumented pipeline improved by 6.239 s, or 10.5%.
- The GitHub job improved by 5 s, or 7.8%.

The full-pipeline difference includes normal runner, registry, archive, and
network variation. The strongest isolated conclusion is that layer reuse
roughly halved build-action time, but fresh Buildx setup consumed most of that
saving for this small image.

All builds, tests, immutable image transfers, and EC2 smoke tests succeeded.
No additional paid service was used.

## Recommendation

Keep the manual BuildKit-cache workflow as a successful learning example.
Promoting it solely for speed is marginal for this small project because
Buildx setup nearly cancels the saved build work. It becomes more valuable for
larger or slower multi-stage builds, and when Buildx setup is amortized across
multiple images or build operations in one job.
