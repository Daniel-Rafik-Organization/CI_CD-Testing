# Optimization 5: Build artifacts between jobs

## Experimental design

Both workflows keep the Topic 4 parallel graph:

```text
test --------\
              -> deploy
build-image --/
```

The no-artifact control validates the image in `build-image`, but that runner
is then destroyed. The deployment job checks out the same commit and rebuilds
the image with `--no-cache`.

The optimized workflow saves the immutable image as a gzip archive, uploads it
with `actions/upload-artifact@v4`, and downloads the exact archive in the
deployment job. The artifact has one-day retention and uses compression level
zero because the image archive is already compressed.

NuGet and BuildKit caches remain disabled. Both workflows use the same tests,
Dockerfile, immutable commit tag, EC2 transfer, image load, and smoke test.

The control is preserved in `project4-no-artifact-control.yml`. The optimized
workflow is the promoted `project4-jobs-parallel.yml`.

## No-artifact control runs

- Run 1: https://github.com/Daniel-Rafik-Organization/CI_CD-Testing/actions/runs/39266078704
- Run 2: https://github.com/Daniel-Rafik-Organization/CI_CD-Testing/actions/runs/39266344152
- Run 3: https://github.com/Daniel-Rafik-Organization/CI_CD-Testing/actions/runs/39266598190

Three-run averages:

- Workflow wall-clock duration: 87.667 s.
- Total runner execution time: 110.0 s.
- Test job: 20.369 s.
- Image-validation job: 39.558 s.
- Deployment job: 38.021 s.
- First image build: 21.607 s.
- Duplicate deployment image rebuild: 22.035 s.
- Deployment archive creation: 5.309 s.
- Transfer to EC2: 4.345 s.
- EC2 image load: 4.343 s.
- EC2 smoke test: 0.396 s.
- Image size: 230,839,331 bytes.
- Compressed deployment archive: 101,589,739 bytes.

## Artifact-reuse runs

- Run 1: https://github.com/Daniel-Rafik-Organization/CI_CD-Testing/actions/runs/39265879294
- Run 2: https://github.com/Daniel-Rafik-Organization/CI_CD-Testing/actions/runs/39266873416
- Run 3: https://github.com/Daniel-Rafik-Organization/CI_CD-Testing/actions/runs/39267065991

Three-run averages:

- Workflow wall-clock duration: 64.333 s.
- Total runner execution time: 87.0 s.
- Test job: 19.328 s.
- Image build/archive/upload job: 43.440 s.
- Deployment job: 10.891 s.
- Single Docker build: 19.324 s.
- Image archive creation: 5.079 s.
- Artifact upload: 1.883 s.
- Artifact download: 2.004 s.
- Combined artifact transport: 3.887 s.
- Transfer to EC2: 3.540 s.
- EC2 image load: 4.351 s.
- EC2 smoke test: 0.395 s.
- Image size: 230,839,331 bytes.
- Compressed artifact: 101,592,769 bytes.

## Result

- Workflow wall time improved by 23.334 s, or 26.6%.
- Total observed runner execution improved by 23.0 s, or 20.9%.
- Artifact upload plus download cost 3.887 s.
- The avoided duplicate Docker build cost 22.035 s.
- The isolated exchange saved approximately 18.148 s before considering the
  avoided second checkout and normal run variance.
- All tests, artifact operations, immutable deployments, and smoke tests
  succeeded.
- Image size and application behavior were unchanged.
- GitHub-hosted runner cost remained $0 for this public repository.

Unlike rebuilding, artifact reuse guarantees that the deployed image is the
same image produced by the validated build job. Rebuilding from mutable base
image tags could theoretically produce different bytes even at the same source
commit if a base tag changed between jobs.

## Recommendation

Keep artifact reuse in the promoted pipeline. It is faster, uses less runner
compute, and preserves build/deploy identity. Continue using short retention
because the artifact is only an intra-workflow handoff, not a release archive.

For larger images, compare artifact transfer with a container registry. A
registry can deduplicate layers and supports digest-based deployment without
moving a complete tar archive through the runner.
