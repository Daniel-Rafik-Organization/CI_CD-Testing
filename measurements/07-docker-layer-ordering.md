# Optimization 7: Docker layer ordering

## Experimental design

The upstream Dockerfile was already correctly ordered, so
`Dockerfile.bad-order` provides a deliberate regression.

The poor-order control copies all relevant source before `dotnet restore`.
A source change therefore changes the restore step's parent filesystem and
invalidates restore.

The optimized Dockerfile copies dependency manifests first, restores, and only
then copies source. A source-only change preserves the restore layer.

Each isolated run:

1. Builds once to populate the runner's local BuildKit cache.
2. Adds a harmless C# comment in the temporary runner workspace.
3. Rebuilds using the same local cache.
4. Counts cached steps and detects whether restore executed.
5. Validates, transfers, and smoke-tests the rebuilt image on EC2.

The temporary source comment is never committed. NuGet and remote BuildKit
caches are disabled; only the local cache produced by the first build is used.

## Poor-order runs

- Run 1: https://github.com/Daniel-Rafik-Organization/CI_CD-Testing/actions/runs/39394605013
- Run 2: https://github.com/Daniel-Rafik-Organization/CI_CD-Testing/actions/runs/39394792482
- Run 3: https://github.com/Daniel-Rafik-Organization/CI_CD-Testing/actions/runs/39394932507

Three-run results:

- Source-change rebuild: 5.824 s average; 5.708 s median.
- Cached steps: 4 each run.
- `dotnet restore` reran: yes, every run.
- Cache-populating build: 19.504 s average.
- Total experiment: 59.590 s average.
- Image size: 230,839,331 bytes.
- Compressed archive: approximately 101,590,145 bytes.
- EC2 transfer: 5.389 s average.
- EC2 image load: 4.711 s average.
- EC2 smoke test: 0.447 s average.

## Optimized-order runs

- Run 1: https://github.com/Daniel-Rafik-Organization/CI_CD-Testing/actions/runs/39395119906
- Run 2: https://github.com/Daniel-Rafik-Organization/CI_CD-Testing/actions/runs/39395324173
- Run 3: https://github.com/Daniel-Rafik-Organization/CI_CD-Testing/actions/runs/39395479355

Three-run results:

- Source-change rebuild: 4.316 s average; 4.023 s median.
- Cached steps: 8 each run.
- `dotnet restore` reran: no.
- Cache-populating build: 24.970 s average.
- Total experiment: 67.933 s average.
- Image size: 230,839,331 bytes.
- Compressed archive: approximately 101,592,622 bytes.
- EC2 transfer: 6.211 s average.
- EC2 image load: 5.627 s average.
- EC2 smoke test: 0.420 s average.

## Result

- Correct ordering doubled reused steps from 4 to 8.
- Restore executions after source-only changes decreased from 3 of 3 to 0 of
  3.
- Source-change rebuild improved by 1.508 s, or 25.9%.
- Image size and application behavior were unchanged.
- All tests, image validations, transfers, deployments, and smoke tests
  succeeded.
- GitHub-hosted runner cost remained $0 for this public repository.

The optimized runs had slower average cache-populating builds and total
experiment duration because of runner, base-image, and network variation,
including a slow first optimized run. Those phases occur before or after the
controlled source-change rebuild and must not be attributed to layer ordering.
The isolated second build is the relevant measurement.

The sample's application restore is small, so the absolute saving is only
about 1.5 seconds. A larger dependency graph or slower package source would
increase the cost of an invalidated restore.

## Recommendation

Retain the existing manifest-first ordering:

1. Copy dependency/build manifests.
2. Restore dependencies.
3. Copy frequently changing source.
4. Compile or publish.

Keep `Dockerfile.bad-order` only as a manual learning control.
