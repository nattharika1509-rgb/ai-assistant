import { useState, useRef, useEffect, useCallback } from "react";
import { 
  Play, Square, Video, VideoOff, Monitor, MonitorOff, 
  Settings, Key, Cpu, AlertCircle
} from "lucide-react";
import { useLiveConnection } from "../hooks/useLiveConnection";
import { useAudioRecorder } from "../hooks/useAudioRecorder";
import { AudioVisualizer } from "./AudioVisualizer";

export function Console() {
  // ดึง API Key จาก .env
  const [apiKey, setApiKey] = useState(import.meta.env.VITE_GEMINI_API_KEY || "");
  const [systemInstruction, setSystemInstruction] = useState(
    "คุณคือสถาปนิกและไกด์นำเที่ยวผู้เชี่ยวชาญ คอยวิเคราะห์แผนที่หรือรูปภาพที่ผู้ใช้ส่งให้ และตอบกลับเป็นภาษาไทยอย่างกระชับ สุภาพ เป็นกันเอง"
  );
  
  const [messages, setMessages] = useState<string[]>([]);
  const [isAiPlayingAudio, setIsAiPlayingAudio] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isScreenActive, setIsScreenActive] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // References สำหรับกล้องและการแชร์หน้าจอ
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const screenRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  
  const videoIntervalRef = useRef<number | null>(null);

  // สรุปข้อความที่ AI ตอบมา
  const handleTextReceived = useCallback((text: string) => {
    setMessages((prev) => {
      if (prev.length === 0) return [text];
      const last = prev[prev.length - 1];
      return [...prev.slice(0, -1), last + text];
    });
  }, []);

  const handleAudioPlayStateChange = useCallback((isPlaying: boolean) => {
    setIsAiPlayingAudio(isPlaying);
  }, []);

  // เชื่อมต่อ Live Connection
  const {
    isConnected,
    error: connectionError,
    connect,
    disconnect,
    sendAudioChunk,
    sendVideoFrame
  } = useLiveConnection({
    apiKey,
    systemInstruction,
    onTextReceived: handleTextReceived,
    onAudioPlayStateChange: handleAudioPlayStateChange
  });

  // บันทึกเสียงจากไมโครโฟน
  const {
    isRecording,
    startRecording,
    stopRecording
  } = useAudioRecorder({
    onAudioData: useCallback((base64Data) => {
      if (isConnected) {
        sendAudioChunk(base64Data);
      }
    }, [isConnected, sendAudioChunk])
  });

  // จัดการกล้องเว็บแคม
  const stopCamera = useCallback(() => {
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach(track => track.stop());
      cameraStreamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  }, []);

  const startCamera = async () => {
    try {
      if (cameraStreamRef.current) stopCamera();

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, frameRate: 15 },
        audio: false
      });

      cameraStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setIsCameraActive(true);
    } catch (err) {
      console.error("Error accessing camera:", err);
      alert("ไม่สามารถเข้าถึงกล้องเว็บแคมได้");
    }
  };

  // จัดการการแชร์หน้าจอ
  const stopScreenShare = useCallback(() => {
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(track => track.stop());
      screenStreamRef.current = null;
    }
    if (screenRef.current) {
      screenRef.current.srcObject = null;
    }
    setIsScreenActive(false);
  }, []);

  const startScreenShare = async () => {
    try {
      if (screenStreamRef.current) stopScreenShare();

      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { width: 1024, height: 768, frameRate: 10 },
        audio: false
      });

      screenStreamRef.current = stream;
      if (screenRef.current) {
        screenRef.current.srcObject = stream;
      }
      setIsScreenActive(true);

      stream.getVideoTracks()[0].onended = () => {
        stopScreenShare();
      };
    } catch (err) {
      console.error("Error starting screen share:", err);
    }
  };

  // เริ่มต้นหรือหยุดการเชื่อมต่อ
  const handleToggleConnection = async () => {
    if (isConnected) {
      stopRecording();
      stopCamera();
      stopScreenShare();
      disconnect();
    } else {
      setMessages(["เริ่มเปิดการเชื่อมต่อ..."]);
      connect();
    }
  };

  // ตรวจจับเมื่อเชื่อมต่อสำเร็จเพื่อเปิดไมโครโฟนทันที
  useEffect(() => {
    if (isConnected) {
      startRecording().catch((err) => {
        console.error("Failed to start audio recording automatically:", err);
      });
      setMessages((prev) => [...prev, "\nเชื่อมต่อกับ Gemini Live API สำเร็จแล้ว! เริ่มพูดคุยได้ทันที"]);
    } else {
      stopRecording();
    }
  }, [isConnected, startRecording, stopRecording]);

  // จับเฟรมวิดีโอและส่งไปยัง Gemini
  useEffect(() => {
    if (!isConnected) {
      if (videoIntervalRef.current) {
        clearInterval(videoIntervalRef.current);
        videoIntervalRef.current = null;
      }
      return;
    }

    const captureAndSendFrame = () => {
      if (!canvasRef.current) return;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      let activeVideoElement: HTMLVideoElement | null = null;

      if (isScreenActive && screenRef.current && screenRef.current.readyState === 4) {
        activeVideoElement = screenRef.current;
      } else if (isCameraActive && videoRef.current && videoRef.current.readyState === 4) {
        activeVideoElement = videoRef.current;
      }

      if (activeVideoElement) {
        ctx.drawImage(activeVideoElement, 0, 0, canvas.width, canvas.height);
        const jpegBase64 = canvas.toDataURL("image/jpeg", 0.65);
        const base64Data = jpegBase64.split(",")[1];
        sendVideoFrame(base64Data);
      }
    };

    videoIntervalRef.current = window.setInterval(captureAndSendFrame, 1000);

    return () => {
      if (videoIntervalRef.current) {
        clearInterval(videoIntervalRef.current);
        videoIntervalRef.current = null;
      }
    };
  }, [isConnected, isCameraActive, isScreenActive, sendVideoFrame]);

  // Scroll ข้อความลงข้างล่างสุดอัตโนมัติ
  const messageEndRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="console-container" style={{ display: "flex", flexDirection: "column", height: "90vh", width: "100%", maxWidth: "1280px", margin: "0 auto", padding: "20px", gap: "20px" }}>
      <canvas ref={canvasRef} width="480" height="360" style={{ display: "none" }} />

      {/* Header Panel */}
      <header className="glass-panel" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div className="api-badge" style={{
            background: "linear-gradient(135deg, var(--color-primary), var(--color-accent))",
            borderRadius: "10px", padding: "8px", display: "flex", alignItems: "center", justifyContent: "center"
          }}>
            <Cpu size={24} color="#fff" />
          </div>
          <div>
            <h1 style={{ fontSize: "1.3rem", fontWeight: "700", letterSpacing: "-0.02em" }}>Gemini Live Workspace</h1>
            <p style={{ fontSize: "0.8rem", color: "var(--color-text-secondary)" }}>โต้ตอบกับ Gemini 2.0 Real-time Multimodal API</p>
          </div>
        </div>

        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          {isConnected && (
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginRight: "12px", background: "rgba(16, 185, 129, 0.1)", padding: "6px 12px", borderRadius: "20px", border: "1px solid rgba(16, 185, 129, 0.2)" }}>
              <span style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: "var(--color-success)", display: "inline-block", boxShadow: "0 0 8px var(--color-success)" }} className="pulsing-wave" />
              <span style={{ fontSize: "0.85rem", color: "var(--color-success)", fontWeight: 500 }}>Live Connected</span>
            </div>
          )}

          <button 
            onClick={() => setShowSettings(!showSettings)} 
            className="premium-btn" 
            style={{ 
              background: showSettings ? "rgba(255,255,255,0.1)" : "transparent", 
              border: "1px solid var(--border-glass)", 
              padding: "10px", 
              borderRadius: "12px" 
            }}
          >
            <Settings size={20} color="var(--color-text-secondary)" />
          </button>

          <button 
            onClick={handleToggleConnection} 
            className={`premium-btn ${isConnected ? "premium-btn-danger" : "premium-btn-primary"}`}
            style={{ minWidth: "160px" }}
          >
            {isConnected ? (
              <>
                <Square size={18} fill="#fff" /> Disconnect
              </>
            ) : (
              <>
                <Play size={18} fill="#fff" /> Connect Live
              </>
            )}
          </button>
        </div>
      </header>

      {/* Main Workspace */}
      <div style={{ display: "grid", gridTemplateColumns: showSettings ? "1fr 320px" : "1fr", gap: "20px", flex: 1, minHeight: 0, transition: "grid-template-columns 0.3s ease" }}>
        
        <div style={{ display: "grid", gridTemplateRows: "1fr auto", gap: "20px", minHeight: 0 }}>
          
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", minHeight: 0 }}>
            
            {/* ฝั่งซ้าย: Media Feeds */}
            <div className="glass-panel" style={{ display: "flex", flexDirection: "column", padding: "20px", gap: "16px", minHeight: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h2 style={{ fontSize: "1.1rem", fontWeight: "600" }}>Media Inputs (ภาพนำเข้า)</h2>
                <div style={{ display: "flex", gap: "8px" }}>
                  <button 
                    disabled={!isConnected}
                    onClick={() => isCameraActive ? stopCamera() : startCamera()}
                    className="premium-btn"
                    style={{ 
                      padding: "8px 12px", 
                      borderRadius: "10px",
                      fontSize: "0.85rem",
                      background: isCameraActive ? "rgba(239, 68, 68, 0.15)" : "rgba(255,255,255,0.05)",
                      border: "1px solid var(--border-glass)",
                      color: isCameraActive ? "var(--color-danger)" : "var(--color-text-primary)"
                    }}
                  >
                    {isCameraActive ? <VideoOff size={16} /> : <Video size={16} />}
                    {isCameraActive ? "ปิดกล้อง" : "เปิดกล้อง"}
                  </button>

                  <button 
                    disabled={!isConnected}
                    onClick={() => isScreenActive ? stopScreenShare() : startScreenShare()}
                    className="premium-btn"
                    style={{ 
                      padding: "8px 12px", 
                      borderRadius: "10px",
                      fontSize: "0.85rem",
                      background: isScreenActive ? "rgba(239, 68, 68, 0.15)" : "rgba(255,255,255,0.05)",
                      border: "1px solid var(--border-glass)",
                      color: isScreenActive ? "var(--color-danger)" : "var(--color-text-primary)"
                    }}
                  >
                    {isScreenActive ? <MonitorOff size={16} /> : <Monitor size={16} />}
                    {isScreenActive ? "หยุดแชร์" : "แชร์หน้าจอ"}
                  </button>
                </div>
              </div>

              <div style={{ flex: 1, display: "grid", gridTemplateRows: isCameraActive && isScreenActive ? "1fr 1fr" : "1fr", gap: "12px", minHeight: 0 }}>
                {isCameraActive && (
                  <div style={{ position: "relative", borderRadius: "12px", overflow: "hidden", background: "#02040a", border: "1px solid rgba(255,255,255,0.05)" }}>
                    <video ref={videoRef} autoPlay playsInline muted style={{ width: "100%", height: "100%", objectFit: "cover", transform: "scaleX(-1)" }} />
                    <span style={{ position: "absolute", bottom: "10px", left: "10px", background: "rgba(0,0,0,0.6)", padding: "4px 8px", borderRadius: "6px", fontSize: "0.75rem", backdropFilter: "blur(4px)" }}>Camera Feed</span>
                  </div>
                )}

                {isScreenActive && (
                  <div style={{ position: "relative", borderRadius: "12px", overflow: "hidden", background: "#02040a", border: "1px solid rgba(255,255,255,0.05)" }}>
                    <video ref={screenRef} autoPlay playsInline muted style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                    <span style={{ position: "absolute", bottom: "10px", left: "10px", background: "rgba(0,0,0,0.6)", padding: "4px 8px", borderRadius: "6px", fontSize: "0.75rem", backdropFilter: "blur(4px)" }}>Screen Sharing Feed</span>
                  </div>
                )}

                {!isCameraActive && !isScreenActive && (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "12px", border: "2px dashed var(--border-glass)", borderRadius: "12px", background: "rgba(255,255,255,0.01)" }}>
                    <AlertCircle size={32} color="var(--color-text-muted)" />
                    <p style={{ fontSize: "0.9rem", color: "var(--color-text-muted)" }}>ไม่ได้แชร์ภาพ (เปิดกล้อง หรือ แชร์หน้าจอเพื่อให้ AI วิเคราะห์ภาพได้)</p>
                  </div>
                )}
              </div>
            </div>

            {/* ฝั่งขวา: ปริวรรตแชต */}
            <div className="glass-panel" style={{ display: "flex", flexDirection: "column", padding: "20px", gap: "16px", minHeight: 0 }}>
              <h2 style={{ fontSize: "1.1rem", fontWeight: "600" }}>Live Transcript (ข้อความสนทนา)</h2>
              
              <div className="messages-box" style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "12px", padding: "8px", background: "rgba(0,0,0,0.15)", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.02)" }}>
                {messages.length === 0 ? (
                  <div style={{ display: "flex", flex: 1, alignItems: "center", justifyContent: "center", color: "var(--color-text-muted)", fontSize: "0.9rem" }}>
                    เชื่อมต่อแล้วเริ่มพูดเพื่อเริ่มบทสนทนา...
                  </div>
                ) : (
                  messages.map((msg, i) => (
                    <div key={i} style={{ whiteSpace: "pre-wrap", fontSize: "0.95rem", lineHeight: "1.6", color: i % 2 === 0 ? "var(--color-text-secondary)" : "#fff" }}>
                      {i % 2 === 0 ? (
                        <strong>⚡ ระบบ/คุณ:</strong>
                      ) : (
                        <strong style={{ color: "var(--color-primary)" }}>✨ Gemini:</strong>
                      )}{" "}
                      {msg}
                    </div>
                  ))
                )}
                <div ref={messageEndRef} />
              </div>
            </div>
          </div>

          {/* แถบควบคุมเสียงดักฟัง */}
          <footer className="glass-panel" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 24px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
              <span style={{ fontSize: "0.9rem", color: "var(--color-text-secondary)", fontWeight: 500 }}>Microphone Status:</span>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ 
                  width: "10px", 
                  height: "10px", 
                  borderRadius: "50%", 
                  backgroundColor: isRecording ? "var(--color-success)" : "var(--color-text-muted)",
                  boxShadow: isRecording ? "0 0 10px var(--color-success)" : "none"
                }} />
                <span style={{ fontSize: "0.9rem", color: isRecording ? "var(--color-text-primary)" : "var(--color-text-muted)", fontWeight: 500 }}>
                  {isRecording ? "กำลังดักฟังและส่งเสียง..." : "ปิดไมโครโฟน"}
                </span>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
              <span style={{ fontSize: "0.9rem", color: "var(--color-text-secondary)" }}>สถานะเสียงพูด AI:</span>
              <AudioVisualizer isActive={isAiPlayingAudio} color="var(--color-accent)" count={15} />
            </div>
          </footer>
        </div>

        {/* แถบการตั้งค่า */}
        {showSettings && (
          <aside className="glass-panel" style={{ display: "flex", flexDirection: "column", padding: "20px", gap: "20px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <Key size={18} color="var(--color-primary)" />
              <h3 style={{ fontSize: "1rem", fontWeight: "600" }}>การตั้งค่าการเชื่อมต่อ</h3>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <label style={{ fontSize: "0.8rem", color: "var(--color-text-secondary)", fontWeight: 500 }}>API KEY (Google AI Studio)</label>
              <input 
                type="password"
                placeholder="ป้อน API Key ที่นี่..."
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="premium-input"
              />
              <span style={{ fontSize: "0.72rem", color: "var(--color-text-muted)" }}>*สร้างได้ฟรีที่เว็บบราวเซอร์ Google AI Studio</span>
              {connectionError && (
                <span style={{ fontSize: "0.75rem", color: "var(--color-danger)" }}>{connectionError}</span>
              )}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "6px", flex: 1 }}>
              <label style={{ fontSize: "0.8rem", color: "var(--color-text-secondary)", fontWeight: 500 }}>System Instruction</label>
              <textarea 
                rows={10}
                placeholder="กำหนดหน้าที่ความรับผิดชอบของ AI..."
                value={systemInstruction}
                onChange={(e) => setSystemInstruction(e.target.value)}
                className="premium-input"
                style={{ resize: "none", flex: 1, fontSize: "0.85rem" }}
              />
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
