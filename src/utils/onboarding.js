const database = require('./database');
const logger = require('./logger');

/**
 * Onboarding Detection and Management
 * For first-time setup flow in v2.2.8
 */

const ONBOARDING_KEY = 'onboarding_completed';
const ONBOARDING_VERSION_KEY = 'onboarding_version';
const CURRENT_ONBOARDING_VERSION = '2.2.8';

/**
 * Check if onboarding has been completed
 * @returns {boolean} True if onboarding is complete
 */
function isOnboardingComplete() {
  try {
    const completed = database.getSetting(ONBOARDING_KEY);
    return completed === 'true';
  } catch (error) {
    logger.error('Error checking onboarding status:', error);
    return false;
  }
}

/**
 * Mark onboarding as complete
 * @returns {boolean} True if successful
 */
function completeOnboarding() {
  try {
    database.setSetting(ONBOARDING_KEY, 'true');
    database.setSetting(ONBOARDING_VERSION_KEY, CURRENT_ONBOARDING_VERSION);
    logger.info('Onboarding marked as complete');
    return true;
  } catch (error) {
    logger.error('Error completing onboarding:', error);
    return false;
  }
}

/**
 * Reset onboarding (for testing or re-setup)
 * @returns {boolean} True if successful
 */
function resetOnboarding() {
  try {
    database.setSetting(ONBOARDING_KEY, 'false');
    logger.warn('Onboarding reset - system will show setup wizard on next load');
    return true;
  } catch (error) {
    logger.error('Error resetting onboarding:', error);
    return false;
  }
}

/**
 * Get onboarding version
 * @returns {string|null} Onboarding version or null
 */
function getOnboardingVersion() {
  try {
    return database.getSetting(ONBOARDING_VERSION_KEY);
  } catch (error) {
    logger.error('Error getting onboarding version:', error);
    return null;
  }
}

/**
 * Check if this is a fresh installation
 * A fresh install has no users and onboarding not complete
 * @returns {boolean} True if fresh install
 */
function isFreshInstall() {
  try {
    const users = database.getAllUsers();
    const onboardingComplete = isOnboardingComplete();
    
    return users.length === 0 && !onboardingComplete;
  } catch (error) {
    logger.error('Error checking fresh install:', error);
    return true; // Default to showing onboarding on error
  }
}

/**
 * Save onboarding step progress
 * @param {number} step - Current step number (1-6)
 * @param {Object} data - Step data to save
 * @returns {boolean} True if successful
 */
function saveOnboardingStep(step, data) {
  try {
    const key = `onboarding_step_${step}`;
    database.setSetting(key, JSON.stringify(data));
    logger.debug(`Onboarding step ${step} saved`);
    return true;
  } catch (error) {
    logger.error(`Error saving onboarding step ${step}:`, error);
    return false;
  }
}

/**
 * Get onboarding step data
 * @param {number} step - Step number
 * @returns {Object|null} Step data or null
 */
function getOnboardingStep(step) {
  try {
    const key = `onboarding_step_${step}`;
    const data = database.getSetting(key);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    logger.error(`Error getting onboarding step ${step}:`, error);
    return null;
  }
}

/**
 * Clear all onboarding step data (after completion)
 * @returns {boolean} True if successful
 */
function clearOnboardingSteps() {
  try {
    for (let i = 1; i <= 6; i++) {
      const key = `onboarding_step_${i}`;
      // SQLite doesn't have DELETE for settings, so we set to empty
      database.setSetting(key, '{}');
    }
    logger.debug('Onboarding step data cleared');
    return true;
  } catch (error) {
    logger.error('Error clearing onboarding steps:', error);
    return false;
  }
}

/**
 * Get onboarding status summary
 * @returns {Object} Status object
 */
function getOnboardingStatus() {
  return {
    completed: isOnboardingComplete(),
    version: getOnboardingVersion(),
    currentVersion: CURRENT_ONBOARDING_VERSION,
    isFreshInstall: isFreshInstall(),
    userCount: database.getAllUsers().length
  };
}

/**
 * Validate onboarding completion requirements
 * @returns {Object} { valid: boolean, missing: string[] }
 */
function validateOnboardingRequirements() {
  const missing = [];

  try {
    // Check if admin user exists
    const users = database.getAllUsers();
    if (users.length === 0) {
      missing.push('Admin user not created');
    }

    // Check if any user has 2FA enabled
    const has2FA = users.some(u => u.totp_enabled === 1);
    if (!has2FA) {
      missing.push('2FA not enabled for admin');
    }

    // Check if refresh interval is set
    const refreshInterval = database.getSetting('metrics_refresh_interval');
    if (!refreshInterval) {
      missing.push('Metrics refresh interval not configured');
    }

    return {
      valid: missing.length === 0,
      missing
    };
  } catch (error) {
    logger.error('Error validating onboarding requirements:', error);
    return {
      valid: false,
      missing: ['Error validating requirements']
    };
  }
}

module.exports = {
  ONBOARDING_KEY,
  CURRENT_ONBOARDING_VERSION,
  isOnboardingComplete,
  completeOnboarding,
  resetOnboarding,
  getOnboardingVersion,
  isFreshInstall,
  saveOnboardingStep,
  getOnboardingStep,
  clearOnboardingSteps,
  getOnboardingStatus,
  validateOnboardingRequirements
};
