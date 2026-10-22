# Optimization 8: path filtering

## Purpose

The default workflow previously ran after every push to `main`, even when a
commit changed only documentation. That spent runner time, built an unchanged
image, transferred it, and unnecessarily redeployed EC2.

Path filters now start the automatic workflow only when application, test,
Docker, build-manifest, or workflow files change. Manual dispatch remains
available for deliberate deployments and experiments.

## Before

A documentation-only probe commit (`b57deb42`) was pushed before filters were
configured:

- Run: https://github.com/Daniel-Rafik-Organization/CI_CD-Testing/actions/runs/39749703434
- Workflow wall time: 71 seconds.
- Total runner execution: 90 seconds.
- Test, image build, artifact handoff, and EC2 deployment all ran.
- The deployment was unnecessary because application and deployment inputs
  were unchanged.

## After

The `push` and `pull_request` triggers in
`.github/workflows/project4-jobs-parallel.yml` now include only:

- The default workflow, `.dockerignore`, and `Dockerfile`.
- Solution-wide .NET configuration and dependency manifests.
- Application, library, and test source trees.

Documentation-only commit `c29596ee` updated the same probe after filters were
enabled. GitHub created no run of the default workflow for that commit:

- Workflow wall time: 0 seconds.
- Runner execution: 0 seconds.
- Image build and EC2 deployment: not started.

This event-routing behavior is deterministic, so repeated documentation
commits would not provide meaningful timing samples.

## Manual-run validation

Path filters do not apply to `workflow_dispatch`. A manual run on the filtered
commit completed successfully:

- Run: https://github.com/Daniel-Rafik-Organization/CI_CD-Testing/actions/runs/39750234300
- Result: tests, image build, artifact handoff, EC2 deployment, and smoke test
  succeeded.
- Workflow wall time: 74 seconds.

## Result

| Metric for an irrelevant documentation commit | Before | After | Improvement |
|---|---:|---:|---:|
| Workflow wall time | 71 s | 0 s | 71 s (100%) |
| Total runner execution | 90 s | 0 s | 90 s (100%) |
| Image builds | 1 | 0 | eliminated |
| EC2 deployments | 1 | 0 | eliminated |
| GitHub-hosted runner cost | $0 | $0 | unchanged for this public repository |

The main benefit is avoiding work, not making a started pipeline run faster.
Relevant code changes still run the complete CI/CD pipeline.

## Important limitation

GitHub evaluates path filters before creating the workflow run. If branch
protection requires this workflow's checks, a skipped workflow can leave an
expected check pending. Required checks should therefore be designed around
stable, always-created validation jobs or configured carefully before path
filters are used on protected branches.

Filters must also be maintained when new build inputs or source directories
are introduced. An omitted build-relevant path could incorrectly skip CI.
