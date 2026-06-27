import { useRef, useState, useCallback, useEffect } from "react";
import { base64ToArrayBuffer } from "../utils/audio-converter";

// กำหนดรุ่นของ Gemini Multimodal Live API
const HOST = "generativelanguage.googleapis.com";
const PATH = "ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent";
const MODEL = "models/gemini-2.0-flash-exp";

export interface UseLiveConnectionProps {
  apiKey: string;
  systemInstruction?: string;
  onTextReceived?: (text: string) => void;
  onAudioPlayStateChange?: (isPlaying: boolean) => void;
}

export function useLiveConnection({
  apiKey,
  systemInstruction = "You are a helpful assistant.",
  onTextReceived,
  onAudioPlayStateChange,
}: UseLiveConnectionProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const wsRef = useRef<WebSocket | null>(null);
  
  // สำหรับการจัดการการเล่นเสียง (Audio Playback)
  const audioCtxRef = useRef<AudioContext | null>(null);
  const nextPlayTimeRef = useRef<number>(0);
  const audioQueueRef = useRef<Int16Array[]>([]);
  const isPlayingAudioRef = useRef<boolean>(false);

  // หยุดเสียงทั้งหมด
  const stopAudioPlayback = useCallback(() => {
    audioQueueRef.current = [];
    isPlayingAudioRef.current = false;
    if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
      audioCtxRef.current.close();
      audioCtxRef.current = null;
    }
    nextPlayTimeRef.current = 0;
    onAudioPlayStateChange?.(false);
  }, [onAudioPlayStateChange]);

  // เริ่มต้น Audio Context สำหรับการเล่นเสียงขาออก
  const initAudioCtx = useCallback(() => {
    if (!audioCtxRef.current || audioCtxRef.current.state === "closed") {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      audioCtxRef.current = new AudioContextClass();
      nextPlayTimeRef.current = audioCtxRef.current.currentTime;
    }
  }, []);

  // เล่นคิวเสียงถัดไป
  const playNextChunk = useCallback(() => {
    if (!audioCtxRef.current || audioQueueRef.current.length === 0) {
      isPlayingAudioRef.current = false;
      onAudioPlayStateChange?.(false);
      return;
    }

    isPlayingAudioRef.current = true;
    onAudioPlayStateChange?.(true);

    const pcmData = audioQueueRef.current.shift()!;
    const sampleRate = 24000; // Gemini Live API ส่งเสียงกลับมาที่ 24kHz PCM

    // แปลง Int16 PCM ไปเป็น Float32 สำหรับ Web Audio API
    const float32Data = new Float32Array(pcmData.length);
    for (let i = 0; i < pcmData.length; i++) {
      float32Data[i] = pcmData[i] / 32768.0;
    }

    const audioBuffer = audioCtxRef.current.createBuffer(1, float32Data.length, sampleRate);
    audioBuffer.getChannelData(0).set(float32Data);

    const source = audioCtxRef.current.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(audioCtxRef.current.destination);

    // กำหนดเวลาเล่นให้ต่อเนื่องกัน (Buffer Scheduling)
    const currentTime = audioCtxRef.current.currentTime;
    const playTime = Math.max(nextPlayTimeRef.current, currentTime);
    
    source.start(playTime);
    
    // ตั้งเวลาสำหรับ chunk ถัดไป
    nextPlayTimeRef.current = playTime + audioBuffer.duration;
    
    // เมื่อเล่น chunk นี้จบ
    source.onended = () => {
      playNextChunk();
    };
  }, [onAudioPlayStateChange]);

  // จัดการเพิ่ม chunk เสียงเข้าไปในคิวและรันคิว
  const queueAudioChunk = useCallback(
    (base64Data: string) => {
      initAudioCtx();
      
      const arrayBuffer = base64ToArrayBuffer(base64Data);
      const int16Array = new Int16Array(arrayBuffer);
      
      audioQueueRef.current.push(int16Array);

      if (!isPlayingAudioRef.current) {
        playNextChunk();
      }
    },
    [initAudioCtx, playNextChunk]
  );

  // ตัดการเชื่อมต่อ
  const disconnect = useCallback(() => {
    stopAudioPlayback();
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
  }, [stopAudioPlayback]);

  // เชื่อมต่อ WebSocket
  const connect = useCallback(() => {
    if (!apiKey) {
      setError("Please provide a Gemini API Key");
      return;
    }

    disconnect();
    setError(null);

    const wsUrl = `wss://${HOST}/${PATH}?key=${apiKey}`;
    
    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        
        // ส่งข้อความ Setup เมื่อเชื่อมต่อได้สำเร็จ
        const setupMessage = {
          setup: {
            model: MODEL,
            generationConfig: {
              responseModalities: ["AUDIO"], // ขอผลลัพธ์เป็นเสียง (และข้อความจะมาพร้อมกัน)
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: {
                    voiceName: "Aoede", // ตัวเลือกเสียง: Aoede, Charon, Fenrir, Kore, Puck
                  },
                },
              },
            },
            systemInstruction: {
              parts: [
                {
                  text: systemInstruction,
                },
              ],
            },
          },
        };

        ws.send(JSON.stringify(setupMessage));
      };

      ws.onmessage = (event) => {
        try {
          let data;
          if (event.data instanceof Blob) {
            // Live API มักส่งข้อมูลเป็น JSON string แต่ในบางกรณีหากส่งเป็น Binary เราจะแปลงก่อน
            return;
          } else {
            data = JSON.parse(event.data);
          }

          // ตรวจสอบข้อมูลจากเซิร์ฟเวอร์
          if (data.serverContent) {
            const modelTurn = data.serverContent.modelTurn;
            
            if (modelTurn && modelTurn.parts) {
              for (const part of modelTurn.parts) {
                // 1. ตรวจสอบข้อมูลเสียงตอบกลับ
                if (part.inlineData && part.inlineData.data) {
                  const base64Audio = part.inlineData.data;
                  queueAudioChunk(base64Audio);
                }
                
                // 2. ตรวจสอบข้อมูลข้อความตอบกลับ
                if (part.text) {
                  onTextReceived?.(part.text);
                }
              }
            }

            // ถ้า AI พูดจบเทิร์น
            if (data.serverContent.turnComplete) {
              console.log("Turn Complete");
            }
          }
        } catch (e) {
          console.error("Error parsing message:", e);
        }
      };

      ws.onerror = (e) => {
        console.error("WebSocket error:", e);
        setError("WebSocket connection error. Please check your API key and network.");
        disconnect();
      };

      ws.onclose = (e) => {
        console.log("WebSocket closed:", e);
        setIsConnected(false);
      };

    } catch (err: any) {
      setError(err.message || "Failed to establish WebSocket connection.");
      setIsConnected(false);
    }
  }, [apiKey, systemInstruction, disconnect, queueAudioChunk, onTextReceived]);

  // ส่งข้อมูลเสียงไมค์
  const sendAudioChunk = useCallback((base64Audio: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      return;
    }

    const mediaMessage = {
      realtimeInput: {
        mediaChunks: [
          {
            mimeType: "audio/pcm;rate=16000",
            data: base64Audio,
          },
        ],
      },
    };

    wsRef.current.send(JSON.stringify(mediaMessage));
  }, []);

  // ส่งภาพกล้องหรือภาพหน้าจอ
  const sendVideoFrame = useCallback((base64Image: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      return;
    }

    const mediaMessage = {
      realtimeInput: {
        mediaChunks: [
          {
            mimeType: "image/jpeg",
            data: base64Image,
          },
        ],
      },
    };

    wsRef.current.send(JSON.stringify(mediaMessage));
  }, []);

  // ทำลายการเชื่อมต่อเมื่อ Component Unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    isConnected,
    error,
    connect,
    disconnect,
    sendAudioChunk,
    sendVideoFrame,
  };
}
