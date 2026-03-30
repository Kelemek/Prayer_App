import { describe, it, expect, beforeEach, vi } from 'vitest';
import { saveUserInfo, getUserInfo, clearUserInfo, UserInfo } from './userInfoStorage';

describe('userInfoStorage', () => {
  // Mock localStorage
  const localStorageMock = (() => {
    let store: Record<string, string> = {};

    return {
      getItem: (key: string) => store[key] || null,
      setItem: (key: string, value: string) => {
        store[key] = value;
      },
      removeItem: (key: string) => {
        delete store[key];
      },
      clear: () => {
        store = {};
      },
    };
  })();

  beforeEach(() => {
    // Set up localStorage mock before each test
    global.localStorage = localStorageMock as any;
    localStorageMock.clear();
    
    // Reset console.warn spy
    vi.restoreAllMocks();
  });

  describe('saveUserInfo', () => {
    it('should save valid user info to localStorage', () => {
      const firstName = 'John';
      const lastName = 'Doe';
      const email = 'john.doe@example.com';

      saveUserInfo(firstName, lastName, email);

      expect(localStorage.getItem('prayerapp_user_first_name')).toBe(firstName);
      expect(localStorage.getItem('prayerapp_user_last_name')).toBe(lastName);
      expect(localStorage.getItem('prayerapp_user_email')).toBe(email);
    });

    it('should trim whitespace from user info before saving', () => {
      const firstName = '  John  ';
      const lastName = '  Doe  ';
      const email = '  john.doe@example.com  ';

      saveUserInfo(firstName, lastName, email);

      expect(localStorage.getItem('prayerapp_user_first_name')).toBe('John');
      expect(localStorage.getItem('prayerapp_user_last_name')).toBe('Doe');
      expect(localStorage.getItem('prayerapp_user_email')).toBe('john.doe@example.com');
    });

    it('should not save empty firstName after trimming', () => {
      saveUserInfo('   ', 'Doe', 'john.doe@example.com');

      expect(localStorage.getItem('prayerapp_user_first_name')).toBeNull();
      expect(localStorage.getItem('prayerapp_user_last_name')).toBe('Doe');
      expect(localStorage.getItem('prayerapp_user_email')).toBe('john.doe@example.com');
    });

    it('should not save empty lastName after trimming', () => {
      saveUserInfo('John', '   ', 'john.doe@example.com');

      expect(localStorage.getItem('prayerapp_user_first_name')).toBe('John');
      expect(localStorage.getItem('prayerapp_user_last_name')).toBeNull();
      expect(localStorage.getItem('prayerapp_user_email')).toBe('john.doe@example.com');
    });

    it('should not save empty email after trimming', () => {
      saveUserInfo('John', 'Doe', '   ');

      expect(localStorage.getItem('prayerapp_user_first_name')).toBe('John');
      expect(localStorage.getItem('prayerapp_user_last_name')).toBe('Doe');
      expect(localStorage.getItem('prayerapp_user_email')).toBeNull();
    });

    it('should not save any empty fields', () => {
      saveUserInfo('', '', '');

      expect(localStorage.getItem('prayerapp_user_first_name')).toBeNull();
      expect(localStorage.getItem('prayerapp_user_last_name')).toBeNull();
      expect(localStorage.getItem('prayerapp_user_email')).toBeNull();
    });

    it('should handle localStorage errors gracefully', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const setItemSpy = vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
        throw new Error('localStorage is full');
      });

      // Should not throw an error
      expect(() => saveUserInfo('John', 'Doe', 'john.doe@example.com')).not.toThrow();

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Failed to save user info to localStorage:',
        expect.any(Error)
      );

      setItemSpy.mockRestore();
      consoleWarnSpy.mockRestore();
    });
  });

  describe('getUserInfo', () => {
    it('should retrieve saved user info from localStorage', () => {
      localStorage.setItem('prayerapp_user_first_name', 'John');
      localStorage.setItem('prayerapp_user_last_name', 'Doe');
      localStorage.setItem('prayerapp_user_email', 'john.doe@example.com');

      const userInfo = getUserInfo();

      expect(userInfo).toEqual({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
      });
    });

    it('should return empty strings when no data exists', () => {
      const userInfo = getUserInfo();

      expect(userInfo).toEqual({
        firstName: '',
        lastName: '',
        email: '',
      });
    });

    it('should return partial data when some fields are missing', () => {
      localStorage.setItem('prayerapp_user_first_name', 'John');
      localStorage.setItem('prayerapp_user_email', 'john.doe@example.com');

      const userInfo = getUserInfo();

      expect(userInfo).toEqual({
        firstName: 'John',
        lastName: '',
        email: 'john.doe@example.com',
      });
    });

    it('should handle localStorage errors gracefully', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const getItemSpy = vi.spyOn(localStorage, 'getItem').mockImplementation(() => {
        throw new Error('localStorage is not available');
      });

      const userInfo = getUserInfo();

      expect(userInfo).toEqual({
        firstName: '',
        lastName: '',
        email: '',
      });

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Failed to retrieve user info from localStorage:',
        expect.any(Error)
      );

      getItemSpy.mockRestore();
      consoleWarnSpy.mockRestore();
    });
  });

  describe('clearUserInfo', () => {
    it('should clear all user info from localStorage', () => {
      localStorage.setItem('prayerapp_user_first_name', 'John');
      localStorage.setItem('prayerapp_user_last_name', 'Doe');
      localStorage.setItem('prayerapp_user_email', 'john.doe@example.com');

      clearUserInfo();

      expect(localStorage.getItem('prayerapp_user_first_name')).toBeNull();
      expect(localStorage.getItem('prayerapp_user_last_name')).toBeNull();
      expect(localStorage.getItem('prayerapp_user_email')).toBeNull();
    });

    it('should work when no user info exists', () => {
      // Should not throw an error
      expect(() => clearUserInfo()).not.toThrow();

      expect(localStorage.getItem('prayerapp_user_first_name')).toBeNull();
      expect(localStorage.getItem('prayerapp_user_last_name')).toBeNull();
      expect(localStorage.getItem('prayerapp_user_email')).toBeNull();
    });

    it('should handle localStorage errors gracefully', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const removeItemSpy = vi.spyOn(localStorage, 'removeItem').mockImplementation(() => {
        throw new Error('localStorage is not available');
      });

      // Should not throw an error
      expect(() => clearUserInfo()).not.toThrow();

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Failed to clear user info from localStorage:',
        expect.any(Error)
      );

      removeItemSpy.mockRestore();
      consoleWarnSpy.mockRestore();
    });
  });
});
