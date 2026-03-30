/**
 * Utility functions for managing user name and email in localStorage
 * This allows users to avoid re-entering their information across forms
 */

const USER_FIRST_NAME_KEY = 'prayerapp_user_first_name';
const USER_LAST_NAME_KEY = 'prayerapp_user_last_name';
const USER_EMAIL_KEY = 'prayerapp_user_email';

export interface UserInfo {
  firstName: string;
  lastName: string;
  email: string;
}

/**
 * Save user first name, last name, and email to localStorage
 */
export const saveUserInfo = (firstName: string, lastName: string, email: string): void => {
  try {
    if (firstName.trim()) {
      localStorage.setItem(USER_FIRST_NAME_KEY, firstName.trim());
    }
    if (lastName.trim()) {
      localStorage.setItem(USER_LAST_NAME_KEY, lastName.trim());
    }
    if (email.trim()) {
      localStorage.setItem(USER_EMAIL_KEY, email.trim());
    }
  } catch (error) {
    console.warn('Failed to save user info to localStorage:', error);
  }
};

/**
 * Retrieve saved user first name, last name, and email from localStorage
 */
export const getUserInfo = (): UserInfo => {
  try {
    const firstName = localStorage.getItem(USER_FIRST_NAME_KEY) || '';
    const lastName = localStorage.getItem(USER_LAST_NAME_KEY) || '';
    const email = localStorage.getItem(USER_EMAIL_KEY) || '';
    return { firstName, lastName, email };
  } catch (error) {
    console.warn('Failed to retrieve user info from localStorage:', error);
    return { firstName: '', lastName: '', email: '' };
  }
};

/**
 * Clear saved user info from localStorage
 */
export const clearUserInfo = (): void => {
  try {
    localStorage.removeItem(USER_FIRST_NAME_KEY);
    localStorage.removeItem(USER_LAST_NAME_KEY);
    localStorage.removeItem(USER_EMAIL_KEY);
  } catch (error) {
    console.warn('Failed to clear user info from localStorage:', error);
  }
};
