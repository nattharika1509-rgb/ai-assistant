🛠️ ชุดเครื่องมือที่จำเป็น (Tech Stack)
ในการสร้างและรันแอปพลิเคชันลักษณะนี้ คุณต้องเตรียมเครื่องมือตามโครงสร้างดังนี้:

Core Runtime & Package Manager: Node.js (แนะนำเวอร์ชัน 18 ขึ้นไป) และ npm สำหรับรันสภาพแวดล้อม

Version Control: Git สำหรับดึงโค้ดต้นแบบจากคลังข้อมูล

Frontend Framework: React.js (มักทำงานร่วมกับ Vite) สำหรับสร้างส่วนติดต่อผู้ใช้ (UI) และจัดการการเข้าถึงกล้อง/ไมโครโฟน

Backend Service: Google Gemini Multimodal Live API (ใช้งานผ่าน WebSockets เพื่อการโต้ตอบที่ไร้ความหน่วง)

AI Coding Assistant: Cursor IDE หรือ GitHub Copilot (เครื่องมือเหล่านี้มี AI ฝังในตัว ช่วยให้อ่านและเขียนโค้ดได้ตรงกับบริบทของโปรเจกต์มากที่สุด)

📋 เวิร์กโฟลว์การติดตั้งและทำงาน (Development Workflow)
เพื่อให้งานสำเร็จอย่างเป็นระบบและลดข้อผิดพลาด ให้ดำเนินการตามลำดับขั้นต่อไปนี้:

จัดเตรียม Credentials: เข้าสู่ระบบ Google AI Studio เพื่อสร้าง API Key สำหรับโปรเจกต์

ดึงข้อมูลต้นแบบ (Clone): เปิด Terminal แล้วดึงซอร์สโค้ดต้นแบบของ Google ด้วยคำสั่ง:
git clone https://github.com/google-gemini/multimodal-live-api-web-console.git (หมายเหตุ: ชื่อ Repository อาจมีการเปลี่ยนแปลง ให้อ้างอิงจากเอกสารทางการของ Google)

ติดตั้ง Dependencies: เข้าไปในโฟลเดอร์โปรเจกต์แล้วรันคำสั่ง npm install

ตั้งค่าความปลอดภัย (Environment Variables): สร้างไฟล์ .env ในโฟลเดอร์หลัก และใส่ค่า API Key ลงไป (เช่น VITE_GEMINI_API_KEY=your_api_key_here)

ทดสอบระบบ (Local Development): รันคำสั่ง npm run dev ระบบจะเปิดเซิร์ฟเวอร์จำลองให้คุณทดสอบการทำงานผ่านเบราว์เซอร์ (เช่น localhost:5173)

ปรับแต่งด้วย AI (Customization): ใช้ Prompt สั่งให้ AI ปรับแต่งโค้ดตามความต้องการทางธุรกิจของคุณ

💻 คำสั่ง Prompt สำหรับให้ AI พัฒนา (AI Developer Prompts)
เพื่อให้ AI เขียนโค้ดหรือให้คำแนะนำได้อย่างแม่นยำ คุณต้องกำหนดบริบท (Context) ให้ชัดเจน ห้ามใช้คำสั่งกว้างๆ เช่น "เขียนแอป Gemini ให้หน่อย" เด็ดขาด แต่ให้ใช้โครงสร้างคำสั่งแบบเจาะจง ดังนี้ครับ:

Prompt 1: สำหรับการทำความเข้าใจและเซ็ตอประบบเบื้องต้น

"Act as a Senior Frontend Developer. I have just cloned the official Google Gemini Multimodal Live API web console repository (React + Vite). My goal is to run this locally and understand its architecture.

Explain the directory structure of this specific repository.

What are the essential WebSockets components used to establish a real-time connection with the Gemini Live API?

Provide a checklist for securing the API Key in a production environment."

Prompt 2: สำหรับการเพิ่มฟีเจอร์การแชร์หน้าจอ (Screen Sharing) แบบในวิดีโอ

"In my React application using the Gemini Multimodal Live API, I need to implement a screen-sharing feature alongside the webcam feed. The system needs to capture a specific window (like a web browser or an iPad mirrored screen) and send those video frames to the Gemini API via WebSockets.
Please provide the React component code using the navigator.mediaDevices.getDisplayMedia() API. Include error handling for user permission denials, and show how to encode the video frames (e.g., Base64 or Blob) correctly to match the payload format required by the Gemini Live API."

Prompt 3: สำหรับการจัดการ System Instructions เพื่อให้ AI มีบุคลิกเฉพาะ

"I want to customize the persona of the Gemini Live API agent. Currently, the WebSocket connection initialization requires a system instruction payload.
Please write the exact JSON payload configuration required for the setup message. The instruction should force the AI to act as a 'Professional Travel Consultant' who analyzes visual maps (Google Earth) and answers concisely in Thai. Show me exactly where in the React WebSocket connection lifecycle this setup message should be sent."
