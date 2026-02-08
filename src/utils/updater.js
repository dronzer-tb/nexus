/**
 * Nexus Auto-Updater — GitHub Release Checker & Self-Update
 * Dronzer Studios
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const logger = require('./logger');

const GITHUB_REPO = 'dronzer-tb/nexus';
const GITHUB_API = `https://api.github.com/repos/${GITHUB_REPO}/releases`;

// Read current version
function getCurrentVersion() {
  try {
    const versionFile = path.join(__dirname, '../../VERSION');
    if (fs.existsSync(versionFile)) {
      return fs.readFileSync(versionFile, 'utf8').trim();
    }
    const pkg = require('../../package.json');
    return pkg.version;
  } catch {
    return '0.0.0';
  }
}

// Compare semver strings: returns 1 if a > b, -1 if a < b, 0 if equal
function compareSemver(a, b) {
  const pa = a.replace(/^v/, '').split('.').map(Number);
  const pb = b.replace(/^v/, '').split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const va = pa[i] || 0;
    const vb = pb[i] || 0;
    if (va > vb) return 1;
    if (va < vb) return -1;
  }
  return 0;
}

// Check GitHub for the latest release
async function checkForUpdate() {
  try {
    const currentVersion = getCurrentVersion();
    
    const response = await axios.get(`${GITHUB_API}/latest`, {
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Nexus-Updater',
      },
      timeout: 15000,
    });

    const release = response.data;
    const latestVersion = release.tag_name.replace(/^v/, '');
    const hasUpdate = compareSemver(latestVersion, currentVersion) > 0;

    return {
      currentVersion,
      latestVersion,
      hasUpdate,
      releaseName: release.name,
      releaseNotes: release.body || '',
      publishedAt: release.published_at,
      htmlUrl: release.html_url,
      tarballUrl: release.tarball_url,
      zipballUrl: release.zipball_url,
      assets: (release.assets || []).map(a => ({
        name: a.name,
        size: a.size,
        downloadUrl: a.browser_download_url,
      })),
    };
  } catch (error) {
    if (error.response?.status === 404) {
      logger.warn('No releases found on GitHub');
      return {
        currentVersion: getCurrentVersion(),
        latestVersion: getCurrentVersion(),
        hasUpdate: false,
        error: 'No releases found',
      };
    }
    if (error.response?.status === 403) {
      logger.warn('GitHub API rate limit exceeded');
      return {
        currentVersion: getCurrentVersion(),
        latestVersion: null,
        hasUpdate: false,
        error: 'GitHub API rate limit exceeded. Try again later.',
      };
    }
    logger.error('Update check failed:', error.message);
    return {
      currentVersion: getCurrentVersion(),
      latestVersion: null,
      hasUpdate: false,
      error: error.message,
    };
  }
}

// Get all releases (for changelog)
async function getAllReleases(limit = 10) {
  try {
    const response = await axios.get(GITHUB_API, {
      params: { per_page: limit },
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Nexus-Updater',
      },
      timeout: 15000,
    });

    return response.data.map(release => ({
      version: release.tag_name.replace(/^v/, ''),
      name: release.name,
      notes: release.body || '',
      publishedAt: release.published_at,
      htmlUrl: release.html_url,
    }));
  } catch (error) {
    logger.error('Failed to fetch releases:', error.message);
    return [];
  }
}

// Download and apply update
async function downloadAndApply() {
  const rootDir = path.join(__dirname, '../..');
  const tmpDir = path.join(rootDir, 'data', '.update-tmp');

  try {
    logger.info('Starting update download...');

    // 1. Check for update first
    const updateInfo = await checkForUpdate();
    if (!updateInfo.hasUpdate) {
      return { success: false, message: 'Already on the latest version' };
    }

    logger.info(`Downloading update v${updateInfo.latestVersion}...`);

    // 2. Clean up any previous tmp dir
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
    fs.mkdirSync(tmpDir, { recursive: true });

    // 3. Download via git pull (safest method for git repos)
    try {
      // Check if it's a git repo
      execSync('git rev-parse --is-inside-work-tree', { cwd: rootDir, encoding: 'utf8' });
      
      logger.info('Pulling latest changes from git...');
      const pullResult = execSync('git pull origin main 2>&1 || git pull origin master 2>&1', {
        cwd: rootDir,
        encoding: 'utf8',
        timeout: 120000,
      });
      logger.info(`Git pull result: ${pullResult.trim()}`);

    } catch (gitError) {
      // Not a git repo or git pull failed — try tarball download
      logger.info('Git pull failed, trying tarball download...');
      
      const tarballPath = path.join(tmpDir, 'update.tar.gz');
      
      const response = await axios({
        method: 'get',
        url: updateInfo.tarballUrl,
        responseType: 'stream',
        headers: { 'User-Agent': 'Nexus-Updater' },
        timeout: 300000,
        maxRedirects: 5,
      });

      const writer = fs.createWriteStream(tarballPath);
      response.data.pipe(writer);
      await new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
      });

      logger.info('Download complete, extracting...');

      // Extract tarball
      execSync(`tar xzf "${tarballPath}" -C "${tmpDir}" --strip-components=1`, {
        encoding: 'utf8',
        timeout: 60000,
      });

      // Copy extracted files over (preserving data/ and config/)
      const preserveDirs = ['data', 'config', 'node_modules', '.git'];
      const entries = fs.readdirSync(tmpDir);
      
      for (const entry of entries) {
        if (entry === 'update.tar.gz') continue;
        if (preserveDirs.includes(entry)) continue;
        
        const src = path.join(tmpDir, entry);
        const dest = path.join(rootDir, entry);
        
        if (fs.existsSync(dest)) {
          fs.rmSync(dest, { recursive: true, force: true });
        }
        fs.cpSync(src, dest, { recursive: true });
      }

      logger.info('Files updated from tarball');
    }

    // 4. Reinstall dependencies
    logger.info('Installing dependencies...');
    try {
      execSync('npm install --loglevel=warn', { cwd: rootDir, encoding: 'utf8', timeout: 120000 });
      logger.info('Backend dependencies installed');
    } catch (error) {
      logger.warn('npm install warning: ' + error.message);
    }

    // 5. Rebuild dashboard
    logger.info('Rebuilding dashboard...');
    try {
      execSync('cd dashboard && npm install --loglevel=warn && npm run build', {
        cwd: rootDir,
        encoding: 'utf8',
        timeout: 180000,
      });
      logger.info('Dashboard rebuilt successfully');
    } catch (error) {
      logger.warn('Dashboard rebuild warning: ' + error.message);
    }

    // 6. Clean up tmp
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }

    // 7. Update VERSION file
    const versionFile = path.join(rootDir, 'VERSION');
    fs.writeFileSync(versionFile, updateInfo.latestVersion, 'utf8');
    logger.info(`Updated VERSION to ${updateInfo.latestVersion}`);

    return {
      success: true,
      message: `Updated to v${updateInfo.latestVersion}. Restart Nexus to apply changes.`,
      previousVersion: updateInfo.currentVersion,
      newVersion: updateInfo.latestVersion,
      requiresRestart: true,
    };

  } catch (error) {
    logger.error('Update failed:', error);
    
    // Clean up on failure
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }

    return {
      success: false,
      message: `Update failed: ${error.message}`,
    };
  }
}

// Generate node update command (instructions to send to connected nodes)
function getNodeUpdateCommand() {
  return {
    type: 'update',
    command: 'cd /opt/nexus && git pull origin main && npm install && pm2 restart nexus-node || (cd /opt/nexus && git pull origin master && npm install && pm2 restart nexus-node)',
    fallbackCommand: 'cd /opt/nexus && git pull && npm install && systemctl restart nexus',
    instructions: [
      'Navigate to the Nexus installation directory',
      'Pull the latest code from git',
      'Install updated dependencies',
      'Restart the Nexus node service',
    ],
  };
}

module.exports = {
  getCurrentVersion,
  compareSemver,
  checkForUpdate,
  getAllReleases,
  downloadAndApply,
  getNodeUpdateCommand,
  GITHUB_REPO,
};
