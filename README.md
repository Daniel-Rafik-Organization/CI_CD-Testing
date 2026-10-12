# .NET CI/CD Optimization Lab

This is an isolated copy of the .NET Docker `MultiProjectApp` sample for
measuring CI/CD optimizations one at a time. See `UPSTREAM.md` for exact
source provenance and `LICENSE` for the preserved upstream license.

The application is a small .NET 11 console program composed of an executable,
two class libraries, and an xUnit test project. Its Dockerfile contains
separate build, test, publish, and runtime stages.

## Local validation

With a .NET 11 SDK:

```powershell
dotnet restore MultiProjectApp.slnx
dotnet test MultiProjectApp.slnx --no-restore
dotnet publish MultiProjectApp/MultiProjectApp.csproj --no-restore -c Release
```

With Docker and BuildKit:

```powershell
docker build --target test -t dotnet-optimization-tests .
docker run --rm dotnet-optimization-tests
docker build -t dotnet-optimization-app .
docker run --rm dotnet-optimization-app
```

No workflow in this repository publishes images, deploys infrastructure, or
uses credentials. GitHub Actions and EC2 deployment will be introduced only
in later, explicitly approved stages.
