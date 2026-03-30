import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';

export interface GitHubIssueConfig {
  id: number;
  github_token: string;
  github_repo_owner: string;
  github_repo_name: string;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface GitHubIssuePayload {
  title: string;
  body: string;
  type: 'bug' | 'feature' | 'suggestion';
  userEmail?: string;
  userName?: string;
}

@Injectable({
  providedIn: 'root'
})
export class GitHubFeedbackService {
  private readonly FETCH_TIMEOUT = 10000; // 10 seconds

  constructor(private supabaseService: SupabaseService) {}

  /**
   * Fetch with timeout
   */
  private async fetchWithTimeout(url: string, options: RequestInit = {}): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.FETCH_TIMEOUT);

    try {
      return await fetch(url, { ...options, signal: controller.signal });
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Get GitHub issue configuration from admin settings
   */
  async getGitHubConfig(): Promise<GitHubIssueConfig | null> {
    try {
      const { data, error } = await this.supabaseService.client
        .from('admin_settings')
        .select('github_token, github_repo_owner, github_repo_name, enabled')
        .eq('id', 1)
        .maybeSingle();

      if (error || !data) {
        console.error('[GitHubFeedback] Error fetching config:', error);
        return null;
      }

      return {
        id: 1,
        github_token: data.github_token || '',
        github_repo_owner: data.github_repo_owner || '',
        github_repo_name: data.github_repo_name || '',
        enabled: data.enabled !== false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
    } catch (err) {
      console.error('[GitHubFeedback] Exception getting config:', err);
      return null;
    }
  }

  /**
   * Save GitHub configuration to admin settings
   */
  async saveGitHubConfig(config: Partial<GitHubIssueConfig>): Promise<boolean> {
    try {
      const { error } = await this.supabaseService.client
        .from('admin_settings')
        .update({
          github_token: config.github_token,
          github_repo_owner: config.github_repo_owner,
          github_repo_name: config.github_repo_name,
          enabled: config.enabled
        })
        .eq('id', 1);

      if (error) {
        console.error('[GitHubFeedback] Error saving config:', error);
        return false;
      }

      return true;
    } catch (err) {
      console.error('[GitHubFeedback] Exception saving config:', err);
      return false;
    }
  }

  /**
   * Create a GitHub issue via GitHub API
   */
  async createGitHubIssue(payload: GitHubIssuePayload): Promise<{ success: boolean; error?: string; url?: string }> {
    try {
      const config = await this.getGitHubConfig();

      if (!config || !config.enabled || !config.github_token) {
        return { success: false, error: 'GitHub feedback is not configured' };
      }

      const typeEmoji = {
        bug: '🐛',
        feature: '✨',
        suggestion: '💡'
      };

      const body = `
**Type:** ${payload.type}
**User Name:** ${payload.userName || payload.userEmail || 'Anonymous'}
**User Email:** ${payload.userEmail || 'Anonymous'}

---

${payload.body}

_This issue was automatically created from the feedback form._
`;

      const response = await this.fetchWithTimeout(
        `https://api.github.com/repos/${config.github_repo_owner}/${config.github_repo_name}/issues`,
        {
          method: 'POST',
          headers: {
            'Authorization': `token ${config.github_token}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            title: `${typeEmoji[payload.type]} ${payload.title}`,
            body: body,
            labels: [payload.type]
          })
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        console.error('[GitHubFeedback] GitHub API error:', errorData);
        return { success: false, error: errorData.message || 'Failed to create GitHub issue' };
      }

      const issue = await response.json();
      return { success: true, url: issue.html_url };
    } catch (err) {
      console.error('[GitHubFeedback] Exception creating issue:', err);
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  }

  /**
   * Test GitHub configuration
   */
  async testGitHubConnection(token?: string, owner?: string, repo?: string): Promise<{ success: boolean; message: string }> {
    try {
      // Use provided values or fetch from config
      let githubToken = token;
      let repoOwner = owner;
      let repoName = repo;

      if (!githubToken || !repoOwner || !repoName) {
        const config = await this.getGitHubConfig();
        githubToken = githubToken || config?.github_token || '';
        repoOwner = repoOwner || config?.github_repo_owner || '';
        repoName = repoName || config?.github_repo_name || '';
      }

      if (!githubToken) {
        return { success: false, message: 'GitHub token is not configured' };
      }

      if (!repoOwner || !repoName) {
        return { success: false, message: 'Repository owner and name are required' };
      }

      const response = await this.fetchWithTimeout(
        `https://api.github.com/repos/${repoOwner}/${repoName}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `token ${githubToken}`,
            'Accept': 'application/vnd.github.v3+json'
          }
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        return { success: false, message: errorData.message || 'Failed to access repository' };
      }

      return { success: true, message: 'Successfully connected to GitHub repository' };
    } catch (err) {
      console.error('[GitHubFeedback] Connection test error:', err);
      return { success: false, message: err instanceof Error ? err.message : 'Unknown error' };
    }
  }
}
