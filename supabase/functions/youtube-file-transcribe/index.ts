import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};


// Helper function to transcribe audio using OpenAI Whisper API
async function transcribeAudio(audioFile: File): Promise<string> {
  try {
    console.log('Starting transcription for file:', audioFile.name, 'Size:', audioFile.size, 'Type:', audioFile.type);
    
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

    console.log('Calling OpenAI Whisper API with file:', audioFile.name, 'type:', audioFile.type);

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
      
      // Provide more helpful error messages based on the error
      let userFriendlyMessage = `Whisper API error: ${response.status}`;
      if (errorText.includes('Invalid file format')) {
        userFriendlyMessage = `Audio format not supported. For M4A files, please ensure they are properly encoded. Try converting to MP3 if issues persist.`;
      } else if (errorText.includes('file too large')) {
        userFriendlyMessage = `File is too large. Maximum size is 25MB.`;
      } else if (errorText.includes('duration')) {
        userFriendlyMessage = `Audio file is too long. Maximum duration is about 3 hours.`;
      }
      
      throw new Error(userFriendlyMessage);
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
  try {
    console.log('Converting base64 to file:', fileName, 'MIME:', mimeType);
    console.log('Base64 length:', base64String.length);
    
    // Remove data URL prefix if present
    const base64Data = base64String.includes(',') ? base64String.split(',')[1] : base64String;
    console.log('Cleaned base64 length:', base64Data.length);
    
    // Convert base64 to Uint8Array
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    console.log('File size after conversion:', bytes.length);
    
    // Ensure proper MIME type for Whisper API
    let finalMimeType = mimeType;
    if (fileName.toLowerCase().endsWith('.m4a')) {
      finalMimeType = 'audio/mp4';
      console.log('M4A file detected, using audio/mp4 MIME type');
    }
    
    // Create File object
    const file = new File([bytes], fileName, { type: finalMimeType });
    console.log('Created file object:', file.name, file.size, file.type);
    return file;
  } catch (error) {
    console.error('Error in base64ToFile:', error);
    throw new Error(`Failed to convert base64 to file: ${error.message}`);
  }
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
    let audioFile;
    try {
      audioFile = base64ToFile(fileData, fileName, mimeType);
      console.log('Successfully converted to file object');
    } catch (error) {
      console.error('Failed to convert base64 to file:', error);
      return new Response(
        JSON.stringify({ error: `File conversion failed: ${error.message}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Check file size (25MB limit for Whisper API)
    const maxSize = 25 * 1024 * 1024; // 25MB
    if (audioFile.size > maxSize) {
      return new Response(
        JSON.stringify({ error: 'File size exceeds 25MB limit' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate file type - check both MIME type and file extension for M4A compatibility
    const supportedTypes = [
      'audio/mpeg', 'audio/wav', 'audio/mp4', 'video/mp4', 
      'video/quicktime', 'video/x-msvideo', 'video/webm'
    ];
    
    const supportedExtensions = ['.mp3', '.wav', '.m4a', '.mp4', '.mov', '.avi', '.webm'];
    const fileExtension = fileName.toLowerCase().substring(fileName.lastIndexOf('.'));
    
    const isValidType = supportedTypes.includes(mimeType) || supportedExtensions.includes(fileExtension);
    
    if (!isValidType) {
      return new Response(
        JSON.stringify({ error: 'Unsupported file type' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // For M4A files, ensure proper MIME type for processing
    if (fileName.toLowerCase().endsWith('.m4a')) {
      console.log('M4A file detected, will be processed as audio/mp4');
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