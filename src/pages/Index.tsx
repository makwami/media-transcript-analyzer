import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Youtube } from "lucide-react";
import { analyzeYoutubeVideo } from "@/lib/youtubeAnalyzer";

const Index = () => {
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [customPrompt, setCustomPrompt] = useState("");
  const [result, setResult] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!youtubeUrl.trim()) {
      toast({
        title: "Error",
        description: "Please enter a YouTube URL",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    setResult("");

    try {
      const result = await analyzeYoutubeVideo(
        youtubeUrl.trim(),
        customPrompt.trim() || "Summarize this video"
      );

      setResult(result);
      toast({
        title: "Success",
        description: "Video analyzed successfully!",
      });
    } catch (error: any) {
      console.error('Error:', error);
      
      let errorMessage = error.message || "Failed to analyze video";
      
      // Provide helpful message for caption-related errors
      if (errorMessage.includes('captions') || errorMessage.includes('subtitles') || errorMessage.includes('transcript')) {
        errorMessage = "This video doesn't have captions available. Please try a video with English subtitles or auto-generated captions enabled. Most TED Talks, educational videos, and news videos have captions.";
      }
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
        duration: 6000,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/10">
      <div className="container mx-auto px-4 py-12 max-w-4xl">
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
            <Youtube className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-4xl font-bold mb-3 bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            YouTube Transcript Analyzer
          </h1>
          <p className="text-muted-foreground text-lg">
            Extract transcripts and get AI-powered insights from any YouTube video
          </p>
        </div>

        <div className="bg-card rounded-lg shadow-lg border p-8 mb-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label htmlFor="youtube-url" className="text-sm font-medium">
                YouTube URL
              </label>
              <Input
                id="youtube-url"
                type="url"
                placeholder="https://www.youtube.com/watch?v=..."
                value={youtubeUrl}
                onChange={(e) => setYoutubeUrl(e.target.value)}
                disabled={isLoading}
                className="text-base"
              />
              <p className="text-xs text-muted-foreground">
                Make sure the video has captions/subtitles enabled
              </p>
            </div>

            <div className="space-y-2">
              <label htmlFor="custom-prompt" className="text-sm font-medium">
                Custom Prompt (Optional)
              </label>
              <Textarea
                id="custom-prompt"
                placeholder="e.g., 'Summarize the main points', 'What are the key takeaways?', 'Explain this in simple terms'"
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                disabled={isLoading}
                rows={3}
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground">
                Leave empty to get a summary by default
              </p>
            </div>

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full"
              size="lg"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Analyzing...
                </>
              ) : (
                "Analyze Video"
              )}
            </Button>
          </form>
        </div>

        {result && (
          <div className="bg-card rounded-lg shadow-lg border p-8 animate-in fade-in slide-in-from-bottom-4">
            <h2 className="text-2xl font-semibold mb-4">AI Analysis</h2>
            <div className="prose prose-sm max-w-none dark:prose-invert">
              <p className="whitespace-pre-wrap text-foreground leading-relaxed">
                {result}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Index;
