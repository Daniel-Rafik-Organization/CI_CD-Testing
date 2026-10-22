# Optimization 10: right-sized runners

## Purpose

Runner sizing balances elapsed time, compute capacity, and cost. A small job
may not need the same runner as a Docker build, but reducing CPU and memory can
make that job slow enough to become the pipeline's critical path.

Only the test job was changed in this experiment. The Docker image and deploy
jobs remained on `ubuntu-latest`.

GitHub's hosted-runner documentation on 2026-10-22 lists these standard public
repository runners:

- `ubuntu-latest`: 4 vCPU, 16 GB RAM, 14 GB SSD, x64 virtual machine.
- `ubuntu-slim`: 1 vCPU, 5 GB RAM, 14 GB SSD, x64 container.

Both are free and unlimited for this public repository. Paid larger runners
were not tested because they are always billed, including for public
repositories, and this small application does not justify their cost.

References:

- https://docs.github.com/en/actions/reference/runners/github-hosted-runners
- https://docs.github.com/en/billing/reference/actions-runner-pricing

## Configuration

Before, the test job always used the standard runner:

```yaml
test:
  runs-on: ubuntu-latest
```

The experiment added a manual selector:

```yaml
test:
  runs-on: ${{ inputs.test_runner || 'ubuntu-latest' }}
```

`workflow_dispatch` can select `ubuntu-latest` or `ubuntu-slim`. Automatic
push and pull-request runs continue to use `ubuntu-latest`.

## Control: 4-vCPU `ubuntu-latest`

- https://github.com/Daniel-Rafik-Organization/CI_CD-Testing/actions/runs/39754581576
- https://github.com/Daniel-Rafik-Organization/CI_CD-Testing/actions/runs/39754776103
- https://github.com/Daniel-Rafik-Organization/CI_CD-Testing/actions/runs/39754956463

Three-run averages:

- Workflow wall time: 76.0 seconds.
- Total runner execution: 93.0 seconds.
- Test job: 24.0 seconds.
- Install .NET SDK step: 8.0 seconds.
- Dependency restore step: 4.7 seconds.
- Test command step: 6.0 seconds.

## Candidate: 1-vCPU `ubuntu-slim`

- https://github.com/Daniel-Rafik-Organization/CI_CD-Testing/actions/runs/39755125705
- https://github.com/Daniel-Rafik-Organization/CI_CD-Testing/actions/runs/39755375489
- https://github.com/Daniel-Rafik-Organization/CI_CD-Testing/actions/runs/39755555454

Three-run averages:

- Workflow wall time: 88.3 seconds.
- Total runner execution: 128.3 seconds.
- Test job: 57.3 seconds.
- Install .NET SDK step: 28.0 seconds.
- Dependency restore step: 11.3 seconds.
- Test command step: 9.0 seconds.

All six pipelines passed their tests, built the same application image,
deployed to EC2, and passed the smoke test.

## Result

| Metric | `ubuntu-latest` | `ubuntu-slim` | Change |
|---|---:|---:|---:|
| Workflow wall time, average | 76.0 s | 88.3 s | 12.3 s slower (16.2%) |
| Workflow wall time, median | 79 s | 79 s | unchanged |
| Total runner execution | 93.0 s | 128.3 s | 35.3 s higher (38.0%) |
| Test job | 24.0 s | 57.3 s | 33.3 s slower (138.9%) |
| .NET SDK setup | 8.0 s | 28.0 s | 20.0 s slower |
| Dependency restore | 4.7 s | 11.3 s | 6.6 s slower |
| Test command | 6.0 s | 9.0 s | 3.0 s slower |
| Estimated allocated CPU capacity for test job | 96 vCPU-s | 57.3 vCPU-s | 40.3% lower |
| Actual GitHub Actions cost | $0 | $0 | unchanged |

Allocated CPU capacity is runner cores multiplied by test-job duration. It is
an estimate of provisioned capacity, not measured CPU utilization.

The image job is usually longer than the test job, so two slim runs still had
the same 79-second median workflow duration as the control. In the slowest
slim run, however, the 65-second test job extended the critical path. The
minimal runner also made SDK installation and dependency restore much slower.

## Recommendation

Do not promote `ubuntu-slim` for this test job:

- It provides no actual cost reduction for this public repository.
- It increases average end-to-end time and total runner execution.
- It reduces capacity but leaves less performance margin and can become the
  critical path.

Retain `ubuntu-latest` for automatic runs. Keep the manual selector as a
learning control.

For a private repository, a lower per-minute rate could change the decision,
but cost must be calculated using that repository's runner specifications,
rounded billable minutes, and current GitHub pricing. Larger runners should be
considered only after profiling shows CPU, memory, disk, or test parallelism
can use the added capacity.
