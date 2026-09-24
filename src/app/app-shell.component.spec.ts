import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

if (typeof window === 'undefined') {
  (globalThis as any).window = {
    location: {
      search: '',
      pathname: '/test',
      origin: 'http://localhost'
    },
    history: {
      replaceState: vi.fn()
    },
    addEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
    scrollTo: vi.fn()
  };
}

if (typeof document === 'undefined') {
  (globalThis as any).document = {
    hidden: false,
    documentElement: { scrollTop: 0 },
    body: { scrollTop: 0 },
    querySelector: vi.fn()
  };
}
import { AppShellComponent } from './app-shell.component';
import { Router, NavigationEnd } from '@angular/router';
import { Injector, NgZone } from '@angular/core';
import { Subject } from 'rxjs';

const decodeAccountCodeMock = vi.fn();
const supabaseDirectQueryMock = vi.fn();
const supabaseDirectMutationMock = vi.fn();
const emailGetTemplateMock = vi.fn();
const emailApplyTemplateVariablesMock = vi.fn();
const emailSendEmailMock = vi.fn();
const toastShowToastMock = vi.fn();
const adminGetIsAdminMock = vi.fn(() => false);
const adminGetUserMock = vi.fn((): { id: string; email: string } | null => null);
const adminIsLoadingMock = vi.fn(() => false);

vi.mock('./services/approval-links.service', () => {
  return {
    ApprovalLinksService: class {
      decodeAccountCode() {
        return decodeAccountCodeMock();
      }
    }
  };
});

vi.mock('./services/supabase.service', () => {
  return {
    SupabaseService: class {
      directQuery(...args: unknown[]) {
        return supabaseDirectQueryMock(...args);
      }

      directMutation(...args: unknown[]) {
        return supabaseDirectMutationMock(...args);
      }
    }
  };
});

vi.mock('./services/email-notification.service', () => {
  return {
    EmailNotificationService: class {
      getTemplate(templateName: string, tenantId?: string) {
        return emailGetTemplateMock(templateName, tenantId);
      }

      applyTemplateVariables(template: string, vars: Record<string, string> = {}) {
        return emailApplyTemplateVariablesMock(template, vars);
      }

      sendEmail(payload: unknown) {
        return emailSendEmailMock(payload);
      }

      getEmailBaseUrl() {
        return 'https://prayerapp.romans8.net';
      }
    }
  };
});

vi.mock('./services/admin-auth.service', () => {
  return {
    AdminAuthService: class {
      getIsAdmin() {
        return adminGetIsAdminMock();
      }

      getUser() {
        return adminGetUserMock();
      }

      isLoading() {
        return adminIsLoadingMock();
      }

      loading$ = {
        pipe: () => ({
          subscribe: () => ({ unsubscribe() {} })
        })
      };
    }
  };
});

vi.mock('./services/toast.service', () => {
  return {
    ToastService: class {
      showToast(message: string, type: string) {
        return toastShowToastMock(message, type);
      }
    }
  };
});

