// Audio conversion utilities for M4A to MP3 conversion
export class AudioConverter {
  private static audioContext: AudioContext | null = null;

  private static getAudioContext(): AudioContext {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return this.audioContext;
  }

  /**
   * Convert M4A file to MP3 using Web Audio API
   */
  static async convertM4AToMP3(file: File): Promise<File> {
    try {
      console.log('Starting M4A to MP3 conversion for:', file.name);
      
      // Check if it's already MP3
      if (file.type === 'audio/mpeg' || file.name.toLowerCase().endsWith('.mp3')) {
        console.log('File is already MP3, no conversion needed');
        return file;
      }

      // Only convert M4A files
      if (!file.name.toLowerCase().endsWith('.m4a') && file.type !== 'audio/mp4') {
        console.log('File is not M4A, returning original');
        return file;
      }

      const arrayBuffer = await file.arrayBuffer();
      const audioContext = this.getAudioContext();
      
      console.log('Decoding audio data...');
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      
      console.log('Creating MP3 from audio buffer...');
      const mp3File = await this.audioBufferToMP3(audioBuffer, file.name);
      
      console.log('Conversion completed. Original size:', file.size, 'New size:', mp3File.size);
      return mp3File;
      
    } catch (error) {
      console.error('Audio conversion failed:', error);
      console.log('Returning original file due to conversion failure');
      return file; // Return original file if conversion fails
    }
  }

  /**
   * Convert AudioBuffer to MP3 File using lamejs
   */
  private static async audioBufferToMP3(audioBuffer: AudioBuffer, originalFileName: string): Promise<File> {
    // Import lamejs dynamically
    const lamejs = await import('lamejs');
    
    const mp3encoder = new (lamejs as any).Mp3Encoder(
      audioBuffer.numberOfChannels, 
      audioBuffer.sampleRate, 
      128 // bitrate
    );

    const samples = audioBuffer.getChannelData(0);
    const sampleRate = audioBuffer.sampleRate;
    const mp3Data = [];

    // Convert float samples to 16-bit PCM
    const pcmSamples = new Int16Array(samples.length);
    for (let i = 0; i < samples.length; i++) {
      pcmSamples[i] = samples[i] * 0x7FFF;
    }

    // Encode in chunks
    const chunkSize = 1152; // MP3 frame size
    for (let i = 0; i < pcmSamples.length; i += chunkSize) {
      const chunk = pcmSamples.slice(i, i + chunkSize);
      const mp3buf = mp3encoder.encodeBuffer(chunk);
      if (mp3buf.length > 0) {
        mp3Data.push(mp3buf);
      }
    }

    // Flush remaining data
    const remaining = mp3encoder.flush();
    if (remaining.length > 0) {
      mp3Data.push(remaining);
    }

    // Create blob and file
    const blob = new Blob(mp3Data, { type: 'audio/mpeg' });
    const mp3FileName = originalFileName.replace(/\.m4a$/i, '.mp3');
    
    return new File([blob], mp3FileName, { type: 'audio/mpeg' });
  }

  /**
   * Fallback conversion using MediaRecorder (simpler but lower quality)
   */
  static async convertUsingMediaRecorder(file: File): Promise<File> {
    try {
      console.log('Using MediaRecorder fallback conversion');
      
      const arrayBuffer = await file.arrayBuffer();
      const audioContext = this.getAudioContext();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      
      // Create an audio source
      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;
      
      // Create a destination stream
      const destination = audioContext.createMediaStreamDestination();
      source.connect(destination);
      
      // Record the stream
      const mediaRecorder = new MediaRecorder(destination.stream, {
        mimeType: 'audio/webm;codecs=opus' // Most widely supported
      });
      
      const chunks: Blob[] = [];
      
      return new Promise((resolve, reject) => {
        mediaRecorder.ondataavailable = (event) => {
          chunks.push(event.data);
        };
        
        mediaRecorder.onstop = () => {
          const blob = new Blob(chunks, { type: 'audio/webm' });
          const convertedFileName = file.name.replace(/\.m4a$/i, '.webm');
          const convertedFile = new File([blob], convertedFileName, { type: 'audio/webm' });
          resolve(convertedFile);
        };
        
        mediaRecorder.onerror = reject;
        
        mediaRecorder.start();
        source.start();
        
        // Stop recording after the audio duration
        setTimeout(() => {
          mediaRecorder.stop();
        }, audioBuffer.duration * 1000 + 100);
      });
      
    } catch (error) {
      console.error('MediaRecorder conversion failed:', error);
      throw error;
    }
  }
}