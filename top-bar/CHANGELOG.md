
# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).



## [1.2.1] - 2025-12-25


### Added

- Notification bubble for common AddressSanitizer situations (found in .asan.out)

### Fixed

- Hide "Terminal" menu
- Attempt to fix "No Run task defined" error (it's a race condition so very difficult to reproduce or confirm fixed)


## [1.2.0] - 2025-11-19

### Added

- Disable "Testing" panel (introduced with new Theia by default)
- Implement Stop button
- Monitor .asan.out to detect program craching
- Implement automatic closing of terminal windows to improve performance and memory usage
- Add options "New C File", "New C++ file" etc. to menu to simplify manual task creation
- Detect failure to reconnect after networking issues and force reload environment (not really tested in production)

### Changed

- Upgrade to Theia 1.66.2
- Improved logging which helped us debug backend issues

### Fixed

- Various small glitches when running tasks


## [1.1.0] - 2023-10-17

### Added

- More robust handling of session expiration (redirect to logout page)
- Error handling for various problems with submitting homework

### Changed

- Changes to backend API


## [1.0.1] - 2020-11-13

### Fixed

- Fix homework submit (Tarik)
- Code cleanup and log messsages

## [1.0.0] - 2020-10-17

### Added

- Initial release (Rijad Fejzić)
