import { describe, it, expect } from "vitest";
import { convertFloat32ToInt16, arrayBufferToBase64, base64ToArrayBuffer } from "../audio-converter";

describe("Audio Converter Utilities", () => {
  
  describe("convertFloat32ToInt16", () => {
    it("should correctly convert float32 values in range [-1, 1] to 16-bit signed PCM", () => {
      const floatInput = new Float32Array([0, 1, -1, 0.5, -0.5]);
      const expectedInt16 = new Int16Array([
        0, 
        32767, // Maximum positive 16-bit int (0x7fff)
        -32768, // Maximum negative 16-bit int (-0x8000)
        16383, // 0.5 * 32767
        -16384 // -0.5 * 32768
      ]);

      const result = convertFloat32ToInt16(floatInput);
      expect(result).toEqual(expectedInt16);
    });

    it("should clamp values outside of [-1, 1] range to avoid overflow", () => {
      const floatInput = new Float32Array([1.5, -2.0, 999.0, -999.0]);
      const expectedInt16 = new Int16Array([32767, -32768, 32767, -32768]);

      const result = convertFloat32ToInt16(floatInput);
      expect(result).toEqual(expectedInt16);
    });

    it("should handle empty Float32Array input without throwing", () => {
      const floatInput = new Float32Array([]);
      const result = convertFloat32ToInt16(floatInput);
      expect(result.length).toBe(0);
      expect(result).toBeInstanceOf(Int16Array);
    });
  });

  describe("Base64 and ArrayBuffer Conversions", () => {
    it("should correctly encode and decode binary buffers using Base64", () => {
      const originalBytes = new Uint8Array([71, 101, 109, 105, 110, 105, 32, 76, 105, 118, 101]); // ข้อความ "Gemini Live"
      const base64String = arrayBufferToBase64(originalBytes.buffer);
      expect(base64String).toBe("R2VtaW5pIExpdmU=");

      const decodedBuffer = base64ToArrayBuffer(base64String);
      const decodedBytes = new Uint8Array(decodedBuffer);
      expect(decodedBytes).toEqual(originalBytes);
    });

    it("should handle empty strings and buffers", () => {
      const emptyBuffer = new Uint8Array([]);
      const base64String = arrayBufferToBase64(emptyBuffer.buffer);
      expect(base64String).toBe("");

      const decodedBuffer = base64ToArrayBuffer(base64String);
      const decodedBytes = new Uint8Array(decodedBuffer);
      expect(decodedBytes.length).toBe(0);
    });
  });

});
