import { supabase } from '../lib/supabase';

export interface PrayerPrompt {
  id: string;
  title: string;
  type: string;
  description: string;
  created_at: string;
}

/**
 * Generate and download a printable prayer prompts list
 * @param selectedTypes - Array of type names to filter by. Empty array means all types.
 * @param newWindow - Pre-opened window for Safari compatibility
 */
export const downloadPrintablePromptList = async (selectedTypes: string[] = [], newWindow: Window | null = null) => {
  try {
    // Fetch all prayer prompts
    const { data: promptsData, error: promptsError } = await supabase
      .from('prayer_prompts')
      .select('*')
      .order('created_at', { ascending: false });

    if (promptsError) {
      console.error('Error fetching prompts:', promptsError);
      alert('Failed to fetch prayer prompts. Please try again.');
      if (newWindow) newWindow.close();
      return;
    }

    if (!promptsData || promptsData.length === 0) {
      alert('No prayer prompts found.');
      if (newWindow) newWindow.close();
      return;
    }

    // Fetch prayer types for ordering
    const { data: typesData, error: typesError } = await supabase
      .from('prayer_types')
      .select('name, display_order')
      .eq('is_active', true)
      .order('display_order', { ascending: true });

    if (typesError) {
      console.error('Error fetching prayer types:', typesError);
      // Continue with default alphabetical sorting if types fetch fails
    }

    // Create a map of type name to display_order
    const typeOrderMap = new Map(typesData?.map(t => [t.name, t.display_order]) || []);

    // Filter prompts by selected types (if any are selected)
    const filteredPrompts = selectedTypes.length > 0
      ? promptsData.filter(p => selectedTypes.includes(p.type))
      : promptsData;

    if (filteredPrompts.length === 0) {
      alert('No prayer prompts found for the selected types.');
      if (newWindow) newWindow.close();
      return;
    }

    // Sort prompts by type's display_order
    const sortedPrompts = filteredPrompts.sort((a, b) => {
      const orderA = typeOrderMap.get(a.type) ?? 999;
      const orderB = typeOrderMap.get(b.type) ?? 999;
      return orderA - orderB;
    });

    const html = generatePrintableHTML(sortedPrompts);

    // Use the pre-opened window if provided (Safari compatible)
    const targetWindow = newWindow || window.open('', '_blank');
    
    if (!targetWindow) {
      // Fallback: if popup blocked, offer download
      const blob = new Blob([html], { type: 'text/html' });
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      
      const today = new Date().toISOString().split('T')[0];
      link.download = `prayer-prompts-${today}.html`;
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      setTimeout(() => URL.revokeObjectURL(blobUrl), 100);
      alert('Prayer prompts downloaded. Please open the file to view and print.');
    } else {
      // Write the HTML content to the window
      targetWindow.document.open();
      targetWindow.document.write(html);
      targetWindow.document.close();
      // Switch focus to the new tab
      targetWindow.focus();
    }
  } catch (error) {
    console.error('Error generating prayer prompts list:', error);
    alert('An error occurred while generating the prayer prompts list.');
    if (newWindow) newWindow.close();
  }
};

/**
 * Generate HTML content for printable prayer prompts list
 */
/**
 * Generate printable HTML for prayer prompts
 */
