/**
 * Mikrofon → Rahmen.
 *
 * Ein AudioWorklet bekommt vom Browser Blöcke zu 128 Proben – rund 375
 * Stück je Sekunde. Jeden einzeln an den Hauptfaden zu schicken wäre
 * Verschwendung; dieser Prozessor sammelt sie zu Rahmen von etwa 20
 * Millisekunden und schickt erst die.
 *
 * Bewusst dumm gehalten: Er rechnet nichts um und entscheidet nichts. Die
 * Abtastrate steht als `sampleRate` im Worklet-Kontext und wird
 * mitgeschickt, weil nicht jeder Browser die gewünschte Rate liefert –
 * Safari ignoriert die Angabe regelmäßig. Umrechnen und Beurteilen
 * geschieht im Hauptfaden, wo es geprüft werden kann.
 *
 * Statische Datei mit Absicht: Die Website ist ein statischer Export,
 * `addModule` braucht eine echte URL, kein Bündel.
 */
class PcmWorklet extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const frameMs = options?.processorOptions?.frameMs ?? 20;
    this.frameLength = Math.max(1, Math.round((sampleRate * frameMs) / 1000));
    this.buffer = new Float32Array(this.frameLength);
    this.filled = 0;
    this.running = true;
    this.port.onmessage = (event) => {
      if (event.data === "stop") this.running = false;
    };
    // Einmal die tatsächliche Rate melden, damit der Hauptfaden weiß,
    // ob er neu abtasten muss.
    this.port.postMessage({ type: "ready", sampleRate, frameLength: this.frameLength });
  }

  process(inputs) {
    if (!this.running) return false;
    const channel = inputs[0]?.[0];
    if (!channel) return true;

    let offset = 0;
    while (offset < channel.length) {
      const room = this.frameLength - this.filled;
      const take = Math.min(room, channel.length - offset);
      this.buffer.set(channel.subarray(offset, offset + take), this.filled);
      this.filled += take;
      offset += take;
      if (this.filled === this.frameLength) {
        // Eine Kopie schicken: Der Puffer wird sofort weiterbeschrieben.
        const frame = this.buffer.slice(0);
        this.port.postMessage({ type: "frame", frame }, [frame.buffer]);
        this.filled = 0;
      }
    }
    return true;
  }
}

registerProcessor("pcm-worklet", PcmWorklet);
