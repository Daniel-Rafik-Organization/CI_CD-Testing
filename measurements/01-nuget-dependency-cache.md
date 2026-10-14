# Optimization 1: NuGet dependency caching

## Change

The optimized workflow restores `~/.nuget/packages` with
`actions/cache@v6`. Its cache key hashes all project files,
`Directory.Build.props`, and `NuGet.config`. Docker remains configured with
`--no-cache`; test, publish, image transfer, and EC2 deployment behavior are
unchanged.

The baseline workflow is preserved in `project4-baseline.yml`. The experiment
is preserved in `project4-nuget-cache.yml` and is manually triggered.

## Baseline

The original three-run baseline averages were:

- GitHub job duration: 61.3 s.
- Instrumented pipeline duration: 56.840 s.
- NuGet restore: 4.278 s.

## Cold-cache result

- Run: https://github.com/Daniel-Rafik-Organization/CI_CD-Testing/actions/runs/38547400271
- Cache result: miss.
- Cache lookup: 0.433 s.
- NuGet restore: 3.741 s.
- Instrumented pipeline duration: 59.205 s.
- GitHub job duration: 66 s.
- Saved cache archive: 40,021,807 bytes.

## Warm-cache results

- Run 1: https://github.com/Daniel-Rafik-Organization/CI_CD-Testing/actions/runs/38547615016
- Run 2: https://github.com/Daniel-Rafik-Organization/CI_CD-Testing/actions/runs/38547764444
- Run 3: https://github.com/Daniel-Rafik-Organization/CI_CD-Testing/actions/runs/38547906669

All three runs reported an exact cache hit.

Warm-run averages:

- Cache download/restore action: 2.084 s.
- NuGet restore: 2.757 s.
- Combined cache action and NuGet restore: 4.841 s.
- Instrumented pipeline duration: 59.354 s.
- GitHub job duration: 65.3 s.
- Tests: 6.106 s.
- Docker build: 19.308 s.
- Image transfer to EC2: 6.020 s.
- EC2 image load: 4.471 s.
- EC2 smoke test: 0.398 s.
- Image size: 230,839,331 bytes, unchanged.
- Test result: 3 passed, unchanged.

## Result

The NuGet restore command improved by 1.521 s, or 35.6%. However, downloading
the package cache added 2.084 s. Cache download plus restore was 0.563 s, or
13.2%, slower than the uncached restore baseline.

The average instrumented pipeline was 2.514 s, or 4.4%, slower. The average
GitHub job was 4.0 s, or 6.5%, slower. Network variability in Docker pulls and
EC2 transfers also affected total duration, but the isolated cache-plus-restore
measurement shows that this cache does not pay for itself for the sample's
small dependency set.

No functional regressions occurred. All builds, tests, immutable image
transfers, and EC2 smoke tests succeeded. The experiment used no additional
paid service.

## Recommendation

Do not promote NuGet caching to the default workflow for this project in its
current form. Keep the manual optimized workflow as a reproducible learning
example. Re-evaluate caching if the dependency graph or restore time grows.
