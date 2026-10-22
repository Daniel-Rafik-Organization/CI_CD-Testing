# Optimization 11: test parallelization

## Purpose

Test parallelization reduces feedback time when a suite contains enough
independent, expensive tests to outweigh runner startup, checkout, SDK setup,
dependency restore, discovery, and test-host overhead.

This sample contains only three very fast xUnit tests in two classes. xUnit
already permits classes in separate test collections to run concurrently
inside one process. The experiment therefore tested CI-level sharding without
adding artificial delays or fake workload:

- Single mode: one test job runs all three tests.
- Sharded mode: two parallel matrix jobs, one class per runner.

The Docker image and deployment jobs were unchanged. Deployment waited for
the entire test matrix.

## Configuration

Before, the workflow had one test job and no matrix. The experiment added a
dynamic matrix:

```yaml
strategy:
  fail-fast: false
  matrix:
    shard: ${{ fromJSON(inputs.test_mode == 'sharded' && '["string-library","string-utils"]' || '["all"]') }}
```

Single mode resolves to `["all"]`; sharded mode resolves to
`["string-library","string-utils"]`. Each named shard uses a fully qualified
name filter. Automatic push and pull-request runs continue to use single mode.

## Single-job control

- https://github.com/Daniel-Rafik-Organization/CI_CD-Testing/actions/runs/39758161155
- https://github.com/Daniel-Rafik-Organization/CI_CD-Testing/actions/runs/39758359319
- https://github.com/Daniel-Rafik-Organization/CI_CD-Testing/actions/runs/39758515072

Three-run averages:

- Workflow wall time: 75.3 seconds.
- Total runner execution: 91.0 seconds.
- Test-stage elapsed time: 22.3 seconds.
- Test-runner execution: 22.3 seconds.
- Test command: 4.7 seconds.

## Two-shard candidate

- https://github.com/Daniel-Rafik-Organization/CI_CD-Testing/actions/runs/39758689956
- https://github.com/Daniel-Rafik-Organization/CI_CD-Testing/actions/runs/39758880343
- https://github.com/Daniel-Rafik-Organization/CI_CD-Testing/actions/runs/39759037846

Three-run averages:

- Workflow wall time: 73.0 seconds.
- Total runner execution: 115.7 seconds.
- Parallel test-stage elapsed time: 25.7 seconds.
- Combined test-runner execution: 49.0 seconds.
- Critical shard's test command: 6.0 seconds.
- Sum of both test commands: 11.3 seconds.

Log validation showed that the filters covered the complete suite:

- `Tests.StringLibraryTests`: 1 passed.
- `Tests.StringUtilsTests`: 2 passed.
- Total: 3 passed, 0 failed.

All six workflows built, deployed, and smoke-tested the application
successfully.

## Result

| Metric | Single job | Two shards | Change |
|---|---:|---:|---:|
| Workflow wall time, average | 75.3 s | 73.0 s | 2.3 s lower (3.1%) |
| Workflow wall time, median | 75 s | 69 s | 6 s lower |
| Test-stage elapsed time | 22.3 s | 25.7 s | 3.4 s slower (14.9%) |
| Test-runner execution | 22.3 s | 49.0 s | 26.7 s higher (119.4%) |
| Critical test command | 4.7 s | 6.0 s | 1.3 s slower (28.6%) |
| Sum of test commands | 4.7 s | 11.3 s | 6.6 s higher (142.9%) |
| Tests passed | 3 | 1 + 2 | unchanged |
| Actual Actions cost | $0 | $0 | unchanged for this public repository |

The lower end-to-end average in sharded mode is not attributed to test
parallelization. The unchanged image/deployment path was the critical path and
varied between runs. The isolated test stage—the component changed by this
experiment—became 14.9% slower.

Each shard paid for another VM, checkout, SDK setup, restore, compilation,
discovery, and test-host startup to execute tests that take only milliseconds.
That duplicated overhead more than doubled test-runner execution.

## Recommendation

Do not promote sharding for this suite. Retain one test job and keep the manual
selector as a learning control.

Sharding becomes useful when:

- Individual tests or groups take minutes rather than milliseconds.
- Shards have similar durations and can be balanced.
- Shared setup can be reused or is small compared with test execution.
- The test stage is actually on the pipeline's critical path.
- The faster feedback is worth the extra concurrent runner usage and cost.

As this suite grows, collect per-test duration data and divide tests by
historical duration instead of merely assigning an equal number of classes to
each shard.
