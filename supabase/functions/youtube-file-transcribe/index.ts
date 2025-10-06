import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper function to transcribe audio using OpenAI Whisper API
async function transcribeAudio(audioFile: File): Promise<string> {
  try {
    console.log('Starting transcription for file:', audioFile.name, 'Size:', audioFile.size);
    
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIApiKey) {
      throw new Error('OPENAI_API_KEY is not configured');
    }

    // Create FormData for the Whisper API
    const formData = new FormData();
    formData.append('file', audioFile);
    formData.append('model', 'whisper-1');
    formData.append('response_format', 'text');
    formData.append('language', 'en'); // Can be made configurable

    console.log('Calling OpenAI Whisper API...');

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Whisper API error:', response.status, errorText);
      throw new Error(`Whisper API error: ${response.status} - ${errorText}`);
    }

    const transcript = await response.text();
    
    if (!transcript || transcript.trim().length === 0) {
      throw new Error('No transcript generated from the audio file');
    }

    console.log('Successfully transcribed audio, transcript length:', transcript.length);
    return transcript.trim();

  } catch (error) {
    console.error('Error during transcription:', error);
    throw error;
  }
}

// Helper function to convert base64 to File
function base64ToFile(base64String: string, fileName: string, mimeType: string): File {
  // Remove data URL prefix if present
  const base64Data = base64String.includes(',') ? base64String.split(',')[1] : base64String;
  
  // Convert base64 to Uint8Array
  const binaryString = atob(base64Data);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  
  // Create File object
  return new File([bytes], fileName, { type: mimeType });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Function invoked, processing request...');
    const requestData = await req.json();
    const { fileData, fileName, mimeType, customPrompt } = requestData;
    
    console.log('Received transcription request for file:', fileName, 'Type:', mimeType);
    
    if (!fileData || !fileName || !mimeType) {
      return new Response(
        JSON.stringify({ error: 'File data, name, and mime type are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Convert base64 data to File object
    const audioFile = base64ToFile(fileData, fileName, mimeType);
    
    // Check file size (25MB limit for Whisper API)
    const maxSize = 25 * 1024 * 1024; // 25MB
    if (audioFile.size > maxSize) {
      return new Response(
        JSON.stringify({ error: 'File size exceeds 25MB limit' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate file type
    const supportedTypes = [
      'audio/mpeg', 'audio/wav', 'audio/mp4', 'video/mp4', 
      'video/quicktime', 'video/x-msvideo', 'video/webm'
    ];
    
    if (!supportedTypes.includes(mimeType)) {
      return new Response(
        JSON.stringify({ error: 'Unsupported file type' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Transcribe the audio
    const transcript = await transcribeAudio(audioFile);
    
    if (!transcript) {
      return new Response(
        JSON.stringify({ error: 'Could not transcribe the audio file' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Transcript length:', transcript.length);

    // Generate AI summary using the transcript
    const userPrompt = customPrompt || 'Summarize this audio/video content';
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    
    if (!openAIApiKey) {
      throw new Error('OPENAI_API_KEY is not configured');
    }

    console.log('Calling OpenAI API for summarization...');

    const openAIResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { 
            role: 'system', 
            content: 'You are a helpful assistant that analyzes audio and video transcripts. Provide clear, concise, and well-structured responses.'
          },
          { 
            role: 'user', 
            content: `${userPrompt}\n\nTranscript:\n${transcript}`
          }
        ],
        max_completion_tokens: 1000,
      }),
    });

    if (!openAIResponse.ok) {
      const errorText = await openAIResponse.text();
      console.error('OpenAI API error:', openAIResponse.status, errorText);
      return new Response(
        JSON.stringify({ error: `OpenAI API error: ${openAIResponse.status}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiData = await openAIResponse.json();
    const result = aiData.choices[0].message.content;

    console.log('Successfully generated AI response');

    return new Response(
      JSON.stringify({ result, transcript }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in youtube-file-transcribe function:', error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});