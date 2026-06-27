import { useRef, useState, useCallback } from "react";
import { convertFloat32ToInt16, arrayBufferToBase64 } from "../utils/audio-converter";

interface UseAudioRecorderProps {
  onAudioData: (base64Data: string) => void;
}

export function useAudioRecorder({ onAudioData }: UseAudioRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const mediaStreamSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);

  const stopRecording = useCallback(() => {
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (mediaStreamSourceRef.current) {
      mediaStreamSourceRef.current.disconnect();
      mediaStreamSourceRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    setIsRecording(false);
  }, []);

  const startRecording = useCallback(async () => {
    try {
      stopRecording(); // เคลียร์ของเก่าก่อนถ้ามี

      // 1. สร้าง AudioContext ขึ้นมาก่อนทันที เพื่อให้อยู่ใน User Gesture Context
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const audioContext = new AudioContextClass();
      audioContextRef.current = audioContext;

      // ปลุกการทำงานของ AudioContext ทันที
      if (audioContext.state === "suspended") {
        await audioContext.resume();
      }

      // 2. ค่อยมาขอสิทธิ์กล้อง/ไมโครโฟน
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      streamRef.current = stream;

      const source = audioContext.createMediaStreamSource(stream);
      mediaStreamSourceRef.current = source;

      // สร้าง ScriptProcessorNode (bufferSize = 2048)
      // Gemini ต้องการ PCM 16000Hz. เราจำเป็นต้องทำ resampling
      const bufferSize = 2048;
      const processor = audioContext.createScriptProcessor(bufferSize, 1, 1);
      processorRef.current = processor;

      const inputSampleRate = audioContext.sampleRate;
      const targetSampleRate = 16000;

      processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        
        // ฟังก์ชัน Downsample จาก inputSampleRate ไปเป็น 16000Hz
        const resampledData = resample(inputData, inputSampleRate, targetSampleRate);
        
        // แปลงเป็น PCM 16-bit
        const pcm16Data = convertFloat32ToInt16(resampledData);
        
        const base64Data = arrayBufferToBase64(pcm16Data.buffer as ArrayBuffer);
        onAudioData(base64Data);
      };

      source.connect(processor);
      processor.connect(audioContext.destination);
      
      setIsRecording(true);
    } catch (error) {
      console.error("Error starting audio recorder:", error);
      stopRecording();
      throw error;
    }
  }, [onAudioData, stopRecording]);

  return {
    isRecording,
    startRecording,
    stopRecording,
  };
}

/**
 * ฟังก์ชันทำ Linear Interpolation Resampling สัญญาณเสียง
 */
function resample(
  data: Float32Array,
  inputSampleRate: number,
  outputSampleRate: number
): Float32Array {
  if (inputSampleRate === outputSampleRate) {
    return data;
  }

  const ratio = inputSampleRate / outputSampleRate;
  const newLength = Math.round(data.length / ratio);
  const result = new Float32Array(newLength);

  for (let i = 0; i < newLength; i++) {
    const nextOffset = i * ratio;
    const index = Math.floor(nextOffset);
    const interpolationFraction = nextOffset - index;

    const left = data[index];
    const right = index + 1 < data.length ? data[index + 1] : left;

    // Linear interpolation
    result[i] = left + interpolationFraction * (right - left);
  }

  return result;
}
