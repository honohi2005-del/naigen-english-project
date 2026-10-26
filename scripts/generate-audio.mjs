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
const model = 'gemini-3.8-flash-tts';
const voice = 'Algieba';
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) throw new Error('GEMINI_API_KEY is not set.');

const context = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(root, 'data.js'), 'utf8'), context);
const items = context.window.MAXIMS;
if (!Array.isArray(items) || !items.length) throw new Error('No English text found in data.js.');
const onlyId = process.argv.find(arg => arg.startsWith('--id='))?.slice(5);
const selected = onlyId ? items.filter(item => String(item.id) === onlyId) : items;
if (!selected.length) throw new Error(`Unknown id: ${onlyId}`);
fs.mkdirSync(audioDir, { recursive: true });

let entries = [];
if (fs.existsSync(manifestPath)) {
  const previous = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (previous.model === model && previous.voice === voice) entries = previous.assets || [];
}
const byId = new Map(entries.map(entry => [entry.id, entry]));
const writeManifest = () => fs.writeFileSync(manifestPath, `${JSON.stringify({ model, voice, assets: [...byId.values()].sort((a, b) => a.id - b.id) }, null, 2)}\n`, 'utf8');
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const fileFor = id => `q${String(id).padStart(3, '0')}.mp3`;

async function requestAudio(text) {
  const body = {
    model,
    input: [{ type: 'user_input', content: [{ type: 'text', text, annotations: [{ type: 'speech_metadata', style: 'Calm, clear, unhurried General American English with a naturally low male speaking voice.' }] }] }],
    response_format: { type: 'audio' },
    generation_config: { speech_config: [{ voice }] },
  };
  for (let attempt = 1; attempt <= 5; attempt++) {
    let response;
    try {
      response = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey }, body: JSON.stringify(body), signal: AbortSignal.timeout(120000),
      });
    } catch (error) {
      if (attempt === 5) throw new Error(`Gemini request failed: ${error.name}`);
      await pause(2000 * attempt);
      continue;
    }
    if (response.status === 429 || response.status >= 500) {
      if (attempt === 5) throw new Error(`Gemini HTTP ${response.status} after 5 attempts.`);
      await pause(3000 * attempt);
      continue;
    }
    if (!response.ok) {
      const failureBody = (await response.text()).replaceAll(apiKey, '[REDACTED]');
      let problem = {};
      try { problem = JSON.parse(failureBody); } catch { /* Keep a short diagnostic below. */ }
      throw new Error(`Gemini HTTP ${response.status}: ${String(problem.error?.message || failureBody || 'unknown error').slice(0, 400)}`);
    }
    const result = await response.json();
    const blocks = (result.steps || []).flatMap(step => step.content || []);
    const audio = blocks.filter(block => block.type === 'audio' && block.data).at(-1);
    if (!audio) throw new Error('Gemini response contained no audio block.');
    return Buffer.from(audio.data, 'base64');
  }
}

function convertAndCheck(wav, target) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'naigen-tts-'));
  const wavPath = path.join(tempDir, 'voice.wav');
  const mp3Path = path.join(tempDir, 'voice.mp3');
  try {
    fs.writeFileSync(wavPath, wav);
    const encoded = spawnSync('ffmpeg', ['-v', 'error', '-nostdin', '-y', '-i', wavPath, '-codec:a', 'libmp3lame', '-b:a', '96k', '-ar', '24000', '-ac', '1', mp3Path], { encoding: 'utf8' });
    if (encoded.status !== 0) throw new Error(`ffmpeg failed: ${encoded.stderr.trim()}`);
    const probed = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_name:format=duration', '-of', 'json', mp3Path], { encoding: 'utf8' });
    if (probed.status !== 0) throw new Error(`ffprobe failed: ${probed.stderr.trim()}`);
    const info = JSON.parse(probed.stdout);
    const seconds = Number(info.format?.duration);
    if (info.streams?.[0]?.codec_name !== 'mp3' || !(seconds > 0.3)) throw new Error('Encoded MP3 has no usable audio.');
    fs.copyFileSync(mp3Path, target);
    return Math.round(seconds * 100) / 100;
  } finally {
    for (const file of [wavPath, mp3Path]) if (fs.existsSync(file)) fs.unlinkSync(file);
    fs.rmdirSync(tempDir);
  }
}

let nextIndex = 0;
let failed = false;
async function worker() {
  while (nextIndex < selected.length) {
    const item = selected[nextIndex++];
    const file = fileFor(item.id);
    const target = path.join(audioDir, file);
    const textSha256 = crypto.createHash('sha256').update(item.en, 'utf8').digest('hex');
    if (byId.get(item.id)?.textSha256 === textSha256 && fs.existsSync(target)) {
      console.log(`${file}: already current`);
      continue;
    }
    try {
      const wav = await requestAudio(item.en);
      const seconds = convertAndCheck(wav, target);
      byId.set(item.id, { id: item.id, file, textSha256, seconds });
      writeManifest();
      console.log(`${file}: ${seconds}s`);
    } catch (error) {
      failed = true;
      console.error(`${file}: ${error.message}`);
    }
  }
}
await Promise.all([worker(), worker()]);
if (failed) process.exitCode = 1;
