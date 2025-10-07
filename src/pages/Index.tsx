import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Youtube, Upload, Moon, Sun, Copy, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { FileUpload } from "@/components/FileUpload";

const Index = () => {
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [customPrompt, setCustomPrompt] = useState("");
  const [result, setResult] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [fileError, setFileError] = useState<string | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const { toast } = useToast();

  // Initialize dark mode based on system preference and localStorage
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    const shouldUseDark = savedTheme === 'dark' || (!savedTheme && systemPrefersDark);
    
    setIsDarkMode(shouldUseDark);
    if (shouldUseDark) {
      document.documentElement.classList.add('dark');
    }
  }, []);

  const handleYouTubeSubmit = async (e: React.FormEvent) => {
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
      const { data, error } = await supabase.functions.invoke('youtube-summarize', {
        body: { 
          youtubeUrl: youtubeUrl.trim(),
          customPrompt: customPrompt.trim() || "Summarize this video"
        }
      });

      if (error) throw error;

      if (data.error) {
        throw new Error(data.error);
      }

      setResult(data.result);
      toast({
        title: "Success",
        description: "Video analyzed successfully!",
      });
    } catch (error: unknown) {
      console.error('Error:', error);
      
      let errorMessage = error instanceof Error ? error.message : "Failed to analyze video";
      
      // Provide helpful message for caption-related errors
      if (errorMessage.includes('captions') || errorMessage.includes('subtitles')) {
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

  const handleFileSelect = (file: File) => {
    setSelectedFile(file);
    setFileError(null);
  };

  const handleFileSubmit = async () => {
    if (!selectedFile) {
      toast({
        title: "Error",
        description: "Please select a file first",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    setResult("");
    setUploadProgress(0);
    setFileError(null);

    try {
      // Convert file to base64
      const reader = new FileReader();
      const fileData = await new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const result = reader.result as string;
          // Remove data URL prefix to get just the base64 data
          const base64Data = result.split(',')[1];
          resolve(base64Data);
        };
        reader.onerror = reject;
        reader.readAsDataURL(selectedFile);
      });

      setUploadProgress(25);

      const { data, error } = await supabase.functions.invoke('youtube-file-transcribe', {
        body: {
          fileData,
          fileName: selectedFile.name,
          mimeType: selectedFile.type,
          customPrompt: customPrompt.trim() || "Summarize this audio/video content"
        }
      });

      setUploadProgress(75);

      if (error) throw error;

      if (data.error) {
        throw new Error(data.error);
      }

      setUploadProgress(100);
      setResult(data.result);
      toast({
        title: "Success",
        description: "File analyzed successfully!",
      });
    } catch (error: unknown) {
      console.error('Error:', error);
      
      const errorMessage = error instanceof Error ? error.message : "Failed to analyze file";
      
      setFileError(errorMessage);
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
        duration: 6000,
      });
    } finally {
      setIsLoading(false);
      setTimeout(() => setUploadProgress(0), 1000);
    }
  };

  const toggleDarkMode = () => {
    const newDarkMode = !isDarkMode;
    setIsDarkMode(newDarkMode);
    
    if (newDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(result);
      setIsCopied(true);
      toast({
        title: "Copied!",
        description: "Analysis copied to clipboard",
      });
      setTimeout(() => setIsCopied(false), 2000);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to copy to clipboard",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/10">
      <div className="container mx-auto px-4 py-12 max-w-4xl">
        <div className="flex justify-end mb-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleDarkMode}
            className="rounded-full"
          >
            {isDarkMode ? (
              <Sun className="h-5 w-5" />
            ) : (
              <Moon className="h-5 w-5" />
            )}
          </Button>
        </div>
        
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
            <Youtube className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-4xl font-bold mb-3 bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            Media Transcript Analyzer
          </h1>
          <p className="text-muted-foreground text-lg">
            Extract transcripts and get AI-powered insights from YouTube videos or audio/video files
          </p>
        </div>

        <div className="bg-card rounded-lg shadow-lg border p-8 mb-8">
          <Tabs defaultValue="youtube" className="space-y-6">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="youtube" className="flex items-center gap-2">
                <Youtube className="w-4 h-4" />
                YouTube URL
              </TabsTrigger>
              <TabsTrigger value="file" className="flex items-center gap-2">
                <Upload className="w-4 h-4" />
                Upload File
              </TabsTrigger>
            </TabsList>

            <TabsContent value="youtube" className="space-y-6">
              <form onSubmit={handleYouTubeSubmit} className="space-y-6">
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
            </TabsContent>

            <TabsContent value="file" className="space-y-6">
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Audio or Video File
                  </label>
                  <FileUpload
                    onFileSelect={handleFileSelect}
                    isUploading={isLoading}
                    uploadProgress={uploadProgress}
                    error={fileError}
                    disabled={isLoading}
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="file-custom-prompt" className="text-sm font-medium">
                    Custom Prompt (Optional)
                  </label>
                  <Textarea
                    id="file-custom-prompt"
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
                  onClick={handleFileSubmit}
                  disabled={isLoading || !selectedFile}
                  className="w-full"
                  size="lg"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    "Analyze File"
                  )}
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {result && (
          <div className="bg-card rounded-lg shadow-lg border p-8 animate-in fade-in slide-in-from-bottom-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-semibold">AI Analysis</h2>
              <Button
                variant="outline"
                size="sm"
                onClick={copyToClipboard}
                className="flex items-center gap-2"
              >
                {isCopied ? (
                  <>
                    <Check className="h-4 w-4" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" />
                    Copy
                  </>
                )}
              </Button>
            </div>
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
