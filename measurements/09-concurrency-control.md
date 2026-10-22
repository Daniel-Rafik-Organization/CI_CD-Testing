# Optimization 9: concurrency control

## Purpose

Without concurrency control, a new commit or manual dispatch can start while
an older pipeline for the same branch is still running. Both consume runners,
build images, and may deploy. With different commits, the older pipeline can
also finish last and overwrite the newer deployment with stale code.

The promoted workflow now allows only one active run per Git ref:

```yaml
concurrency:
  group: project4-default-${{ github.ref }}
  cancel-in-progress: true
```

The ref keeps independent pull requests and branches in separate groups. A
new run on the same ref requests cancellation of the older run.

## Before

The workflow had no `concurrency` configuration. Two manual runs of the same
commit were dispatched approximately two seconds apart to isolate concurrency
behavior from source changes:

- Run 1: https://github.com/Daniel-Rafik-Organization/CI_CD-Testing/actions/runs/39753068180
- Run 2: https://github.com/Daniel-Rafik-Organization/CI_CD-Testing/actions/runs/39753074124

Both ran concurrently and succeeded:

- Pair elapsed time: 74 seconds from the first creation to the last completion.
- Total runner execution: 182 seconds.
- Completed image builds: 2.
- Successful EC2 deployments: 2.

The second deployment was unnecessary because both runs used the same commit.
For different commits, completion order would also determine which revision
remained deployed.

## After

After adding the concurrency group, two manual runs were again dispatched
approximately three seconds apart:

- Older, cancelled run:
  https://github.com/Daniel-Rafik-Organization/CI_CD-Testing/actions/runs/39753507786
- Newer, successful run:
  https://github.com/Daniel-Rafik-Organization/CI_CD-Testing/actions/runs/39753514306

The older run was cancelled and did not complete a successful deployment. The
newer run completed its tests, image build, artifact handoff, EC2 deployment,
and smoke test.

Cancellation was not immediate in this observed pair. The older run completed
its test and image jobs and was cancelled during its deployment job:

- Cancelled run runner execution: 74 seconds.
- Surviving run runner execution: 106 seconds.
- Pair elapsed time: 156 seconds.
- Combined runner execution: 180 seconds.
- Successful EC2 deployments: 1.

GitHub kept the newer run pending while it cancelled the older run. This
queueing made the overlapping pair slower than the control. An independent
run after adding the configuration succeeded in 72 seconds with 87
runner-seconds, showing that the concurrency setting does not add work to an
uncontended pipeline:

- https://github.com/Daniel-Rafik-Organization/CI_CD-Testing/actions/runs/39753330082

## Measured result

| Metric for two overlapping runs | Before | After | Change |
|---|---:|---:|---:|
| Pair elapsed time | 74 s | 156 s | 82 s slower |
| Total runner execution | 182 s | 180 s | 2 s lower (1.1%) |
| Completed image builds | 2 | 2 | no saving in this pair |
| Successful EC2 deployments | 2 | 1 | one duplicate prevented |
| Final newer run | successful | successful | unchanged |
| GitHub-hosted runner cost | $0 | $0 | unchanged for this public repository |

Concurrency control achieved its reliability goal but did not materially save
compute in this sample because GitHub processed cancellation late. Savings
depend on how early the superseding run arrives and how quickly cancellation
is applied. If cancellation occurs during dependency installation or build,
more runner time is avoided; if it occurs near deployment, most computation
has already been spent.

## Limitations and safety

- Cancellation is a request, not an instantaneous termination.
- A remote command may already have started when the runner is cancelled.
- The newer run must still deploy and pass its health check to establish the
  desired final state.
- Separate branches and pull requests do not cancel each other because their
  refs differ.
- Pull requests remain unable to deploy in this workflow.

The concurrency setting is retained because preventing obsolete same-ref runs
from completing deployment is more important than the variable timing benefit.
