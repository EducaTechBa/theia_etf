
# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).




## [1.2.1] - 2026-01-09

### Fixed

- Handle unknown program ID (e.g. user never finished testing but stale cached data on backend was cleaned)


## [1.2.0] - 2025-11-16

### Changed

- Upgrade to Theia 1.66.2
- Lots of dead and irrelevant code removed


## [1.1.1] - 2023-11-03

### Fixed

- Don't run tests again after close&open IDE (store cached status data in .at_result file)
- Prevent DDoS from many users waiting in test queue 


## [1.1.0] - 2023-10-17

### Added

- Progressive loading
- Handle parsing errors
- Support for .autotest3 file format

### Fixed

- Don't show "Running test" after user clicked on Cancel


## [1.0.3] - 2022-03-12

### Fixed

- Properly implemented Cancel Task on backend which required some UI tweaks
- More fixes to ZIP files


## [1.0.2] - 2021-02-16

### Fixed

- Further fixes to ZIP file handling (Rijad & Tarik)

## [1.0.1] - 2020-10-31

### Fixed

- Fix removing program (Rijad)
- Fix generating ZIP files (Rijad)

## [1.0.0] - 2020-10-25

### Added

- Initial release (Mirza Mesihović & Rijad Fejzić)
