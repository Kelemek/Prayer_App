import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GitHubFeedbackService } from './github-feedback.service';

describe('GitHubFeedbackService', () => {
  let service: GitHubFeedbackService;
  let mockSupabaseService: any;
  let mockSelect: any;
  let mockUpdate: any;

  beforeEach(() => {
    // Create mock chain for select query
    mockSelect = {
      eq: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({
          data: {
            github_token: 'ghp_test123',
            github_repo_owner: 'test-owner',
            github_repo_name: 'test-repo',
            enabled: true
          },
          error: null
        })
      })
    };

    // Create mock chain for update query
    mockUpdate = {
      eq: vi.fn().mockResolvedValue({
        data: null,
        error: null
      })
    };

    // Mock Supabase service
    mockSupabaseService = {
      client: {
        from: vi.fn().mockImplementation((table: string) => {
          if (table === 'admin_settings') {
            return {
              select: vi.fn().mockReturnValue(mockSelect),
              update: vi.fn().mockReturnValue(mockUpdate)
            };
          }
          return null;
        })
      }
    };

    // Create service with mocked dependencies
    service = new GitHubFeedbackService(mockSupabaseService);

    // Mock global fetch
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('getGitHubConfig', () => {
    it('should fetch GitHub configuration from admin_settings table', async () => {
      const config = await service.getGitHubConfig();

      expect(mockSupabaseService.client.from).toHaveBeenCalledWith('admin_settings');
      expect(config?.github_token).toBe('ghp_test123');
      expect(config?.github_repo_owner).toBe('test-owner');
      expect(config?.github_repo_name).toBe('test-repo');
      expect(config?.enabled).toBe(true);
    });

    it('should return null if configuration not found', async () => {
      mockSelect.eq.mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({
          data: null,
          error: null
        })
      });

      const config = await service.getGitHubConfig();

      expect(config).toBeNull();
    });

    it('should handle database errors gracefully', async () => {
      mockSelect.eq.mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({
          data: null,
          error: new Error('Database error')
        })
      });

      const config = await service.getGitHubConfig();

      expect(config).toBeNull();
    });
  });

  describe('saveGitHubConfig', () => {
    it('should save GitHub configuration to database', async () => {
      const configToSave = {
        enabled: true,
        github_token: 'ghp_newsecret123',
        github_repo_owner: 'newuser',
        github_repo_name: 'newrepo'
      };

      const result = await service.saveGitHubConfig(configToSave);

      expect(mockSupabaseService.client.from).toHaveBeenCalledWith('admin_settings');
      expect(result).toBe(true);
    });

    it('should return false if save fails', async () => {
      mockUpdate.eq.mockResolvedValue({
        data: null,
        error: new Error('Save failed')
      });

      const configToSave = {
        enabled: true,
        github_token: 'ghp_test123',
        github_repo_owner: 'test-owner',
        github_repo_name: 'test-repo'
      };

      const result = await service.saveGitHubConfig(configToSave);

      expect(result).toBe(false);
    });

    it('should handle exceptions during save', async () => {
      mockSupabaseService.client.from.mockImplementation(() => {
        throw new Error('Connection error');
      });

      const configToSave = {
        enabled: true,
        github_token: 'ghp_test123',
        github_repo_owner: 'test-owner',
        github_repo_name: 'test-repo'
      };

      const result = await service.saveGitHubConfig(configToSave);

      expect(result).toBe(false);
    });
  });

  describe('createGitHubIssue', () => {
    beforeEach(() => {
      // Mock successful GitHub API response
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          html_url: 'https://github.com/test-owner/test-repo/issues/1'
        })
      });
    });

    it('should create a GitHub issue with correct format', async () => {
      const payload = {
        title: 'Test Bug',
        body: 'This is a test bug',
        type: 'bug' as const,
        userEmail: 'test@example.com',
        userName: 'John Doe'
      };

      const result = await service.createGitHubIssue(payload);

      expect(result.success).toBe(true);
      expect(result.url).toBe('https://github.com/test-owner/test-repo/issues/1');
      expect(global.fetch).toHaveBeenCalled();
    });

    it('should return error when GitHub is not configured', async () => {
      mockSelect.eq.mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({
          data: null,
          error: null
        })
      });

      const payload = {
        title: 'Test',
        body: 'Test',
        type: 'suggestion' as const,
        userEmail: 'test@example.com'
      };

      const result = await service.createGitHubIssue(payload);

      expect(result.success).toBe(false);
      expect(result.error).toContain('not configured');
    });

    it('should handle API errors from GitHub', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: false,
        json: vi.fn().mockResolvedValue({
          message: 'Invalid token'
        })
      });

      const payload = {
        title: 'Test',
        body: 'Test',
        type: 'suggestion' as const,
        userEmail: 'test@example.com',
        userName: 'Test User'
      };

      const result = await service.createGitHubIssue(payload);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should include correct labels based on issue type', async () => {
      const payload = {
        title: 'Test Bug',
        body: 'Test',
        type: 'bug' as const,
        userEmail: 'test@example.com',
        userName: 'Test User'
      };

      await service.createGitHubIssue(payload);

      const callArgs = (global.fetch as any).mock.calls[0];
      const requestBody = JSON.parse(callArgs[1].body);

      expect(requestBody.labels).toContain('bug');
    });

    it('should handle network errors', async () => {
      (global.fetch as any).mockRejectedValue(new Error('Network error'));

      const payload = {
        title: 'Test',
        body: 'Test',
        type: 'suggestion' as const,
        userEmail: 'test@example.com',
        userName: 'Test User'
      };

      const result = await service.createGitHubIssue(payload);

      expect(result.success).toBe(false);
    });

    it('should include user name in issue body', async () => {
      const payload = {
        title: 'Test Feature',
        body: 'Test body content',
        type: 'feature' as const,
        userEmail: 'jane@example.com',
        userName: 'Jane Smith'
      };

      await service.createGitHubIssue(payload);

      const callArgs = (global.fetch as any).mock.calls[0];
      const requestBody = JSON.parse(callArgs[1].body);

      expect(requestBody.body).toContain('Jane Smith');
      expect(requestBody.body).toContain('jane@example.com');
    });
  });

  describe('testGitHubConnection', () => {
    beforeEach(() => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ id: 12345 })
      });
    });

    it('should test GitHub connection successfully', async () => {
      const result = await service.testGitHubConnection('ghp_test123', 'test-owner', 'test-repo');

      expect(result.success).toBe(true);
      expect(global.fetch).toHaveBeenCalled();
    });

    it('should return error when token is missing and no config fallback', async () => {
      // When both token param and config are missing/empty
      mockSelect.eq.mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({
          data: {
            github_token: '',
            github_repo_owner: '',
            github_repo_name: '',
            enabled: false
          },
          error: null
        })
      });

      const result = await service.testGitHubConnection('', '', '');

      expect(result.success).toBe(false);
      expect(result.message).toContain('token');
    });

    it('should return error when repository info is missing', async () => {
      // When both repo params and config are missing
      mockSelect.eq.mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({
          data: {
            github_token: 'ghp_test123',
            github_repo_owner: '',
            github_repo_name: '',
            enabled: true
          },
          error: null
        })
      });

      const result = await service.testGitHubConnection('ghp_test123', '', '');

      expect(result.success).toBe(false);
      expect(result.message).toContain('Repository');
    });

    it('should handle GitHub API errors', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: false,
        json: vi.fn().mockResolvedValue({
          message: 'Not Found'
        })
      });

      const result = await service.testGitHubConnection('ghp_test123', 'invalid-owner', 'invalid-repo');

      expect(result.success).toBe(false);
    });

    it('should use config values as fallback when parameters not provided', async () => {
      const result = await service.testGitHubConnection();

      expect(result.success).toBe(true);
      expect(global.fetch).toHaveBeenCalled();
    });

    it('should handle network errors', async () => {
      (global.fetch as any).mockRejectedValue(new Error('Network unreachable'));

      const result = await service.testGitHubConnection('ghp_test123', 'test-owner', 'test-repo');

      expect(result.success).toBe(false);
    });
  });

  describe('fetchWithTimeout', () => {
    it('should successfully fetch data within timeout', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ data: 'test' })
      });

      const result = await (service as any).fetchWithTimeout('https://api.github.com/test', {
        method: 'GET'
      });

      expect(result.ok).toBe(true);
    });
  });
});
