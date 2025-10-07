import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { History, Youtube, Upload, MessageSquare, Copy, Check, Trash2 } from 'lucide-react';
import { ConversationItem } from '@/utils/contextManager';
import { useState } from 'react';

interface ConversationHistoryProps {
  items: ConversationItem[];
  onClear?: () => void;
}

export const ConversationHistory: React.FC<ConversationHistoryProps> = ({
  items,
  onClear
}) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  if (items.length === 0) {
    return null;
  }

  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  };

  const formatTimestamp = (timestamp: number): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - timestamp;
    
    // Less than 1 hour ago
    if (diff < 3600000) {
      const minutes = Math.floor(diff / 60000);
      return minutes <= 1 ? 'Just now' : `${minutes} minutes ago`;
    }
    
    // Less than 24 hours ago
    if (diff < 86400000) {
      const hours = Math.floor(diff / 3600000);
      return `${hours} hour${hours === 1 ? '' : 's'} ago`;
    }
    
    // Show date
    return date.toLocaleDateString();
  };

  return (
    <Card className="mt-6">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <History className="h-5 w-5" />
            Recent Analysis History
          </CardTitle>
          {onClear && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClear}
              className="text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {items.map((item) => (
          <div
            key={item.id}
            className="border rounded-lg p-4 space-y-3 hover:bg-accent/50 transition-colors"
          >
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {item.type === 'transcription' ? (
                  <>
                    {item.source?.type === 'youtube' ? (
                      <Youtube className="h-4 w-4 text-red-500" />
                    ) : (
                      <Upload className="h-4 w-4 text-blue-500" />
                    )}
                    <Badge variant="outline" className="text-xs">
                      {item.source?.type === 'youtube' ? 'YouTube' : 'File Upload'}
                    </Badge>
                  </>
                ) : (
                  <>
                    <MessageSquare className="h-4 w-4 text-green-500" />
                    <Badge variant="outline" className="text-xs">
                      Follow-up
                    </Badge>
                  </>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  {formatTimestamp(item.timestamp)}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(item.result, item.id)}
                  className="h-8 w-8 p-0"
                >
                  {copiedId === item.id ? (
                    <Check className="h-3 w-3" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                </Button>
              </div>
            </div>

            {/* Source info for transcriptions */}
            {item.type === 'transcription' && item.source && (
              <div className="text-sm text-muted-foreground">
                <span className="font-medium">Source:</span> {item.source.name}
              </div>
            )}

            {/* User prompt */}
            <div className="space-y-1">
              <div className="text-sm font-medium">Question:</div>
              <div className="text-sm text-muted-foreground bg-muted/50 rounded p-2">
                "{item.prompt}"
              </div>
            </div>

            {/* AI Response */}
            <div className="space-y-1">
              <div className="text-sm font-medium">Analysis:</div>
              <div className="text-sm text-foreground bg-background rounded border p-3 leading-relaxed">
                {item.result}
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};