import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import vm from 'node:vm';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const audioDir = path.join(root, 'audio');
const manifestPath = path.join(audioDir, 'manifest.json');
const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey || !/^sk-[A-Za-z0-9_-]{20,}$/.test(apiKey)) throw new Error('A valid OPENAI_API_KEY environment variable is required.');
const idsArgument = process.argv.find(argument => argument.startsWith('--ids='));
if (!idsArgument || !/^--ids=\d+(,\d+)*$/.test(idsArgument)) throw new Error('Specify displayed maxim IDs, for example --ids=224,500,536.');
const ids = [...new Set(idsArgument.slice(6).split(',').map(Number))];
const context = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(root, 'data.js'), 'utf8'), context);
const audioIdOf = item => Number(item.audioId ?? item.id);
const items = ids.map(id => {
  const item = context.window.MAXIMS.find(candidate => candidate.id === id);
  if (!item?.en) throw new Error(`No English text found for maxim ${id}.`);
  return item;
});
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const ffmpeg = process.env.FFMPEG_PATH || 'ffmpeg';
const ffprobe = process.env.FFPROBE_PATH || 'ffprobe';
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'naigen-openai-audio-'));

function run(executable, args) {
  const result = spawnSync(executable, args, { encoding: 'utf8', windowsHide: true, maxBuffer: 8 * 1024 * 1024 });
  if (result.error || result.status !== 0) throw new Error(`${path.basename(executable)} failed: ${result.error?.message || result.stderr?.slice(-1200) || result.status}`);
  return result;
}

function measure(file, target = -18) {
  const result = run(ffmpeg, ['-hide_banner', '-nostdin', '-i', file, '-af', `loudnorm=I=${target}:TP=-1.5:LRA=11:print_format=json`, '-f', 'null', '-']);
  const block = result.stderr.match(/\{\s*"input_i"[\s\S]*?\}/g)?.at(-1);
  if (!block) throw new Error('Unable to measure audio loudness.');
  const values = JSON.parse(block);
  if (!Number.isFinite(Number(values.input_i))) throw new Error('Audio is silent or has invalid loudness.');
  return values;
}

async function generateSpeech(text, destination) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o-mini-tts',
        voice: 'onyx',
        input: text,
        instructions: 'Read the text exactly as written, in calm, clear, unhurried General American English with a naturally low male speaking voice. Do not add an introduction or any other words.',
        response_format: 'wav',
      }),
      signal: AbortSignal.timeout(120000),
    });
    if (response.ok) {
      fs.writeFileSync(destination, Buffer.from(await response.arrayBuffer()));
      return;
    }
    await response.arrayBuffer();
    if (attempt === 0 && (response.status === 429 || response.status >= 500)) {
      await new Promise(resolve => setTimeout(resolve, 3000));
      continue;
    }
    throw new Error(`OpenAI speech request failed (HTTP ${response.status}).`);
  }
}

try {
  const referenceIds = context.window.MAXIMS.slice(0, 3).map(audioIdOf);
  const referenceLevels = referenceIds.map(id => Number(measure(path.join(audioDir, `q${String(id).padStart(3, '0')}.mp3`)).input_i)).sort((a, b) => a - b);
  const targetLoudness = Math.round(referenceLevels[1] * 10) / 10;
  if (targetLoudness < -70 || targetLoudness > -5) throw new Error('Reference loudness is outside supported limits.');
  console.log(`Gemini reference loudness: ${targetLoudness.toFixed(1)} LUFS`);
  const generated = [];
  for (const item of items) {
    const audioId = audioIdOf(item);
    const basename = `q${String(audioId).padStart(3, '0')}`;
    const wavPath = path.join(tempDir, `${basename}.wav`);
    const mp3Path = path.join(tempDir, `${basename}.mp3`);
    console.log(`Generating maxim ${item.id} (audio ${audioId})...`);
    await generateSpeech(item.en, wavPath);
    const measured = measure(wavPath, targetLoudness);
    const filter = `loudnorm=I=${targetLoudness}:TP=-1.5:LRA=11:measured_I=${measured.input_i}:measured_TP=${measured.input_tp}:measured_LRA=${measured.input_lra}:measured_thresh=${measured.input_thresh}:offset=${measured.target_offset}:linear=false:print_format=json`;
    run(ffmpeg, ['-hide_banner', '-nostdin', '-y', '-i', wavPath, '-af', filter, '-codec:a', 'libmp3lame', '-b:a', '96k', '-ar', '24000', '-ac', '1', mp3Path]);
    const seconds = Number(run(ffprobe, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', mp3Path]).stdout.trim());
    if (!Number.isFinite(seconds) || seconds < 1) throw new Error(`Invalid audio duration for maxim ${item.id}.`);
    run(ffmpeg, ['-v', 'error', '-nostdin', '-i', mp3Path, '-f', 'null', '-']);
    const outputLoudness = Number(measure(mp3Path, targetLoudness).input_i);
    if (Math.abs(outputLoudness - targetLoudness) > 1.75) throw new Error(`Loudness verification failed for maxim ${item.id}: target ${targetLoudness.toFixed(1)} LUFS, got ${outputLoudness.toFixed(1)} LUFS.`);
    const bytes = fs.readFileSync(mp3Path);
    generated.push({ mp3Path, asset: {
      id: audioId,
      file: `${basename}.mp3`,
      textSha256: hash(item.en),
      seconds: Math.round(seconds * 100) / 100,
      model: 'gpt-4o-mini-tts',
      voice: 'onyx',
      revision: hash(bytes).slice(0, 12),
    } });
    console.log(`Verified maxim ${item.id}: ${seconds.toFixed(2)} seconds, ${outputLoudness.toFixed(1)} LUFS`);
  }
  const assetsById = new Map(manifest.assets.map(asset => [asset.id, asset]));
  for (const { mp3Path, asset } of generated) {
    fs.copyFileSync(mp3Path, path.join(audioDir, asset.file));
    assetsById.set(asset.id, asset);
  }
  manifest.assets = [...assetsById.values()].sort((a, b) => a.id - b.id);
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  console.log(`Saved ${generated.length} audio files and updated the manifest.`);
} finally {
  fs.rmSync(tempDir, { recursive: true, force: true });
}