function generatePrintableHTML(prompts: PrayerPrompt[]): string {
  const now = new Date();
  const today = now.toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
  
  const currentTime = now.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });

  // Group prompts by type
  const promptsByType: { [key: string]: PrayerPrompt[] } = {};
  
  prompts.forEach(prompt => {
    if (!promptsByType[prompt.type]) {
      promptsByType[prompt.type] = [];
    }
    promptsByType[prompt.type].push(prompt);
  });

  // Get types in the order they appear in the already-sorted prompts array
  const sortedTypes: string[] = [];
  prompts.forEach(prompt => {
    if (!sortedTypes.includes(prompt.type)) {
      sortedTypes.push(prompt.type);
    }
  });

  // Type colors for visual distinction
  const typeColors: { [key: string]: string } = {
    'Praise': '#39704D',
    'Confession': '#C9A961',
    'Thanksgiving': '#0047AB',
    'Supplication': '#8b5cf6'
  };

  let promptSectionsHTML = '';

  sortedTypes.forEach(type => {
    const typePrompts = promptsByType[type];
    const color = typeColors[type] || '#6b7280';
    
    // Split into two columns (column-major ordering)
    const mid = Math.ceil(typePrompts.length / 2);
    const col1 = typePrompts.slice(0, mid);
    const col2 = typePrompts.slice(mid);

    const col1HTML = col1.map((prompt) => generatePromptHTML(prompt)).join('');
    const col2HTML = col2.map((prompt) => generatePromptHTML(prompt)).join('');

    promptSectionsHTML += `
      <div class="type-section">
        <h2 style="color: ${color}; border-bottom: 2px solid ${color}; padding-bottom: 2px; margin-bottom: 2px; margin-top: 4px; font-size: 14px;">
          ${escapeHtml(type)} (${typePrompts.length})
        </h2>
        <div class="columns">
          <div class="col">${col1HTML}</div>
          <div class="col">${col2HTML}</div>
        </div>
      </div>
    `;
  });

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Prayer Prompts - ${today}</title>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }

          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial;
            line-height: 1.3;
            color: #222;
            background: white;
            padding: 8px;
            max-width: 1000px;
            margin: 0 auto;
            font-size: 12px;
          }

          .header {
            margin-bottom: 4px;
            padding-bottom: 3px;
            border-bottom: 2px solid #e5e7eb;
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            gap: 6px;
          }

          .header-left {
            display: flex;
            align-items: center;
            gap: 12px;
            flex-wrap: wrap;
          }

          .header-right {
            font-size: 12px;
            color: #6b7280;
            white-space: nowrap;
          }

          .header h1 {
            font-size: 16px;
            color: #1f2937;
            margin: 0;
          }

          .type-section {
            margin-bottom: 3px;
          }

          .prompt-item {
            background: transparent;
            border: 1px solid #e6e6e6;
            padding: 3px 6px;
            margin-bottom: 3px;
            border-radius: 2px;
            page-break-inside: avoid;
            break-inside: avoid;
          }

          .prompt-text {
            font-size: 13px;
            color: #374151;
            line-height: 1.3;
            display: inline;
            word-wrap: break-word;
            overflow-wrap: break-word;
          }

          .columns {
            display: flex;
            gap: 8px;
            align-items: flex-start;
          }

          .col {
            flex: 1 1 0;
            min-width: 0;
          }

          @media screen and (max-width: 768px) {
            body {
              padding: 15px;
              font-size: 16px;
            }

            .header h1 {
              font-size: 24px;
            }

            .prompt-text {
              font-size: 16px;
            }

            .prompt-number {
              width: 20px;
              height: 20px;
              line-height: 20px;
              font-size: 11px;
            }
          }

          @media print {
            body {
              padding: 15px;
            }

            .no-print {
              display: none !important;
            }

            .prompt-item {
              page-break-inside: avoid;
              break-inside: avoid;
            }

            h2 {
              page-break-after: avoid;
              break-after: avoid;
            }
          }

          @page {
            margin: 0.5in;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="header-left">
            <h1>🙏 Prayer Prompts</h1>
          </div>
          <div class="header-right">
            Generated: ${today} at ${currentTime}
          </div>
        </div>
        ${promptSectionsHTML}
      </body>
    </html>
  `;
}

/**
 * Generate HTML for a single prompt
 */
function generatePromptHTML(prompt: PrayerPrompt): string {
  return `
    <div class="prompt-item">
      <span class="prompt-text">${escapeHtml(prompt.title)}</span>
    </div>
  `;
}

/**
 * Escape HTML special characters to prevent XSS
 */
const escapeHtml = (text: string): string => {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
};
