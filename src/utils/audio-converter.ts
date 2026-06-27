/**
 * แปลงสัญญาณเสียงจาก Float32Array (Web Audio API) ไปเป็น Int16Array (16-bit PCM Little-Endian)
 * ซึ่งเป็นรูปแบบข้อมูลเสียงที่ Gemini Live API ต้องการ
 */
export function convertFloat32ToInt16(float32Array: Float32Array): Int16Array {
  const buffer = new Int16Array(float32Array.length);
  for (let i = 0; i < float32Array.length; i++) {
    // จำกัดช่วงข้อมูลให้อยู่ใน -1.0 ถึง 1.0 เพื่อความปลอดภัย
    const s = Math.max(-1, Math.min(1, float32Array[i]));
    // แปลงเป็นค่า 16-bit Signed Integer (-32768 ถึง 32767)
    buffer[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return buffer;
}

/**
 * แปลง ArrayBuffer หรือ TypedArray ไปเป็น Base64 String
 */
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * แปลง Base64 String กลับมาเป็น ArrayBuffer
 */
export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}
