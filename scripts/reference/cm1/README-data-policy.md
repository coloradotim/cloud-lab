# CM1 Local Data Policy

Do not commit large CM1 output files to git.

Use the ignored local path:

```text
data/reference/cm1/
frontend/public/reference/cm1/local/
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
- CM1 runtime support files such as `LANDUSE.TBL`
- CM1 source code unless licensing/repo policy explicitly allows it
- local machine build products

Cloud Lab should ingest selected CM1 output through the reference adapter, not
by pointing the frontend directly at raw CM1 output.

The first committed case assets live under:

```text
reference/cm1/cases/
```

Generated output from those cases should still stay under the ignored local
`data/reference/cm1/` tree.

The run scripts may copy `cm1.exe`, `LANDUSE.TBL`, namelists, and soundings into
ignored local run directories so CM1 can execute repeatably. Those copied files
are runtime artifacts only; do not move them into committed case directories.

Generated `reference-run-v1` artifacts and local frontend indexes are also
ignored. They are local developer/user artifacts used to view real CM1 output
in Cloud Lab, not committed source data.
