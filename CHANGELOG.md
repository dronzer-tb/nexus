# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.1] - 2025-10-14

### Fixed
- Login redirect loop by removing duplicate navigation calls
- Enhanced token verification flow after login
- Added comprehensive console logging for authentication debugging
- Navigation now uses replace: true to prevent back button issues

### Changed
- Token is now verified immediately after login before updating state
- Improved error handling in authentication flow

## [1.1.0] - 2025-10-14

### Added
- Interactive admin account setup during installation
- Option to choose between custom or default admin credentials
- Dynamic version reading from VERSION file
- VERSION file for centralized version management
- User prompt asking if they want custom account or default (admin/admin123)
- Auto-detection of local machine in combine mode
- Delay in login flow to ensure state synchronization

### Changed
- Install script now asks before creating custom admin account
- All banners display version dynamically from VERSION file or package.json
- Updated to semantic versioning format (MAJOR.MINOR.PATCH)
- Improved authentication flow with better state management

### Fixed
- Login redirect loop caused by interceptor catching verify endpoint
- Authentication state not persisting after successful login
- Token verification causing immediate redirects

## [1.0.0] - 2025-10-14

### Added
- Initial release
- Modern React dashboard with 7 pages
- Complete authentication system with JWT
- WebSocket real-time updates
- Agent management system
- Process monitoring
- Command console
- System logs viewing
- Three operation modes: Node, Server, Combine
- Docker support
- Automated installation scripts
- Comprehensive documentation
- Dark theme UI with custom animations
- Logo and branding integration (later removed)
- Admin credentials management
- bcrypt password hashing
- Automatic token inclusion via axios interceptors

### Features
- **Dashboard Pages:**
  - Overview - Agent status at a glance
  - Agents List - Manage connected agents
  - Agent Details - Detailed agent information
  - Process Manager - View and manage processes
  - Command Console - Execute commands remotely
  - Logs - View system logs

- **Authentication:**
  - JWT-based authentication
  - Session management
  - Secure password storage with bcrypt
  - Token auto-refresh

- **Monitoring:**
  - Real-time CPU, memory, disk usage
  - Process monitoring
  - System information
  - Network statistics

- **Management:**
  - Remote command execution
  - Process control (kill processes)
  - Multiple agent support
  - WebSocket communication

### Installation
- One-command installation script
- Interactive mode selection
- Automatic dependency installation
- Dashboard build automation
- Configuration generation

---

## Version Format

We use [Semantic Versioning](https://semver.org/):

- **MAJOR** version: Incompatible API changes
- **MINOR** version: New functionality in a backwards compatible manner
- **PATCH** version: Backwards compatible bug fixes

### How to Update Version

1. Update `VERSION` file
2. Update `package.json` version
3. Add entry to CHANGELOG.md
4. Commit with message: `v{VERSION}: {DESCRIPTION}`

Example:
```bash
echo "1.2.0" > VERSION
# Edit package.json version to 1.2.0
# Add CHANGELOG.md entry
git add VERSION package.json CHANGELOG.md
git commit -m "v1.2.0: Add new feature XYZ"
git push origin main
```

---

**Made with ❤️ by Dronzer Studios**
