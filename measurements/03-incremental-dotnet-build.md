# Optimization 3: Incremental .NET build reuse

## Change

The baseline runs:

1. `dotnet test --no-restore`, which builds tests and referenced libraries.
2. `dotnet publish --no-restore`, which builds and publishes the application.

The experiment runs:

1. `dotnet build` for the complete solution once.
2. `dotnet test --no-build --no-restore`.
3. `dotnet publish --no-build --no-restore`.

The intention is to compile once and reuse the existing Release outputs during
test and publish. No cross-run `bin` or `obj` cache was introduced. NuGet and
BuildKit caches remained disabled, Docker used `--no-cache`, and EC2 deployment
was unchanged.

The baseline is preserved in `project4-baseline.yml`. The experiment is
preserved in `project4-incremental-build.yml` and is manually triggered.

## Same-commit baseline control

- Run: https://github.com/Daniel-Rafik-Organization/CI_CD-Testing/actions/runs/39135614560
- GitHub job duration: 67 s.
- Instrumented pipeline duration: 61.763 s.
- Test, including its required build: 6.367 s.
- Publish, including its required build work: 1.923 s.
- Combined test and publish: 8.290 s.
- Docker build: 18.738 s.
- Tests and EC2 smoke test: passed.

The original three-run baseline averages were:

- GitHub job duration: 61.3 s.
- Instrumented pipeline duration: 56.840 s.
- Test: 6.252 s.
- Publish: 1.858 s.
- Combined test and publish: 8.110 s.

## Experiment runs

- Run 1: https://github.com/Daniel-Rafik-Organization/CI_CD-Testing/actions/runs/39135727194
- Run 2: https://github.com/Daniel-Rafik-Organization/CI_CD-Testing/actions/runs/39135832063
- Run 3: https://github.com/Daniel-Rafik-Organization/CI_CD-Testing/actions/runs/39135924215
- Run 4: https://github.com/Daniel-Rafik-Organization/CI_CD-Testing/actions/runs/39136019613

Four-run averages:

- Explicit solution build: 3.861 s.
- Test existing outputs: 3.538 s.
- Publish existing outputs: 0.767 s.
- Sum of build, test, and publish steps: 8.166 s.
- Measured build-to-publish flow, including step boundaries: 8.328 s.
- Instrumented pipeline duration: 57.523 s.
- GitHub job duration: 63.0 s.
- NuGet restore: 4.152 s.
- Docker build: 19.429 s.
- Image archive creation: 5.106 s.
- Image transfer to EC2: 5.338 s.
- EC2 image load: 4.300 s.
- EC2 smoke test: 0.391 s.
- Image size: 230,839,331 bytes, unchanged.
- Test result: 3 passed, unchanged.

## Result

Compared with the original three-run averages:

- The test command itself improved by 2.714 s, or 43.4%.
- The publish command itself improved by 1.091 s, or 58.7%.
- The new explicit build added 3.861 s.
- Combined build, test, and publish was 0.056 s, or 0.7%, slower.
- Including step boundaries, the compile flow was 0.218 s, or 2.7%, slower.
- The instrumented pipeline was 0.683 s, or 1.2%, slower.
- The GitHub job was 1.7 s, or 2.8%, slower.

Compared with the same-commit control, compile-flow time was effectively
unchanged: 8.290 s before and 8.328 s after, a 0.5% slowdown. The optimized
pipeline appeared 4.240 s faster overall, but unrelated Docker and network
variation dominates that difference, so it cannot be attributed to the
incremental build change.

The baseline is already reasonably incremental inside one workspace:
`dotnet test` builds the tests and libraries, and the subsequent publish can
reuse outputs that MSBuild considers current. An explicit solution build shifts
the compilation work into a new step but does not remove enough work to offset
that step for this small solution.

All builds, tests, immutable image transfers, and EC2 smoke tests succeeded.
No additional paid service was used.

## Recommendation

Do not promote this structure for speed in this project. Keep the manual
workflow as a reproducible example.

Build-once reuse becomes more valuable when many later operations consume the
same compiled output—for example multiple test suites, packaging, signing, or
several publish operations. Cross-run caching of `bin` and `obj` should remain
a separate experiment because those outputs are sensitive to SDK, platform,
compiler options, source state, and timestamps.
