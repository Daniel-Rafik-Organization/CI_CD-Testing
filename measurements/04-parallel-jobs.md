# Optimization 4: Parallel jobs

## Experimental design

Separate GitHub-hosted runners do not share files or local Docker images.
Therefore, both workflows use the same neutral image-artifact handoff:

1. Build and archive the immutable Docker image.
2. Upload the archive as a one-day GitHub Actions artifact.
3. Download it in the deployment job.
4. Transfer it to EC2 and run the smoke test.

The sequential control uses this dependency graph:

```text
test -> build-image -> deploy
```

The optimized workflow changes only the dependency graph:

```text
test --------\
              -> deploy
build-image --/
```

Deployment waits for both parallel jobs, so the image cannot be deployed
unless tests and the image build succeed. NuGet and BuildKit caches remain
disabled and Docker uses `--no-cache`.

The control is preserved in `project4-jobs-sequential.yml`. The experiment is
preserved in `project4-jobs-parallel.yml`. Both are manually triggered.

## Sequential control runs

- Run 1: https://github.com/Daniel-Rafik-Organization/CI_CD-Testing/actions/runs/39245455088
- Run 2: https://github.com/Daniel-Rafik-Organization/CI_CD-Testing/actions/runs/39245695588
- Run 3: https://github.com/Daniel-Rafik-Organization/CI_CD-Testing/actions/runs/39245913745

Three-run averages:

- Workflow wall-clock duration: 97.0 s.
- Total runner execution time: 93.0 s.
- Test job: 20.278 s.
- Image job: 47.861 s.
- Deployment job: 12.044 s.
- Test restore: 4.194 s.
- Tests: 5.997 s.
- Image-job restore: 4.434 s.
- Publish: 3.130 s.
- Docker build: 20.980 s.
- Image archive creation: 5.838 s.
- Artifact upload: 1.888 s.
- Artifact download: 2.878 s.
- Transfer to EC2: 3.733 s.
- EC2 image load: 4.317 s.
- EC2 smoke test: 0.377 s.
- Image size: 230,839,331 bytes.
- Compressed image artifact: 101,592,963 bytes.

## Parallel runs

- Run 1: https://github.com/Daniel-Rafik-Organization/CI_CD-Testing/actions/runs/39246147714
- Run 2: https://github.com/Daniel-Rafik-Organization/CI_CD-Testing/actions/runs/39246313416
- Run 3: https://github.com/Daniel-Rafik-Organization/CI_CD-Testing/actions/runs/39246477827

Three-run averages:

- Workflow wall-clock duration: 64.0 s.
- Total runner execution time: 85.0 s.
- Test job: 19.807 s.
- Image job: 44.005 s.
- Deployment job: 9.818 s.
- Test restore: 4.183 s.
- Tests: 6.375 s.
- Image-job restore: 3.796 s.
- Publish: 3.301 s.
- Docker build: 19.265 s.
- Image archive creation: 5.438 s.
- Artifact upload: 1.964 s.
- Artifact download: 1.780 s.
- Transfer to EC2: 2.782 s.
- EC2 image load: 4.283 s.
- EC2 smoke test: 0.395 s.
- Image size: 230,839,331 bytes.
- Compressed image artifact: 101,589,534 bytes.

## Result

- Workflow wall time improved by 33.0 s, or 34.0%.
- Tests and image building overlapped for about 20 seconds.
- All tests, artifact transfers, immutable deployments, and smoke tests passed.
- Image size and behavior were unchanged.
- Peak runner concurrency increased from one runner to two.
- GitHub-hosted runner cost remained $0 because the repository is public.

Observed total runner execution was 8 seconds lower in the parallel runs, but
parallelism does not inherently reduce total compute work. Docker, network,
runner startup, and job-to-job timing varied between runs, so this compute-time
difference must not be attributed to parallel execution. The reliable benefit
is lower wall-clock feedback and deployment time.

Artifact upload and download overhead exists in both workflows and is excluded
as a distinguishing optimization. Artifact behavior will be evaluated
separately in Topic 5.

## Recommendation

Promote the parallel dependency graph when fast feedback is more important
than minimizing peak runner concurrency. Keep deployment gated on both jobs.
For private repositories, evaluate whether reduced elapsed time justifies
runner-minute usage and concurrency limits.
