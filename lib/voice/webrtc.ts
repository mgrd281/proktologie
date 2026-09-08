/**
 * Die echte Leitung zum Anbieter.
 *
 * Getrennt von `live.ts`, weil hier Browser-Technik steht, die sich nur im
 * Browser prüfen lässt: `RTCPeerConnection`, ein Datenkanal für die
 * Ereignisse und ein Audiokanal für das Mikrofon. Die Entscheidungen –
 * wann zugehört, wann geschlossen wird – stehen nebenan und sind ohne
 * Browser prüfbar.
 *
 * Der Ablauf ist der von OpenAI vorgesehene Weg für Browser: Angebot
 * bauen, mit dem kurzlebigen Ausweis hinschicken, Antwort einsetzen.
 */

import type { LiveConnection, LiveEvents, LiveSecret } from "./live.ts";

const CALLS_URL = "https://api.openai.com/v1/realtime/calls";

/** Ereignisse, die uns interessieren. Alles andere wird verworfen. */
interface ProviderEvent {
  type?: string;
  transcript?: string;
  delta?: string;
}

export async function connectWebRtc(secret: LiveSecret, stream: MediaStream, on: LiveEvents): Promise<LiveConnection> {
  const pc = new RTCPeerConnection();
  let closed = false;

  const close = () => {
    if (closed) return;
    closed = true;
    try {
      pc.close();
    } catch {
      // Eine Leitung, die sich nicht schließen lässt, ist trotzdem zu Ende.
    }
  };

  pc.addEventListener("connectionstatechange", () => {
    if (["failed", "disconnected", "closed"].includes(pc.connectionState) && !closed) {
      on.closed(pc.connectionState);
    }
  });

  // Das Mikrofon geht hinaus; herein kommt nichts. Eine Transkriptions-
  // Sitzung sendet kein Audio zurück – das ist der Beweis, dass sie nicht
  // selbst antworten kann.
  for (const track of stream.getAudioTracks()) pc.addTrack(track, stream);

  const channel = pc.createDataChannel("oai-events");
  channel.addEventListener("message", (event: MessageEvent<string>) => {
    let data: ProviderEvent;
    try {
      data = JSON.parse(event.data) as ProviderEvent;
    } catch {
      return;
    }
    if (data.type === "input_audio_buffer.speech_started") on.speechStart();
    if (data.type === "conversation.item.input_audio_transcription.completed" && typeof data.transcript === "string") {
      on.transcript(data.transcript);
    }
  });

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);

  const res = await fetch(CALLS_URL, {
    method: "POST",
    body: offer.sdp,
    headers: { authorization: `Bearer ${secret.value}`, "content-type": "application/sdp" },
  });
  if (!res.ok) {
    close();
    throw new Error(`realtime/calls ${res.status}`);
  }
  await pc.setRemoteDescription({ type: "answer", sdp: await res.text() });

  return { close };
}
