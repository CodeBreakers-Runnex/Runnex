import { BleClient } from "@capacitor-community/bluetooth-le";

const SERVICE = "0000180d-0000-1000-8000-00805f9b34fb";
const MEASUREMENT = "00002a37-0000-1000-8000-00805f9b34fb";

export function decodeHeartRate(value: DataView): number | null {
  if (value.byteLength < 2) return null;
  const flags = value.getUint8(0);
  if ((flags & 4) && !(flags & 2)) return null; // sensor contact supported but absent
  if ((flags & 1) && value.byteLength < 3) return null;
  const bpm = flags & 1 ? value.getUint16(1, true) : value.getUint8(1);
  return bpm >= 25 && bpm <= 250 ? bpm : null;
}

export async function connectHeartRate(onReading: (bpm: number) => void, onDisconnect: () => void, onGap: () => void) {
  await BleClient.initialize();
  const device = await BleClient.requestDevice({ services: [SERVICE] });
  try {
    await BleClient.connect(device.deviceId, onDisconnect);
    await BleClient.startNotifications(device.deviceId, SERVICE, MEASUREMENT, value => {
      const bpm = decodeHeartRate(value);
      if (bpm !== null) onReading(bpm);
      else onGap();
    });
  } catch (error) {
    await BleClient.disconnect(device.deviceId).catch(() => undefined);
    throw error;
  }
  return { name: device.name || "Sensor cardíaco", disconnect: () => BleClient.disconnect(device.deviceId) };
}
