/**
 * SyncPlay - Built-in Audio Sample Generator
 * Generates valid PCM 16-bit stereo WAV files for zero-dependency local testing.
 */

const fs = require('fs');
const path = require('path');

function createWavBuffer(sampleRate, durationSec, sampleGenerator) {
  const numChannels = 2;
  const bytesPerSample = 2; // 16-bit
  const totalSamples = Math.floor(sampleRate * durationSec);
  const dataSize = totalSamples * numChannels * bytesPerSample;
  const buffer = Buffer.alloc(44 + dataSize);

  // RIFF identifier
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);

  // fmt subchunk
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // Subchunk1Size for PCM
  buffer.writeUInt16LE(1, 20); // AudioFormat 1 = PCM
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * numChannels * bytesPerSample, 28); // ByteRate
  buffer.writeUInt16LE(numChannels * bytesPerSample, 32); // BlockAlign
  buffer.writeUInt16LE(16, 34); // BitsPerSample

  // data subchunk
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  let offset = 44;
  for (let i = 0; i < totalSamples; i++) {
    const t = i / sampleRate;
    const [leftVal, rightVal] = sampleGenerator(t, i, totalSamples);

    // Clamp to 16-bit signed integer [-32768, 32767]
    const leftInt = Math.max(-32768, Math.min(32767, Math.floor(leftVal * 32767)));
    const rightInt = Math.max(-32768, Math.min(32767, Math.floor(rightVal * 32767)));

    buffer.writeInt16LE(leftInt, offset);
    buffer.writeInt16LE(rightInt, offset + 2);
    offset += 4;
  }

  return buffer;
}

function generateSamples() {
  const outputDir = path.join(__dirname, 'public', 'audio');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const sampleRate = 44100;

  // Track 1: Sync Beat 120BPM with sharp percussive click every beat (ideal for testing sync drift)
  console.log('Generating Track 1: sync_beat.wav (20s)...');
  const duration1 = 20.0;
  const beatBuffer = createWavBuffer(sampleRate, duration1, (t) => {
    const bpm = 120;
    const beatInterval = 60 / bpm; // 0.5s per beat
    const beatPhase = (t % beatInterval) / beatInterval;
    const beatIndex = Math.floor(t / beatInterval);

    // Percussive click at the start of each beat (first 40ms)
    let click = 0;
    const timeInBeat = t % beatInterval;
    if (timeInBeat < 0.04) {
      const clickEnv = Math.exp(-timeInBeat * 120);
      const freq = beatIndex % 4 === 0 ? 1200 : 800; // Accent on downbeats
      click = Math.sin(2 * Math.PI * freq * timeInBeat) * clickEnv * 0.7;
    }

    // Bass kick on downbeat
    let bass = 0;
    if (beatIndex % 2 === 0 && timeInBeat < 0.25) {
      const bassEnv = Math.exp(-timeInBeat * 16);
      const pitchDrop = 150 * Math.exp(-timeInBeat * 30) + 45;
      bass = Math.sin(2 * Math.PI * pitchDrop * timeInBeat) * bassEnv * 0.5;
    }

    // Synth chord pad progression (Am - F - C - G)
    const chordIndex = Math.floor(t / 2) % 4;
    const chordFreqs = [
      [220, 261.63, 329.63], // Am
      [174.61, 220, 261.63], // F
      [261.63, 329.63, 392],  // C
      [196, 246.94, 293.66], // G
    ][chordIndex];

    let pad = 0;
    for (const freq of chordFreqs) {
      pad += (Math.sin(2 * Math.PI * freq * t) + 0.3 * Math.sin(2 * Math.PI * freq * 2 * t)) * 0.08;
    }

    // Left Channel: High percussive click + high synth pad
    const leftChannel = click * 0.9 + pad * 1.2;

    // Right Channel: Deep punchy sub-bass kick + low sub rumble
    const rightChannel = bass * 1.1 + (chordFreqs[0] ? Math.sin(2 * Math.PI * (chordFreqs[0] / 2) * t) * 0.2 : 0);

    return [leftChannel, rightChannel];
  });
  fs.writeFileSync(path.join(outputDir, 'sync_beat.wav'), beatBuffer);
  console.log('✓ Created sync_beat.wav (Stereo L/R separated)');

  // Track 2: Melodic Synth Groove (16s)
  console.log('Generating Track 2: melodic_groove.wav (16s)...');
  const duration2 = 16.0;
  const melodyNotes = [
    261.63, 293.66, 329.63, 392.00, 440.00, 392.00, 329.63, 293.66,
    261.63, 329.63, 392.00, 523.25, 440.00, 392.00, 349.23, 329.63
  ]; // C major pentatonic melody
  const grooveBuffer = createWavBuffer(sampleRate, duration2, (t) => {
    const noteDuration = 0.5;
    const noteIdx = Math.floor(t / noteDuration) % melodyNotes.length;
    const noteFreq = melodyNotes[noteIdx];
    const timeInNote = t % noteDuration;

    // Pluck synth envelope
    const env = Math.exp(-timeInNote * 7);
    const synth = (Math.sin(2 * Math.PI * noteFreq * t) + 0.4 * Math.sin(2 * Math.PI * noteFreq * 2 * t)) * env * 0.4;

    // Soft sub bass
    const bassFreq = (noteIdx % 4 === 0) ? 65.41 : 82.41;
    const bass = Math.sin(2 * Math.PI * bassFreq * t) * 0.25;

    // Subtle stereo spread
    return [synth * 0.9 + bass, synth * 1.1 + bass];
  });
  fs.writeFileSync(path.join(outputDir, 'melodic_groove.wav'), grooveBuffer);
  console.log('✓ Created melodic_groove.wav');
}

if (require.main === module) {
  generateSamples();
}

module.exports = { generateSamples };
