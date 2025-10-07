import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, MessageSquare } from 'lucide-react';

interface FollowUpPromptProps {
  onSubmit: (prompt: string) => Promise<void>;
  isLoading?: boolean;
  disabled?: boolean;
}

export const FollowUpPrompt: React.FC<FollowUpPromptProps> = ({
  onSubmit,
  isLoading = false,
  disabled = false
}) => {
  const [prompt, setPrompt] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!prompt.trim() || isLoading) return;
    
    const trimmedPrompt = prompt.trim();
    setPrompt(''); // Clear the input
    await onSubmit(trimmedPrompt);
  };

  const quickPrompts = [
    "Summarize the key points",
    "Extract action items",
    "What are the main takeaways?",
    "Identify any questions or concerns raised",
    "Create a brief overview"
  ];

  const handleQuickPrompt = (quickPrompt: string) => {
    if (isLoading) return;
    onSubmit(quickPrompt);
  };

  return (
    <Card className="mt-6">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <MessageSquare className="h-5 w-5" />
          Ask a Follow-up Question
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={handleSubmit} className="space-y-3">
          <Textarea
            placeholder="Ask anything about the previous analysis... e.g., 'What were the main action items?' or 'Can you elaborate on the financial projections mentioned?'"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            disabled={isLoading || disabled}
            rows={3}
            className="resize-none"
          />
          <Button
            type="submit"
            disabled={!prompt.trim() || isLoading || disabled}
            className="w-full"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Analyzing...
              </>
            ) : (
              "Ask Question"
            )}
          </Button>
        </form>

        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">Quick questions:</p>
          <div className="flex flex-wrap gap-2">
            {quickPrompts.map((quickPrompt, index) => (
              <Button
                key={index}
                variant="outline"
                size="sm"
                onClick={() => handleQuickPrompt(quickPrompt)}
                disabled={isLoading || disabled}
                className="text-xs"
              >
                {quickPrompt}
              </Button>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};