# Optimization 6: Docker multi-stage build

## Experimental design

The upstream Dockerfile was already multi-stage, so the experiment creates a
deliberately single-stage control instead of pretending to add an optimization
that already existed.

`Dockerfile.single-stage` keeps the SDK, source, NuGet state, compiler outputs,
and published application in one final image.

The existing `Dockerfile` builds with the SDK image, then copies only published
application output into the smaller .NET runtime image.

Both variants use equivalent restore/source layer ordering. The same promoted
parallel workflow builds, archives, uploads, downloads, transfers, loads, and
smoke-tests each image. NuGet and BuildKit caches remain disabled.

## Single-stage control runs

- Run 1: https://github.com/Daniel-Rafik-Organization/CI_CD-Testing/actions/runs/39275113860
- Run 2: https://github.com/Daniel-Rafik-Organization/CI_CD-Testing/actions/runs/39275487202
- Run 3: https://github.com/Daniel-Rafik-Organization/CI_CD-Testing/actions/runs/39276255286

Three-run results:

- Workflow wall time: 181.3 s average; 138 s median.
- Total runner execution: 202.0 s average; 160 s median.
- Image-job duration: 58.156 s average.
- Docker build: 21.888 s average.
- Image archive creation: 15.729 s average.
- Artifact upload: 3.535 s average.
- Deployment-job duration: 102.901 s average; 68.995 s median.
- Artifact download: 71.650 s average; 29.004 s median.
- Transfer to EC2: 12.256 s average; 14.844 s median.
- EC2 image load: 17.480 s average; 14.887 s median.
- EC2 smoke test: 0.574 s average; 0.392 s median.
- Image size: approximately 867,904,523 bytes.
- Compressed artifact: approximately 364,026,132 bytes.

Run 2 had a 181.108 s artifact-download outlier. This is network/service
variance, not an inherent Dockerfile cost, so medians are included for the
end-to-end comparison.

## Multi-stage runs

- Run 1: https://github.com/Daniel-Rafik-Organization/CI_CD-Testing/actions/runs/39274866804
- Run 2: https://github.com/Daniel-Rafik-Organization/CI_CD-Testing/actions/runs/39276691881
- Run 3: https://github.com/Daniel-Rafik-Organization/CI_CD-Testing/actions/runs/39276897015

Three-run results:

- Workflow wall time: 70.7 s average; 69 s median.
- Total runner execution: 94.3 s average; 92 s median.
- Image-job duration: 45.206 s average.
- Docker build: 19.530 s average.
- Image archive creation: 5.233 s average.
- Artifact upload: 2.883 s average.
- Deployment-job duration: 13.021 s average; 12.672 s median.
- Artifact download: 3.255 s average; 3.159 s median.
- Transfer to EC2: 4.286 s average; 4.173 s median.
- EC2 image load: 4.253 s average; 4.282 s median.
- EC2 smoke test: 0.393 s average; 0.408 s median.
- Image size: 230,839,331 bytes.
- Compressed artifact: approximately 101,586,004 bytes.

## Result

- Final image size decreased by 637,065,192 bytes, or 73.4%.
- Compressed transfer artifact decreased by about 262,440,128 bytes, or 72.1%.
- Docker build improved by 2.358 s, or 10.8%.
- Image archive creation improved by 10.496 s, or 66.7%.
- Median artifact download improved by 25.845 s, or 89.1%.
- Average EC2 transfer improved by 7.970 s, or 65.0%.
- Median EC2 image load improved by 10.605 s, or 71.2%.
- Median workflow wall time improved from 138 s to 69 s, or 50.0%.
- All tests, artifact operations, deployments, and smoke tests passed.
- GitHub-hosted runner cost remained $0 for this public repository.

The multi-stage image excludes the SDK, compiler, source tree, NuGet state, and
intermediate build output. This reduces transfer time, disk consumption, and
the available tooling/attack surface in the deployed container. It does not by
itself make the container fully hardened; runtime user, capabilities,
filesystem permissions, base-image patching, and secrets still matter.

## Recommendation

Retain the existing multi-stage Dockerfile. The improvement is substantial and
consistent in image and artifact size. Keep `Dockerfile.single-stage` only as a
manual learning control.
