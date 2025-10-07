import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { History, Youtube, Upload, MessageSquare, Copy, Check, Trash2, ChevronDown, ChevronRight } from 'lucide-react';
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
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

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

  const toggleExpanded = (itemId: string) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(itemId)) {
      newExpanded.delete(itemId);
    } else {
      newExpanded.add(itemId);
    }
    setExpandedItems(newExpanded);
  };

  const isExpanded = (itemId: string) => expandedItems.has(itemId);

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
      <CardContent className="space-y-3">
        {items.map((item) => (
          <Collapsible
            key={item.id}
            open={isExpanded(item.id)}
            onOpenChange={() => toggleExpanded(item.id)}
          >
            <div className="border rounded-lg hover:bg-accent/50 transition-colors">
              {/* Collapsible Header */}
              <CollapsibleTrigger className="w-full">
                <div className="flex items-center justify-between p-4 hover:bg-accent/25 transition-colors">
                  <div className="flex items-center gap-3">
                    {/* Expand/Collapse Icon */}
                    {isExpanded(item.id) ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                    
                    {/* Type Icon and Badge */}
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

                    {/* Preview of prompt */}
                    <div className="text-left flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">
                        "{item.prompt}"
                      </div>
                      {item.type === 'transcription' && item.source && (
                        <div className="text-xs text-muted-foreground truncate">
                          {item.source.name}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 ml-2">
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatTimestamp(item.timestamp)}
                    </span>
                  </div>
                </div>
              </CollapsibleTrigger>

              {/* Collapsible Content */}
              <CollapsibleContent>
                <div className="px-4 pb-4 space-y-3 border-t">
                  {/* Source info for transcriptions */}
                  {item.type === 'transcription' && item.source && (
                    <div className="text-sm text-muted-foreground pt-3">
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
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-medium">Analysis:</div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          copyToClipboard(item.result, item.id);
                        }}
                        className="h-8 w-8 p-0"
                      >
                        {copiedId === item.id ? (
                          <Check className="h-3 w-3" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </Button>
                    </div>
                    <div className="text-sm text-foreground bg-background rounded border p-3 leading-relaxed">
                      {item.result}
                    </div>
                  </div>
                </div>
              </CollapsibleContent>
            </div>
          </Collapsible>
        ))}
      </CardContent>
    </Card>
  );
};