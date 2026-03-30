import clarity from '@microsoft/clarity';
import { environment } from '../environments/environment';

export function initializeClarity(): void {
  // Check if we're in a browser environment
  if (typeof window === 'undefined') {
    return;
  }

  try {
    const clarityProjectId = environment.clarityProjectId;
    
    // Only initialize if project ID is explicitly set and not empty
    if (!clarityProjectId || clarityProjectId === '' || clarityProjectId === 'undefined') {
      return;
    }

    // Initialize Clarity using the official npm package
    clarity.init(clarityProjectId);
  } catch (error) {
    console.error('✗ Failed to initialize Clarity:', error instanceof Error ? error.message : String(error));
  }
}
