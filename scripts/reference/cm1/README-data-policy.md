# CM1 Local Data Policy

Do not commit large CM1 output files to git.

Use the ignored local path:

```text
data/reference/cm1/
```

Several GB of local data is acceptable for user-generated reference datasets,
but large outputs should remain local unless a separate artifact/storage plan is
approved.

Commit:

- docs
- scripts
- manifests
- case configs
- tiny fixtures

Do not commit:

- large NetCDF outputs
- compiled CM1 binaries
- CM1 source code unless licensing/repo policy explicitly allows it
- local machine build products

Cloud Lab should ingest selected CM1 output through the reference adapter, not
by pointing the frontend directly at raw CM1 output.