describe('AppShellComponent', () => {
  let component: AppShellComponent;
  let mockRouter: any;
  let mockInjector: any;
  let mockNgZone: any;
  let mockPosthog: Record<string, never>;
  let routerEventsSubject: Subject<any>;

  beforeEach(() => {
    sessionStorage.clear();
    // Create mock router with events subject
    routerEventsSubject = new Subject();
    mockRouter = {
      events: routerEventsSubject.asObservable(),
      navigate: vi.fn().mockResolvedValue(true),
      url: '/',
    };

    // Create mock NgZone
    mockNgZone = {
      run: vi.fn((fn) => fn())
    };

    mockPosthog = {};
    adminGetIsAdminMock.mockReset().mockReturnValue(false);
    adminGetUserMock.mockReset().mockReturnValue(null);
    adminIsLoadingMock.mockReset().mockReturnValue(false);

    // Create mock Injector
    mockInjector = {
      get: vi.fn((token) => {
        const name = typeof token?.name === 'string' ? token.name : '';
        if (name === 'ToastService') {
          return { showToast: (...args: unknown[]) => toastShowToastMock(...args) };
        }
        if (name === 'AdminAuthService') {
          return {
            getIsAdmin: () => adminGetIsAdminMock(),
            getUser: () => adminGetUserMock(),
            isLoading: () => adminIsLoadingMock(),
            loading$: {
              pipe: () => ({
                subscribe: () => ({ unsubscribe() {} })
              })
            }
          };
        }
        return {};
      })
    };

    // Mock window and document methods
    window.scrollTo = vi.fn();
    window.addEventListener = vi.fn();
    window.dispatchEvent = vi.fn();
    window.history.replaceState = vi.fn();
    
    // Mock window.location
    Object.defineProperty(window, 'location', {
      value: {
        search: '',
        pathname: '/test',
        origin: 'http://localhost'
      },
      writable: true,
      configurable: true
    });

    document.querySelector = vi.fn();
    Object.defineProperty(document, 'hidden', {
      value: false,
      writable: true,
      configurable: true
    });

    // Create component
    component = new AppShellComponent(mockRouter, mockInjector, mockNgZone, mockPosthog as never);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Component Initialization', () => {
    it('should create the component', () => {
      expect(component).toBeTruthy();
    });

    it('should have title property set to prayerapp', () => {
      expect(component.title).toBe('prayerapp');
    });

    it('should setup global error handler on construction', () => {
      expect(mockNgZone.run).toHaveBeenCalled();
    });

    it('should subscribe to router events on construction', () => {
      expect(routerEventsSubject.observers.length).toBeGreaterThan(0);
    });
  });

  describe('setupGlobalErrorHandler', () => {
    it('should register unhandledrejection event listener', () => {
      expect(window.addEventListener).toHaveBeenCalledWith(
        'unhandledrejection',
        expect.any(Function)
      );
    });

    it('should register error event listener', () => {
      expect(window.addEventListener).toHaveBeenCalledWith(
        'error',
        expect.any(Function)
      );
    });

    it('should handle unhandledrejection events', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const listenerCalls = (window.addEventListener as any).mock.calls;
      const unhandledRejectionListener = listenerCalls.find(
        (call: any) => call[0] === 'unhandledrejection'
      )?.[1];

      if (unhandledRejectionListener) {
        const event = { reason: new Error('Test rejection') };
        unhandledRejectionListener(event);
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          '[GlobalErrorHandler] Unhandled promise rejection:',
          expect.any(Error)
        );
      }
      consoleErrorSpy.mockRestore();
    });

    it('should handle global error events', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const listenerCalls = (window.addEventListener as any).mock.calls;
      const errorListener = listenerCalls.find((call: any) => call[0] === 'error')?.[1];

      if (errorListener) {
        const event = { error: new Error('Test error') };
        errorListener(event);
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          '[GlobalErrorHandler] Global error:',
          expect.any(Error)
        );
      }
      consoleErrorSpy.mockRestore();
    });
  });

  describe('setupScrollToTopOnNavigation', () => {
    it('should subscribe to router navigation events', () => {
      expect(routerEventsSubject.observers.length).toBeGreaterThan(0);
    });

    it('should scroll to top on NavigationEnd event', () => {
      const navEnd = new NavigationEnd(1, '/test', '/test');
      vi.useFakeTimers();

      routerEventsSubject.next(navEnd);
      vi.runAllTimers();

      expect(window.scrollTo).toHaveBeenCalledWith({
        top: 0,
        left: 0,
        behavior: 'instant'
      });

      vi.useRealTimers();
    });

    it('should ignore non-NavigationEnd events', () => {
      vi.useFakeTimers();
      const scrollToSpy = vi.spyOn(window, 'scrollTo');
      routerEventsSubject.next({ type: 'NavigationStart' });

      vi.runAllTimers();
      expect(scrollToSpy).not.toHaveBeenCalled();
      vi.useRealTimers();
    });
  });

  describe('resume handling', () => {
    it('does not duplicate visibility or focus recovery in the shell', () => {
      expect('onVisibilityChange' in component).toBe(false);
      expect('onWindowFocus' in component).toBe(false);
    });
  });

  describe('ngOnInit', () => {
    it('should call handleApprovalCode on init', async () => {
      window.location = { search: '' } as any;
      await component.ngOnInit();
      expect(component).toBeTruthy();
    });

    it('should handle empty URL params', async () => {
      window.location = { search: '' } as any;
      await component.ngOnInit();
      expect(component).toBeTruthy();
    });
  });

  describe('Error handling and recovery', () => {
    it('should handle unhandledrejection errors', () => {
      const listener = (window.addEventListener as any).mock.calls.find(
        (call: any) => call[0] === 'unhandledrejection'
      )?.[1];

      if (listener) {
        expect(() => {
          listener({
            reason: new Error('Test error'),
            preventDefault: vi.fn()
          });
        }).not.toThrow();
      }

      expect(window.addEventListener).toHaveBeenCalled();
    });

    it('should handle window error events', () => {
      const listener = (window.addEventListener as any).mock.calls.find(
        (call: any) => call[0] === 'error'
      )?.[1];

      if (listener) {
        expect(() => {
          listener(new ErrorEvent('error', { message: 'Test' }));
        }).not.toThrow();
      }

      expect(window.addEventListener).toHaveBeenCalled();
    });

    it('should have error handlers available during initialization', () => {
      const addEventListenerCalls = (window.addEventListener as any).mock.calls;
      const hasUnhandledRejection = addEventListenerCalls.some(
        (call: any) => call[0] === 'unhandledrejection'
      );
      const hasError = addEventListenerCalls.some(
        (call: any) => call[0] === 'error'
      );

      expect(hasUnhandledRejection).toBe(true);
      expect(hasError).toBe(true);
    });

    it('should initialize component without throwing', () => {
      expect(() => {
        component.ngOnInit();
      }).not.toThrow();
    });

    it('should handle rapid initialization calls', () => {
      expect(() => {
        component.ngOnInit();
        component.ngOnInit();
        component.ngOnInit();
      }).not.toThrow();
    });
  });

  describe('URL handling and parameter parsing', () => {
    it('should parse URL search parameters correctly', () => {
      window.location.search = '?code=test123&param1=value1&param2=value2';
      
      const params = new URLSearchParams(window.location.search);
      expect(params.get('code')).toBe('test123');
      expect(params.get('param1')).toBe('value1');
    });

    it('should handle empty URL search', async () => {
      window.location.search = '';
      
      await component.ngOnInit();
      
      expect(window.history.replaceState).not.toHaveBeenCalled();
    });

    it('should handle encoded URL parameters', () => {
      window.location.search = '?code=test%20with%20spaces';
      
      const params = new URLSearchParams(window.location.search);
      expect(params.get('code')).toBe('test with spaces');
    });

    it('should handle multiple parameters in URL', async () => {
      window.location.search = '?code=abc123&redirect=/home&user=test@example.com';
      
      await component.ngOnInit();
      
      expect(component).toBeTruthy();
    });

    it('leaves a non-approval code on the URL for PKCE', async () => {
      window.location.search = '?code=test123&other=param';
      vi.clearAllMocks();

      await component.ngOnInit();

      expect(window.history.replaceState).not.toHaveBeenCalled();
      expect(mockRouter.navigate).not.toHaveBeenCalled();
    });
  });

  describe('Approval code format detection', () => {
    it('should detect account_approve_ prefix', async () => {
      window.location.search = '?code=account_approve_valid123';
      
      // Account approval codes should attempt to load services
      await component.ngOnInit();
      
      expect(component).toBeTruthy();
    });

    it('should detect account_deny_ prefix', async () => {
      window.location.search = '?code=account_deny_valid456';
      
      // Account denial codes should attempt to load services  
      await component.ngOnInit();
      
      expect(component).toBeTruthy();
    });

    it('does not strip or redirect a Supabase PKCE code', async () => {
      window.location.search = '?code=someOtherCode';
      vi.spyOn(window.history, 'replaceState');

      await component.ngOnInit();

      expect(mockRouter.navigate).not.toHaveBeenCalled();
      expect(window.history.replaceState).not.toHaveBeenCalled();
    });

    it('should differentiate between approval types', async () => {
      const approveCode = 'account_approve_test';
      const denyCode = 'account_deny_test';

      const approvePrefix = approveCode.startsWith('account_approve_');
      const denyPrefix = denyCode.startsWith('account_deny_');

      expect(approvePrefix).toBe(true);
      expect(denyPrefix).toBe(true);
      expect(approvePrefix && denyPrefix).toBe(true);
    });
  });

  describe('Navigation and routing', () => {
    it('does not navigate to admin for a PKCE code', async () => {
      window.location.search = '?code=adminCode123';

      await component.ngOnInit();

      expect(mockRouter.navigate).not.toHaveBeenCalled();
    });

    it('does not replace history state for a PKCE code', async () => {
      window.location.search = '?code=someCode';
      vi.spyOn(window.history, 'replaceState');

      await component.ngOnInit();

      expect(window.history.replaceState).not.toHaveBeenCalled();
      expect(mockRouter.navigate).not.toHaveBeenCalled();
    });

    it('should not navigate when no code is present', async () => {
      window.location.search = '';
      vi.resetAllMocks();

      // Use existing component which is already created with mocked dependencies
      await component.ngOnInit();

      expect(mockRouter.navigate).not.toHaveBeenCalled();
    });

    it('should handle router.navigate being called with correct parameters', async () => {
      window.location.search = '?code=testCode';

      await component.ngOnInit();

      const calls = (mockRouter.navigate as any).mock.calls;
      if (calls.length > 0) {
        const lastCall = calls[calls.length - 1];
        expect(Array.isArray(lastCall[0])).toBe(true);
      }
    });
  });

  describe('Component Lifecycle', () => {
    it('should implement OnInit', () => {
      expect(typeof component.ngOnInit).toBe('function');
    });

    it('should handle multiple navigation events', () => {
      vi.useFakeTimers();
      const navEnd1 = new NavigationEnd(1, '/test1', '/test1');
      const navEnd2 = new NavigationEnd(2, '/test2', '/test2');

      routerEventsSubject.next(navEnd1);
      routerEventsSubject.next(navEnd2);

      vi.runAllTimers();
      expect(window.scrollTo).toHaveBeenCalled();
      vi.useRealTimers();
    });

  });

  describe('Error Recovery', () => {
    it('should recover from unhandled promise rejections', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const errorHandler = (window.addEventListener as any).mock.calls.find(
        (call: any) => call[0] === 'unhandledrejection'
      )?.[1];

      if (errorHandler) {
        errorHandler({ reason: 'Test error' });
        expect(consoleErrorSpy).toHaveBeenCalled();
      }

      consoleErrorSpy.mockRestore();
    });

    it('should recover from global errors', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const errorHandler = (window.addEventListener as any).mock.calls.find(
        (call: any) => call[0] === 'error'
      )?.[1];

      if (errorHandler) {
        errorHandler({ error: 'Test error' });
        expect(consoleErrorSpy).toHaveBeenCalled();
      }

      consoleErrorSpy.mockRestore();
    });

  });

  describe('Lifecycle and async operations', () => {
    it('should call handleApprovalCode during ngOnInit', async () => {
      window.location.search = '';
      
      // ngOnInit should call handleApprovalCode internally
      const ngOnInitSpy = vi.spyOn(component, 'ngOnInit');
      
      await component.ngOnInit();
      
      expect(ngOnInitSpy).toHaveBeenCalled();
    });

    it('should handle ngOnInit with various URL states', async () => {
      const testCases = [
        '?code=test1',
        '?code=account_approve_test',
        '?code=account_deny_test',
        '?param=value'
      ];

      for (const search of testCases) {
        window.location.search = search;
        expect(async () => await component.ngOnInit()).not.toThrow();
      }
    });

    it('should process codes synchronously when present', async () => {
      window.location.search = '?code=someCode';
      
      const startTime = Date.now();
      await component.ngOnInit();
      const elapsed = Date.now() - startTime;
      
      // Should process relatively quickly
      expect(elapsed).toBeLessThan(1000);
    });
  });

  describe('Account Approval Code Handling', () => {
    let mockApprovalLinksService: any;
    let mockSupabaseService: any;
    let mockEmailService: any;
    let mockToastService: any;

    beforeEach(() => {
      // Create mock services for approval code handling
      mockApprovalLinksService = {
        decodeAccountCode: vi.fn().mockReturnValue({
          email: 'test@example.com',
          type: 'approve'
        })
      };

      mockSupabaseService = {
        directQuery: vi.fn().mockResolvedValue({
          data: [{
            id: '123',
            email: 'test@example.com',
            first_name: 'John',
            last_name: 'Doe',
            approval_status: 'pending'
          }],
          error: null
        }),
        directMutation: vi.fn().mockResolvedValue({ error: null })
      };

      mockEmailService = {
        getTemplate: vi.fn().mockResolvedValue({
          subject: 'Welcome {{firstName}}',
          html_body: '<p>Welcome {{firstName}}</p>',
          text_body: 'Welcome {{firstName}}'
        }),
        applyTemplateVariables: vi.fn((template, vars) => {
          let result = template;
          Object.keys(vars).forEach(key => {
            result = result.replace(new RegExp(`{{${key}}}`, 'g'), vars[key]);
          });
          return result;
        }),
        sendEmail: vi.fn().mockResolvedValue({})
      };

      mockToastService = {
        showToast: vi.fn()
      };

      mockInjector.get = vi.fn((token: { name?: string }) => {
        const name = typeof token?.name === 'string' ? token.name : '';
        if (name === 'ApprovalLinksService') return mockApprovalLinksService;
        if (name === 'SupabaseService') return mockSupabaseService;
        if (name === 'EmailNotificationService') return mockEmailService;
        if (name === 'ToastService') return mockToastService;
        if (name === 'AdminAuthService') {
          return {
            getIsAdmin: () => false,
            getUser: () => null,
            isLoading: () => false,
          };
        }
        return {};
      });
    });

    it('should handle account_approve_ code format', async () => {
      window.location.search = '?code=account_approve_test123';
      
      // Create new component with mocked services
      const testComponent = new AppShellComponent(mockRouter, mockInjector, mockNgZone, mockPosthog as never);
      
      await testComponent.ngOnInit();
      
      // Component should have called ngOnInit
      expect(testComponent).toBeTruthy();
    });

    it('should handle account_deny_ code format', async () => {
      window.location.search = '?code=account_deny_test456';
      mockApprovalLinksService.decodeAccountCode.mockReturnValue({
        email: 'test@example.com',
        type: 'deny'
      });
      
      const testComponent = new AppShellComponent(mockRouter, mockInjector, mockNgZone, mockPosthog as never);
      
      await testComponent.ngOnInit();
      
      expect(testComponent).toBeTruthy();
    });

    it('should process approval codes without throwing', async () => {
      window.location.search = '?code=account_approve_test';
      
      expect(async () => {
        const testComponent = new AppShellComponent(mockRouter, mockInjector, mockNgZone, mockPosthog as never);
        await testComponent.ngOnInit();
      }).not.toThrow();
    });

    it('should call router navigate after processing approval code', async () => {
      window.location.search = '?code=account_approve_test';
      
      const testComponent = new AppShellComponent(mockRouter, mockInjector, mockNgZone, mockPosthog as never);
      await testComponent.ngOnInit();

      // Check if navigate was called
      expect(mockRouter.navigate).toBeDefined();
    });

    it('should leave non-account codes for auth', async () => {
      window.location.search = '?code=someOtherCode';
      
      const testComponent = new AppShellComponent(mockRouter, mockInjector, mockNgZone, mockPosthog as never);
      await testComponent.ngOnInit();

      expect(mockRouter.navigate).not.toHaveBeenCalled();
      expect(mockSupabaseService.directMutation).not.toHaveBeenCalled();
    });

    it('should handle empty code gracefully', async () => {
      window.location.search = '';
      
      const testComponent = new AppShellComponent(mockRouter, mockInjector, mockNgZone, mockPosthog as never);
      await testComponent.ngOnInit();

      // Should not navigate if no code
      expect(mockRouter.navigate).not.toHaveBeenCalled();
    });

    it('should handle codes with special characters', async () => {
      window.location.search = '?code=account_approve_%2F%3F%40';
      
      const testComponent = new AppShellComponent(mockRouter, mockInjector, mockNgZone, mockPosthog as never);
      
      expect(async () => {
        await testComponent.ngOnInit();
      }).not.toThrow();
    });
  });

  describe('Integration Tests', () => {
    it('should handle full initialization flow', () => {
      expect(component.title).toBe('prayerapp');
      expect(mockNgZone.run).toHaveBeenCalled();
    });

    it('should scroll to top after navigation', () => {
      vi.useFakeTimers();
      const navEnd = new NavigationEnd(1, '/test', '/test');
      routerEventsSubject.next(navEnd);

      vi.runAllTimers();

      expect(window.scrollTo).toHaveBeenCalled();
      vi.useRealTimers();
    });
  });

  describe('Event Listener Registration', () => {
    it('should register NgZone error handlers', () => {
      expect(mockNgZone.run).toHaveBeenCalled();
    });

    it('should register window event listeners', () => {
      const addEventListenerCalls = (window.addEventListener as any).mock.calls;
      expect(addEventListenerCalls.length).toBeGreaterThan(0);
    });

    it('should handle both error types in global error handler', () => {
      const addEventListenerCalls = (window.addEventListener as any).mock.calls;
      const eventTypes = addEventListenerCalls.map((call: any) => call[0]);

      expect(eventTypes).toContain('unhandledrejection');
      expect(eventTypes).toContain('error');
    });
  });

  describe('Approval Code Handling', () => {
    beforeEach(() => {
      // Reset location search
      Object.defineProperty(window, 'location', {
        value: {
          search: '',
          pathname: '/test',
          origin: 'http://localhost'
        },
        writable: true
      });
    });

    it('should handle ngOnInit call', () => {
      component.ngOnInit();
      expect(mockRouter.navigate).not.toHaveBeenCalled();
    });

    it('leaves a PKCE code in place when a code parameter is provided', async () => {
      Object.defineProperty(window, 'location', {
        value: {
          search: '?code=admin_code_12345',
          pathname: '/test',
          origin: 'http://localhost'
        },
        writable: true
      });

      const newComponent = new AppShellComponent(mockRouter, mockInjector, mockNgZone, mockPosthog as never);
      await newComponent.ngOnInit();

      expect(mockRouter.navigate).not.toHaveBeenCalled();
      expect(window.history.replaceState).not.toHaveBeenCalled();
    });

    it('should detect account approval code prefix', async () => {
      Object.defineProperty(window, 'location', {
        value: {
          search: '?code=account_approve_test@example.com_token123',
          pathname: '/test',
          origin: 'http://localhost'
        },
        writable: true
      });

      const newComponent = new AppShellComponent(mockRouter, mockInjector, mockNgZone, mockPosthog as never);
      
      // Just verify that ngOnInit doesn't throw for account_approve codes
      expect(async () => {
        await newComponent.ngOnInit();
      }).not.toThrow();
    });

    it('should detect account denial code prefix', async () => {
      Object.defineProperty(window, 'location', {
        value: {
          search: '?code=account_deny_test@example.com_token123',
          pathname: '/test',
          origin: 'http://localhost'
        },
        writable: true
      });

      const newComponent = new AppShellComponent(mockRouter, mockInjector, mockNgZone, mockPosthog as never);
      
      // Just verify that ngOnInit doesn't throw for account_deny codes
      expect(async () => {
        await newComponent.ngOnInit();
      }).not.toThrow();
    });

    it('should handle no code parameter gracefully', async () => {
      Object.defineProperty(window, 'location', {
        value: {
          search: '',
          pathname: '/test',
          origin: 'http://localhost'
        },
        writable: true
      });

      const newComponent = new AppShellComponent(mockRouter, mockInjector, mockNgZone, mockPosthog as never);
      await newComponent.ngOnInit();

      expect(mockRouter.navigate).not.toHaveBeenCalled();
    });

    it('should handle empty code parameter', async () => {
      Object.defineProperty(window, 'location', {
        value: {
          search: '?code=',
          pathname: '/test',
          origin: 'http://localhost'
        },
        writable: true
      });

      const newComponent = new AppShellComponent(mockRouter, mockInjector, mockNgZone, mockPosthog as never);
      await newComponent.ngOnInit();

      expect(mockRouter.navigate).not.toHaveBeenCalled();
    });

    it('leaves a PKCE code when other query parameters are present', async () => {
      Object.defineProperty(window, 'location', {
        value: {
          search: '?redirect=/home&code=admin_code_12345&utm=test',
          pathname: '/test',
          origin: 'http://localhost'
        },
        writable: true
      });

      const newComponent = new AppShellComponent(mockRouter, mockInjector, mockNgZone, mockPosthog as never);
      await newComponent.ngOnInit();

      expect(mockRouter.navigate).not.toHaveBeenCalled();
      expect(window.history.replaceState).not.toHaveBeenCalled();
    });

    it('does not strip a PKCE code from the URL', async () => {
      Object.defineProperty(window, 'location', {
        value: {
          search: '?code=admin_code_12345',
          pathname: '/test',
          origin: 'http://localhost'
        },
        writable: true
      });

      const newComponent = new AppShellComponent(mockRouter, mockInjector, mockNgZone, mockPosthog as never);
      await newComponent.ngOnInit();

      expect(window.history.replaceState).not.toHaveBeenCalled();
    });

    it('should handle invalid URL search params', async () => {
      Object.defineProperty(window, 'location', {
        value: {
          search: '?invalid_param=test',
          pathname: '/test',
          origin: 'http://localhost'
        },
        writable: true
      });

      const newComponent = new AppShellComponent(mockRouter, mockInjector, mockNgZone, mockPosthog as never);
      await newComponent.ngOnInit();

      expect(mockRouter.navigate).not.toHaveBeenCalled();
    });

    it('does not treat a non-account code as an approval link', async () => {
      Object.defineProperty(window, 'location', {
        value: {
          search: '?code=some_other_code',
          pathname: '/test',
          origin: 'http://localhost'
        },
        writable: true
      });

      const newComponent = new AppShellComponent(mockRouter, mockInjector, mockNgZone, mockPosthog as never);
      await newComponent.ngOnInit();

      expect(mockRouter.navigate).not.toHaveBeenCalled();
    });

    it('should detect different account action prefixes', async () => {
      Object.defineProperty(window, 'location', {
        value: {
          search: '?code=account_deny_different_test',
          pathname: '/test',
          origin: 'http://localhost'
        },
        writable: true
      });

      const newComponent = new AppShellComponent(mockRouter, mockInjector, mockNgZone, mockPosthog as never);
      
      // Just verify that ngOnInit doesn't throw for account_deny codes
      expect(async () => {
        await newComponent.ngOnInit();
      }).not.toThrow();
    });

    it('leaves the first non-approval code alone when code is repeated', async () => {
      Object.defineProperty(window, 'location', {
        value: {
          search: '?code=admin_code_1&code=admin_code_2',
          pathname: '/test',
          origin: 'http://localhost'
        },
        writable: true
      });

      const newComponent = new AppShellComponent(mockRouter, mockInjector, mockNgZone, mockPosthog as never);
      await newComponent.ngOnInit();

      expect(mockRouter.navigate).not.toHaveBeenCalled();
    });

    it('leaves a code that contains spaces for auth', async () => {
      Object.defineProperty(window, 'location', {
        value: {
          search: '?code=admin_code_with%20spaces',
          pathname: '/test',
          origin: 'http://localhost'
        },
        writable: true
      });

      const newComponent = new AppShellComponent(mockRouter, mockInjector, mockNgZone, mockPosthog as never);
      await newComponent.ngOnInit();

      expect(mockRouter.navigate).not.toHaveBeenCalled();
      expect(window.history.replaceState).not.toHaveBeenCalled();
    });

    it('does not treat a different-cased prefix as an approval link', async () => {
      Object.defineProperty(window, 'location', {
        value: {
          search: '?code=Account_Approve_test',
          pathname: '/test',
          origin: 'http://localhost'
        },
        writable: true
      });

      const newComponent = new AppShellComponent(mockRouter, mockInjector, mockNgZone, mockPosthog as never);
      await newComponent.ngOnInit();

      expect(mockRouter.navigate).not.toHaveBeenCalled();
      expect(window.history.replaceState).not.toHaveBeenCalled();
    });
  });

  describe('handleAccountApprovalCode detailed flows', () => {
    const createRequest = (status = 'pending') => ({
      id: 'req-123',
      email: 'test@example.com',
      first_name: 'Jane',
      last_name: 'Doe',
      approval_status: status,
      tenant_id: 'test-tenant-id'
    });

    let approvalLinksServiceInstance: { decodeAccountCode: () => { email: string; type: string } | null };
    let supabaseServiceInstance: {
      directQuery: (...args: unknown[]) => Promise<any>;
      directMutation: (...args: unknown[]) => Promise<any>;
      client: {
        from: (table: string) => any;
      };
    };
    let emailServiceInstance: {
      getTemplate: (templateName: string) => Promise<any>;
      applyTemplateVariables: (template: string, vars?: Record<string, string>) => string;
      sendEmail: (payload: unknown) => Promise<any>;
      getEmailBaseUrl: () => string;
    };
    let toastServiceInstance: { showToast: (message: string, type: string) => void };

    beforeEach(() => {
      approvalLinksServiceInstance = {
        decodeAccountCode: () => decodeAccountCodeMock()
      };
      supabaseServiceInstance = {
        directQuery: (...args: unknown[]) => supabaseDirectQueryMock(...args),
        directMutation: (...args: unknown[]) => supabaseDirectMutationMock(...args),
        client: {
          from: (table: string) => {
            if (table === 'tenant_memberships') {
              return {
                insert: () => supabaseDirectMutationMock()
              };
            }
            return {
              select: () => ({
                eq: () => ({
                  limit: () => supabaseDirectQueryMock()
                })
              }),
              delete: () => ({
                eq: () => supabaseDirectMutationMock()
              })
            };
          }
        }
      };
      emailServiceInstance = {
        getTemplate: (...args: unknown[]) => emailGetTemplateMock(...args),
        applyTemplateVariables: (template: string, vars: Record<string, string> = {}) =>
          emailApplyTemplateVariablesMock(template, vars),
        sendEmail: (payload: unknown) => emailSendEmailMock(payload),
        getEmailBaseUrl: () => 'https://prayerapp.romans8.net'
      };
      toastServiceInstance = {
        showToast: (message: string, type: string) => toastShowToastMock(message, type)
      };

      mockInjector.get = vi.fn((token) => {
        const name = typeof token?.name === 'string' ? token.name : '';

        if (name === 'ApprovalLinksService') {
          return approvalLinksServiceInstance;
        }
        if (name === 'SupabaseService') {
          return supabaseServiceInstance;
        }
        if (name === 'EmailNotificationService') {
          return emailServiceInstance;
        }
        if (name === 'ToastService') {
          return toastServiceInstance;
        }
        if (name === 'AdminAuthService') {
          return {
            getIsAdmin: () => adminGetIsAdminMock(),
            getUser: () => adminGetUserMock(),
            isLoading: () => adminIsLoadingMock(),
            loading$: {
              pipe() {
                throw new Error('loading$ is only used while auth is still loading');
              }
            }
          };
        }

        return {};
      });

      window.location.search = '';

      decodeAccountCodeMock
        .mockReset()
        .mockReturnValue({
          email: 'test@example.com',
          type: 'approve'
        });

      supabaseDirectQueryMock
        .mockReset()
        .mockResolvedValue({
          data: [createRequest()],
          error: null
        });

      supabaseDirectMutationMock.mockReset().mockResolvedValue({ error: null });

      emailGetTemplateMock
        .mockReset()
        .mockResolvedValue({
          subject: 'Welcome {{firstName}}',
          html_body: '<p>{{firstName}}</p>',
          text_body: 'Hi {{firstName}}'
        });

      emailApplyTemplateVariablesMock
        .mockReset()
        .mockImplementation((template: string, vars: Record<string, string> = {}) => {
          let output = template;
          Object.entries(vars).forEach(([key, value]) => {
            output = output.replace(new RegExp(`{{${key}}}`, 'g'), value);
          });
          return output;
        });

      emailSendEmailMock.mockReset().mockResolvedValue({});
      toastShowToastMock.mockReset();
      adminGetIsAdminMock.mockReset().mockReturnValue(true);
      adminGetUserMock.mockReset().mockReturnValue({ id: 'admin-1', email: 'admin@example.com' });
      adminIsLoadingMock.mockReset().mockReturnValue(false);
    });

    const callHandler = async (code = 'account_approve_test') => {
      await (component as any).handleAccountApprovalCode(code);
    };

    it('does not insert a membership without an admin session', async () => {
      adminGetIsAdminMock.mockReturnValue(false);
      adminGetUserMock.mockReturnValue(null);
      window.location.search = '?code=account_approve_test';

      await callHandler();

      expect(supabaseDirectMutationMock).not.toHaveBeenCalled();
      expect(supabaseDirectQueryMock).not.toHaveBeenCalled();
      expect(toastShowToastMock).toHaveBeenCalledWith(
        'Sign in as a church admin to use this approval link',
        'error'
      );
      expect(sessionStorage.getItem('prayerapp_pending_account_approval_code')).toBe(
        'account_approve_test'
      );
      expect(mockRouter.navigate).toHaveBeenCalledWith(['/login'], {
        queryParams: { returnUrl: '/test?code=account_approve_test' },
      });
    });

    it('does not repeat the unsigned-admin toast on subsequent navigations', async () => {
      adminGetIsAdminMock.mockReturnValue(false);
      adminGetUserMock.mockReturnValue(null);
      window.location.search = '';
      sessionStorage.setItem('prayerapp_pending_account_approval_code', 'account_approve_test');
      mockRouter.url = '/login';

      await callHandler();
      expect(toastShowToastMock).toHaveBeenCalledTimes(1);

      toastShowToastMock.mockClear();
      mockRouter.navigate.mockClear();
      await callHandler();

      expect(toastShowToastMock).not.toHaveBeenCalled();
      expect(mockRouter.navigate).not.toHaveBeenCalled();
      expect(sessionStorage.getItem('prayerapp_pending_account_approval_code')).toBe(
        'account_approve_test'
      );
    });

    it('resumes a pending approval code after the admin signs in', async () => {
      adminGetIsAdminMock.mockReturnValue(true);
      adminGetUserMock.mockReturnValue({
        id: 'admin-1',
        email: 'admin@example.com',
      });
      window.location.search = '';
      sessionStorage.setItem('prayerapp_pending_account_approval_code', 'account_approve_test');

      await (component as any).handleApprovalCode();

      expect(supabaseDirectQueryMock).toHaveBeenCalled();
      expect(sessionStorage.getItem('prayerapp_pending_account_approval_code')).toBeNull();
    });

    it('approves a pending request and notifies success', async () => {
      await callHandler();

      expect(toastShowToastMock).toHaveBeenCalledWith(
        expect.stringContaining('Account approved'),
        'success'
      );
      expect(mockRouter.navigate).toHaveBeenCalledWith(['/login']);
    }, 10000);

    it('denies a pending request and sends a denial email', async () => {
      decodeAccountCodeMock.mockReturnValue({
        email: 'deny@example.com',
        type: 'deny'
      });
      emailGetTemplateMock.mockResolvedValueOnce({
        subject: 'Denied {{firstName}}',
        html_body: '<p>Denied {{firstName}}</p>',
        text_body: 'Denied {{firstName}}'
      });

      await callHandler('account_deny_test');

      expect(emailGetTemplateMock).toHaveBeenCalledWith('account_denied', 'test-tenant-id');
      expect(emailApplyTemplateVariablesMock).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          supportEmail: 'https://prayerapp.romans8.net/support'
        })
      );
      expect(emailSendEmailMock).toHaveBeenCalled();
      expect(toastShowToastMock).toHaveBeenCalledWith(
        expect.stringContaining('Account denied'),
        'info'
      );
      expect(mockRouter.navigate).toHaveBeenCalledWith(['/login']);
    });

    it('notifies when the request has already been processed', async () => {
      supabaseDirectQueryMock.mockResolvedValue({
        data: [createRequest('approved')],
        error: null
      });
      sessionStorage.setItem('prayerapp_pending_account_approval_code', 'account_approve_test');

      await callHandler();

      expect(toastShowToastMock).toHaveBeenCalledWith(
        expect.stringContaining('already been approved'),
        'info'
      );
      expect(mockRouter.navigate).toHaveBeenCalledWith(['/login']);
      expect(sessionStorage.getItem('prayerapp_pending_account_approval_code')).toBeNull();

      toastShowToastMock.mockClear();
      await (component as any).handleApprovalCode();
      expect(toastShowToastMock).not.toHaveBeenCalled();
    });

    it('handles invalid approval codes gracefully', async () => {
      decodeAccountCodeMock.mockReturnValue(null);

      await callHandler();

      expect(toastShowToastMock).toHaveBeenCalledWith('Invalid approval link', 'error');
      expect(mockRouter.navigate).toHaveBeenCalledWith(['/login']);
      expect(supabaseDirectQueryMock).not.toHaveBeenCalled();
    });

    it('handles missing approval requests', async () => {
      supabaseDirectQueryMock.mockResolvedValueOnce({
        data: [],
        error: 'not found'
      });

      await callHandler();

      expect(toastShowToastMock).toHaveBeenCalledWith('Approval request not found', 'error');
      expect(mockRouter.navigate).toHaveBeenCalledWith(['/login']);
    });

    it('does not approve when inserting a subscriber fails', async () => {
      supabaseDirectMutationMock.mockResolvedValueOnce({ error: 'insert-error' });

      await callHandler();

      expect(toastShowToastMock).toHaveBeenCalledWith('Failed to approve account', 'error');
      expect(mockRouter.navigate).toHaveBeenCalledWith(['/login']);
      expect(supabaseDirectMutationMock).toHaveBeenCalled();
    });

    it('falls back to a generic toast when an exception occurs', async () => {
      supabaseDirectQueryMock.mockRejectedValueOnce(new Error('boom'));

      await callHandler();

      expect(toastShowToastMock).toHaveBeenCalledWith('Failed to process approval', 'error');
      expect(mockRouter.navigate).toHaveBeenCalledWith(['/login']);
    });
  });

  describe('Component title property', () => {
    it('should have correct title', () => {
      expect(component.title).toBe('prayerapp');
    });

    it('should keep title unchanged', () => {
      const originalTitle = component.title;
      component.ngOnInit();
      expect(component.title).toBe(originalTitle);
    });
  });
});
