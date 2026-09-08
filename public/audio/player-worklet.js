/**
 * Rahmen → Lautsprecher, mit einem Notaus.
 *
 * Die Ausgabe läuft über einen Ringpuffer, damit ein Netzruckler keine
 * Lücke im Satz erzeugt. Entscheidend ist die Nachricht `flush`: Sie
 * verwirft alles Gepufferte sofort. Ohne sie redet der Assistent nach
 * einer Unterbrechung noch sekundenlang weiter, weil der Ton längst im
 * Puffer liegt – und genau das darf nicht passieren.
 *
 * Reihenfolge beim Unterbrechen: erst hier leeren, dann die Erzeugung
 * abbrechen. Andersherum füllt der noch laufende Erzeuger den gerade
 * geleerten Puffer sofort wieder.
 */
class PlayerWorklet extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const seconds = options?.processorOptions?.bufferSeconds ?? 10;
    this.ring = new Float32Array(Math.max(1, Math.round(sampleRate * seconds)));
    this.read = 0;
    this.write = 0;
    this.available = 0;
    this.gain = 1;
    this.port.onmessage = (event) => {
      const data = event.data;
      if (data === "flush") {
        this.read = 0;
        this.write = 0;
        this.available = 0;
        this.port.postMessage({ type: "flushed" });
        return;
      }
      if (data?.type === "gain") {
        this.gain = Math.max(0, Math.min(1, data.value ?? 1));
        return;
      }
      if (data?.type === "frame" && data.frame) this.push(data.frame);
    };
  }

  push(frame) {
    for (let i = 0; i < frame.length; i++) {
      if (this.available >= this.ring.length) break; // lieber abschneiden als überschreiben
      this.ring[this.write] = frame[i];
      this.write = (this.write + 1) % this.ring.length;
      this.available += 1;
    }
  }

  process(_inputs, outputs) {
    const out = outputs[0]?.[0];
    if (!out) return true;
    for (let i = 0; i < out.length; i++) {
      if (this.available === 0) {
        out[i] = 0;
        continue;
      }
      out[i] = this.ring[this.read] * this.gain;
      this.read = (this.read + 1) % this.ring.length;
      this.available -= 1;
    }
    return true;
  }
}

registerProcessor("player-worklet", PlayerWorklet);
