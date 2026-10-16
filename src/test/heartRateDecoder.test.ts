import { describe, expect, it } from "vitest";
import { decodeHeartRate } from "@/services/heartRateSensor";
import { formatDuration } from "@/lib/performance";
const view = (...bytes: number[]) => new DataView(Uint8Array.from(bytes).buffer);
describe("Heart Rate Measurement BLE", () => {
  it("decodes 8 and 16 bit little-endian measurements", () => {
    expect(decodeHeartRate(view(0, 150))).toBe(150);
    expect(decodeHeartRate(view(1, 220, 0))).toBe(220);
  });
  it("rejects missing contact, truncated packets and invalid readings", () => {
    expect(decodeHeartRate(view(4, 150))).toBeNull();
    expect(decodeHeartRate(view(6, 150))).toBe(150);
    expect(decodeHeartRate(view(1, 150))).toBeNull();
    expect(decodeHeartRate(view(0, 0))).toBeNull();
  });
});
describe("performance duration", () => {
  it("carries rounded seconds and formats marathon durations", () => {
    expect(formatDuration(299.9)).toBe("05:00");
    expect(formatDuration(3661)).toBe("1:01:01");
  });
});
