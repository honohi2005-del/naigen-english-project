import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import vm from 'node:vm';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourcePath = path.join(root, 'app.js');
const outputDir = path.join(root, 'audio', 'topic-speeches');
const manifestPath = path.join(outputDir, 'manifest.json');
const model = 'gemini-3.8-flash-tts';
const voice = 'Algieba';
const style = 'Calm, clear, unhurried General American English with a naturally low male speaking voice.';
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) throw new Error('GEMINI_API_KEY is not set.');

const topicSlugs = {
  '意味と思索': 'meaning',
  '学びと思考': 'learning',
  '行動と内省': 'action',
  '発音と身体': 'voice',
  '表現と学習': 'expression',
};
const source = fs.readFileSync(sourcePath, 'utf8');
const marker = 'const topicSpeechSets = ';
const start = source.indexOf(marker);
const end = source.indexOf('  const topicSpeechHistory', start);
if (start < 0 || end < 0) throw new Error('Could not locate topic speech data in app.js.');
const literal = source.slice(start + marker.length, end).trim().replace(/;\s*$/, '');
const speechSets = vm.runInNewContext(`(${literal})`);
const entries = Object.entries(speechSets).flatMap(([topic, speeches]) => {
  const slug = topicSlugs[topic];
  if (!slug || !Array.isArray(speeches) || speeches.length !== 15) throw new Error(`Unexpected topic speech set: ${topic}`);
  return speeches.map((text, index) => {
    const wordCount = text.trim().split(/\s+/).length;
    if (wordCount < 60 || wordCount > 70) throw new Error(`${topic} speech ${index + 1} has ${wordCount} words.`);
    return { id: `${slug}-${String(index + 1).padStart(2, '0')}`, topic, text, wordCount, file: `${slug}-${String(index + 1).padStart(2, '0')}.mp3` };
  });
});
if (entries.length !== 75 || new Set(entries.map(entry => entry.text)).size !== entries.length) {
  throw new Error(`Expected 75 unique topic speeches; found ${entries.length}.`);
}

fs.mkdirSync(outputDir, { recursive: true });
const previous = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : {};
const records = new Map((previous.model === model && previous.voice === voice ? previous.assets || [] : []).map(asset => [asset.id, asset]));
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const digest = value => crypto.createHash('sha256').update(value).digest('hex');

function inspectMp3(file) {
  const probed = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_name:format=duration', '-of', 'json', file], { encoding: 'utf8' });
  if (probed.status !== 0) return null;
  try {
    const info = JSON.parse(probed.stdout);
    const seconds = Number(info.format?.duration);
    return info.streams?.some(stream => stream.codec_name === 'mp3') && seconds > 0.3 ? Math.round(seconds * 100) / 100 : null;
  } catch { return null; }
}

async function requestAudio(text) {
  const body = {
    model,
    input: [{ type: 'user_input', content: [{ type: 'text', text, annotations: [{ type: 'speech_metadata', style }] }] }],
    response_format: { type: 'audio' },
    generation_config: { speech_config: [{ voice }] },
  };
  for (let attempt = 1; attempt <= 5; attempt++) {
    let response;
    try {
      response = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(120000),
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
    const audio = (result.steps || []).flatMap(step => step.content || []).filter(block => block.type === 'audio' && block.data).at(-1);
    if (!audio) throw new Error('Gemini response contained no audio block.');
    return Buffer.from(audio.data, 'base64');
  }
  throw new Error('Gemini request attempts exhausted.');
}

function encodeAndCheck(audioBytes, target) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'topic-tts-'));
  const sourcePath = path.join(tempDir, 'source-audio');
  const outputPath = path.join(tempDir, 'speech.mp3');
  try {
    fs.writeFileSync(sourcePath, audioBytes);
    const encoded = spawnSync('ffmpeg', ['-v', 'error', '-nostdin', '-y', '-i', sourcePath, '-codec:a', 'libmp3lame', '-b:a', '96k', '-ar', '24000', '-ac', '1', outputPath], { encoding: 'utf8' });
    if (encoded.status !== 0) throw new Error(`ffmpeg failed: ${encoded.stderr.trim()}`);
    const seconds = inspectMp3(outputPath);
    if (!seconds) throw new Error('Encoded MP3 has no usable audio.');
    fs.copyFileSync(outputPath, target);
    return seconds;
  } finally {
    for (const file of [sourcePath, outputPath]) if (fs.existsSync(file)) fs.unlinkSync(file);
    fs.rmdirSync(tempDir);
  }
}

function writeManifest() {
  const assets = entries.map(entry => records.get(entry.id)).filter(Boolean);
  fs.writeFileSync(manifestPath, `${JSON.stringify({ model, voice, style, generatedAt: new Date().toISOString(), assets }, null, 2)}\n`, 'utf8');
}

let nextIndex = 0;
let failed = false;
let complete = 0;
async function worker() {
  while (nextIndex < entries.length) {
    const entry = entries[nextIndex++];
    const target = path.join(outputDir, entry.file);
    const textSha256 = digest(entry.text);
    const existing = records.get(entry.id);
    if (existing?.textSha256 === textSha256 && fs.existsSync(target) && inspectMp3(target)) {
      complete++;
      console.log(`Audio ${complete}/${entries.length} ready: ${entry.id}`);
      continue;
    }
    try {
      const audioBytes = await requestAudio(entry.text);
      const seconds = encodeAndCheck(audioBytes, target);
      const revision = digest(fs.readFileSync(target)).slice(0, 12);
      records.set(entry.id, { id: entry.id, topic: entry.topic, file: entry.file, textSha256, wordCount: entry.wordCount, seconds, revision });
      writeManifest();
      complete++;
      console.log(`Audio ${complete}/${entries.length} generated: ${entry.id}`);
    } catch (error) {
      failed = true;
      complete++;
      console.error(`${entry.id}: ${error.message}`);
      console.log(`Audio ${complete}/${entries.length} finished with an error.`);
    }
  }
}

await Promise.all([worker(), worker()]);
if (failed || entries.some(entry => !records.has(entry.id))) process.exitCode = 1;
else {
  writeManifest();
  console.log(`Complete: ${entries.length} speech audio files.`);
}
