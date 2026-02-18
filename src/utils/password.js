const bcrypt = require('bcrypt');

/**
 * Password Validation and Hashing Utilities
 * For custom authentication system v2.2.8
 */

const SALT_ROUNDS = 10;

/**
 * Password requirements for Nexus
 */
const PASSWORD_REQUIREMENTS = {
  minLength: 8,
  requireUppercase: true,
  requireLowercase: true,
  requireNumber: true,
  requireSpecial: true,
  specialChars: '@$!%*?&'
};

/**
 * Validate password against requirements
 * @param {string} password - Password to validate
 * @returns {Object} { valid: boolean, errors: string[] }
 */
function validatePassword(password) {
  const errors = [];

  if (!password) {
    return { valid: false, errors: ['Password is required'] };
  }

  // Minimum length
  if (password.length < PASSWORD_REQUIREMENTS.minLength) {
    errors.push(`Password must be at least ${PASSWORD_REQUIREMENTS.minLength} characters long`);
  }

  // Uppercase letter
  if (PASSWORD_REQUIREMENTS.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  // Lowercase letter
  if (PASSWORD_REQUIREMENTS.requireLowercase && !/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  // Number
  if (PASSWORD_REQUIREMENTS.requireNumber && !/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  // Special character
  if (PASSWORD_REQUIREMENTS.requireSpecial) {
    const specialRegex = new RegExp(`[${PASSWORD_REQUIREMENTS.specialChars}]`);
    if (!specialRegex.test(password)) {
      errors.push(`Password must contain at least one special character (${PASSWORD_REQUIREMENTS.specialChars})`);
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Hash a password using bcrypt
 * @param {string} password - Plain text password
 * @returns {Promise<string>} Hashed password
 */
async function hashPassword(password) {
  return await bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Compare password with hash
 * @param {string} password - Plain text password
 * @param {string} hash - Hashed password
 * @returns {Promise<boolean>} True if password matches
 */
async function comparePassword(password, hash) {
  return await bcrypt.compare(password, hash);
}

/**
 * Check password strength and return score
 * @param {string} password - Password to check
 * @returns {Object} { score: number, strength: string, feedback: string[] }
 */
function checkPasswordStrength(password) {
  let score = 0;
  const feedback = [];

  if (!password) {
    return { score: 0, strength: 'Very Weak', feedback: ['Password is empty'] };
  }

  // Length scoring
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (password.length >= 16) score += 1;

  // Character diversity
  if (/[a-z]/.test(password)) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/[0-9]/.test(password)) score += 1;
  if (/[@$!%*?&]/.test(password)) score += 1;

  // Additional patterns
  if (/[^a-zA-Z0-9@$!%*?&]/.test(password)) {
    score += 1;
    feedback.push('Contains additional special characters');
  }

  // Common patterns (reduce score)
  if (/^[0-9]+$/.test(password)) {
    score -= 2;
    feedback.push('Avoid using only numbers');
  }
  if (/^[a-zA-Z]+$/.test(password)) {
    score -= 1;
    feedback.push('Include numbers and special characters');
  }
  if (/(.)\1{2,}/.test(password)) {
    score -= 1;
    feedback.push('Avoid repeating characters');
  }

  // Determine strength
  let strength;
  if (score <= 2) strength = 'Very Weak';
  else if (score <= 4) strength = 'Weak';
  else if (score <= 6) strength = 'Moderate';
  else if (score <= 8) strength = 'Strong';
  else strength = 'Very Strong';

  return { score, strength, feedback };
}

/**
 * Generate a random secure password
 * @param {number} length - Password length (default: 16)
 * @returns {string} Generated password
 */
function generateSecurePassword(length = 16) {
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const numbers = '0123456789';
  const special = '@$!%*?&';
  const allChars = uppercase + lowercase + numbers + special;

  let password = '';

  // Ensure at least one of each required type
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += special[Math.floor(Math.random() * special.length)];

  // Fill the rest randomly
  for (let i = password.length; i < length; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }

  // Shuffle the password
  return password.split('').sort(() => Math.random() - 0.5).join('');
}

module.exports = {
  PASSWORD_REQUIREMENTS,
  validatePassword,
  hashPassword,
  comparePassword,
  checkPasswordStrength,
  generateSecurePassword
};
