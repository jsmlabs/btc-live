# Changelog

All notable changes to the BTC Live development candidate are recorded here. Entries are not evidence of an approved customer release.

## [1.25.3] - 2026-10-16

### Fixed
- Ignore zero, negative and non-finite live/24-hour price references when constructing chart overlays, preventing invalid market values from distorting the visible scale.
- Add deterministic chart model regression coverage for invalid and valid references.

### Verification
- Development candidate; live browser and release acceptance remain separate mandatory checks.

## [1.25.2] - 2026-10-16

### Fixed
- Normalize the BAT launcher's root-directory argument to avoid an invalid path caused by the trailing backslash before a quoted argument.
- Update the launcher regression test to require safe Windows path quoting.

### Verification
- Windows CI and interactive GUI acceptance must still be checked; this is a development candidate, not a published release.

## [1.25.1] - 2026-10-16

### Fixed
- Reject a fetched source checkout whose manifest version is older than the installed version, even if the Git commit is a valid fast-forward.
- Fail closed for invalid local version strings before attempting the merge.

### Verification
- Added Windows updater source regression assertions.
- Real Windows GUI acceptance and the seven customer-release gates remain outstanding.

## [1.25.0]

- Previous development candidate. Refer to repository history for earlier changes.
