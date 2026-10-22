# Optimization 12: artifact and image reuse

## Purpose

Build once and deploy the exact output that passed CI. Rebuilding in the
deployment job wastes time and can produce different bytes if toolchains,
timestamps, or mutable base tags change.

Topic 5 already established the performance benefit of carrying the built
Docker image between jobs:

| Three-run average | Rebuild during deploy | Reuse built artifact | Change |
|---|---:|---:|---:|
| Workflow wall time | 87.7 s | 64.3 s | 26.6% faster |
| Total runner execution | 110.0 s | 87.0 s | 20.9% lower |
| Duplicate Docker build | 22.0 s | 0 s | eliminated |
| Artifact upload + download | 0 s | 3.9 s | added |

Detailed control design and run links are in
`measurements/05-build-artifacts-between-jobs.md`.

This final experiment strengthened the identity guarantee. The build job now:

1. Builds the image once.
2. Saves it as a compressed archive.
3. Computes the archive's SHA-256.
4. Uploads the archive and digest in one run-specific Actions artifact.

The deployment job downloads that artifact, transfers the archive to EC2, and
verifies its SHA-256 before loading or running it.

## Before

The workflow used an immutable source tag and a run-specific artifact name,
but did not explicitly compare content identity after transfer:

```yaml
docker build --tag "$IMAGE_NAME:$GITHUB_SHA" .
docker save "$IMAGE_NAME:$GITHUB_SHA" | gzip -1 > "$archive"
```

## After

The build runner records the transported archive's content digest:

```bash
archive_sha256=$(sha256sum "$archive" | awk '{print $1}')
printf '%s\n' "$archive_sha256" \
  > "$RUNNER_TEMP/project4-${GITHUB_SHA}.archive-sha256"
```

EC2 hashes its received copy and rejects any mismatch before `docker load`:

```bash
actual_archive_sha256=$(sha256sum "$archive" | awk '{print $1}')
if [[ "$actual_archive_sha256" != "$expected_archive_sha256" ]]; then
  exit 1
fi
```

## Successful verification runs

- https://github.com/Daniel-Rafik-Organization/CI_CD-Testing/actions/runs/39764190871
- https://github.com/Daniel-Rafik-Organization/CI_CD-Testing/actions/runs/39764365099
- https://github.com/Daniel-Rafik-Organization/CI_CD-Testing/actions/runs/39764554325

All three runs:

- Passed all tests.
- Built and uploaded one image archive.
- Matched the archive digest on EC2 before loading.
- Loaded and smoke-tested the image successfully.

Three-run averages:

- Workflow wall time: 78.7 seconds.
- Total runner execution: 94.7 seconds.
- Archive digest generation: 77 milliseconds.
- EC2 archive verification: 1,004 milliseconds.
- Combined digest overhead: 1,081 milliseconds.
- Image size: 230,835,587 bytes.
- Compressed archive: approximately 101.6 MB.
- GitHub-hosted runner cost: $0 for this public repository.

The current workflow has changed since the Topic 5 controlled performance
runs, and network timings vary, so the 78.7-second value is not compared
directly with Topic 5's 64.3-second average. The digest steps themselves are
instrumented and provide the relevant incremental overhead.

## Failed image-ID approach and Docker 29 lesson

The first implementation compared `docker image inspect ... --format
'{{.Id}}'` between the GitHub runner and EC2. Three initial runs and one
diagnostic run correctly blocked deployment because those values differed.

The reason is the image-store model:

- The legacy Docker graphdriver store identifies an image using its
  configuration digest.
- The containerd image store can expose a manifest or index digest as the
  Docker image ID.
- Docker Engine 29 enables the containerd image store by default on fresh
  installations, including this EC2 host.

Therefore, Docker's displayed image ID is not a portable cross-store
identifier for this `docker save`/`docker load` path. The archive SHA-256 is
stable because it identifies the actual bytes transported.

References:

- https://docs.docker.com/engine/storage/containerd/
- https://github.com/docker/cli/issues/6670
- https://github.com/moby/moby/issues/48401

EC2's Docker storage backend was not disabled or reconfigured to force an ID
match.

## Security and scope

The check detects corruption or replacement of the archive between digest
creation and verification on EC2. The digest metadata and archive are stored
in the same trusted GitHub Actions artifact, so this is not a signature and
does not protect against an attacker who can alter both values.

For a registry-based production design, publish once, deploy by immutable
registry manifest digest, and consider signed provenance or artifact
attestations. No registry or paid service was introduced in this lab.

## Recommendation

Retain artifact reuse and archive-digest verification:

- Duplicate image builds remain eliminated.
- Deployment uses the exact transported archive from the build job.
- Verification adds only about 1.08 seconds in this environment.
- A mismatch fails closed before the image is loaded or executed.

Keep one-day artifact retention because this artifact is an intra-workflow
handoff, not a long-term release store.
