import { promise as ping } from "ping";

export async function probeHost(host, probe = ping.probe) {
  if (!host) {
    return null;
  }
  try {
    const response = await probe(host);
    return {
      alive: Boolean(response?.alive),
      time: response?.time ?? null,
    };
  } catch {
    return { alive: false, time: null };
  }
}
