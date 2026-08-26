// utils/validators.js

/**
 * Checks if a string is exactly 10 digits.
 * @param {string} phone - The phone number string.
 * @returns {boolean} - True if valid, false otherwise.
 */
export const isValidPhone = (phone) => {
  if (!phone) return false;
  // Remove spaces, hyphens, and parentheses
  const cleaned = phone.replace(/[\s\-\(\)]/g, '');
  // Must be exactly 10 digits and only digits
  return /^\d{10}$/.test(cleaned);
};

/**
 * Checks if a string is a valid email address.
 * @param {string} email - The email string.
 * @returns {boolean} - True if valid, false otherwise.
 */
export const isValidEmail = (email) => {
  if (!email) return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
};

/**
 * Checks if a value is a valid positive number.
 * @param {string|number} value - The value to check.
 * @returns {boolean} - True if valid, false otherwise.
 */
export const isPositiveNumber = (value) => {
  if (value === null || value === undefined || value === '') return false;
  const num = Number(value);
  return !isNaN(num) && num > 0;
};
