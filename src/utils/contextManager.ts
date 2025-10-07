// Context management for conversation history and follow-up prompts

export interface ConversationItem {
  id: string;
  timestamp: number;
  type: 'transcription' | 'follow-up';
  source?: {
    type: 'youtube' | 'file';
    name: string; // YouTube URL or filename
  };
  prompt: string;
  result: string;
  transcript?: string; // Store original transcript for reference
}

export interface ConversationContext {
  items: ConversationItem[];
  currentSessionId: string;
}

export class ContextManager {
  private static readonly STORAGE_KEY = 'media-analyzer-context';
  private static readonly MAX_ITEMS = 10; // Limit to prevent localStorage overflow

  /**
   * Get the current conversation context
   */
  static getContext(): ConversationContext {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.error('Error loading context:', error);
    }
    
    return {
      items: [],
      currentSessionId: this.generateSessionId()
    };
  }

  /**
   * Save context to localStorage
   */
  static saveContext(context: ConversationContext): void {
    try {
      // Limit the number of stored items
      if (context.items.length > this.MAX_ITEMS) {
        context.items = context.items.slice(-this.MAX_ITEMS);
      }
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(context));
    } catch (error) {
      console.error('Error saving context:', error);
    }
  }

  /**
   * Add a new transcription result to context
   */
  static addTranscription(
    source: { type: 'youtube' | 'file'; name: string },
    prompt: string,
    result: string,
    transcript: string
  ): string {
    const context = this.getContext();
    const id = this.generateItemId();
    
    const item: ConversationItem = {
      id,
      timestamp: Date.now(),
      type: 'transcription',
      source,
      prompt,
      result,
      transcript
    };

    context.items.push(item);
    this.saveContext(context);
    
    return id;
  }

  /**
   * Add a follow-up prompt and response
   */
  static addFollowUp(prompt: string, result: string): string {
    const context = this.getContext();
    const id = this.generateItemId();
    
    const item: ConversationItem = {
      id,
      timestamp: Date.now(),
      type: 'follow-up',
      prompt,
      result
    };

    context.items.push(item);
    this.saveContext(context);
    
    return id;
  }

  /**
   * Get conversation history for AI context
   */
  static getAIContext(): string {
    const context = this.getContext();
    
    if (context.items.length === 0) {
      return '';
    }

    // Build context string for AI
    let contextString = 'Previous conversation history:\n\n';
    
    context.items.forEach((item, index) => {
      contextString += `${index + 1}. `;
      
      if (item.type === 'transcription') {
        contextString += `[${item.source?.type?.toUpperCase()} ANALYSIS: ${item.source?.name}]\n`;
        contextString += `User asked: "${item.prompt}"\n`;
        contextString += `Analysis result: ${item.result}\n`;
        if (item.transcript) {
          contextString += `Original transcript: ${item.transcript.substring(0, 500)}${item.transcript.length > 500 ? '...' : ''}\n`;
        }
      } else {
        contextString += `[FOLLOW-UP QUESTION]\n`;
        contextString += `User asked: "${item.prompt}"\n`;
        contextString += `Response: ${item.result}\n`;
      }
      
      contextString += '\n';
    });

    return contextString;
  }

  /**
   * Get the most recent transcription for reference
   */
  static getLatestTranscription(): ConversationItem | null {
    const context = this.getContext();
    
    // Find the most recent transcription
    for (let i = context.items.length - 1; i >= 0; i--) {
      if (context.items[i].type === 'transcription') {
        return context.items[i];
      }
    }
    
    return null;
  }

  /**
   * Clear conversation history
   */
  static clearContext(): void {
    try {
      localStorage.removeItem(this.STORAGE_KEY);
    } catch (error) {
      console.error('Error clearing context:', error);
    }
  }

  /**
   * Get recent items for display
   */
  static getRecentItems(limit: number = 5): ConversationItem[] {
    const context = this.getContext();
    return context.items.slice(-limit).reverse(); // Most recent first
  }

  private static generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private static generateItemId(): string {
    return `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}