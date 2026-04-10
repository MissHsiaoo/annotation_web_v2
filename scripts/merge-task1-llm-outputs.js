import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRoot = path.resolve(__dirname, '../../..');
const dataRoot = path.join(workspaceRoot, 'task1_3_data/Alps_data_task1_3_Annotation');
const packetDir = path.join(dataRoot, 'cleaned_data/task123_session_packets');
const task1EvalDir = path.join(dataRoot, 'task1_evaluation_data/sessions');
const task1JudgeDir = path.join(dataRoot, 'LLM_as_judge_Human_Alignment_data/task1/sessions');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function buildTask1Index() {
  const index = new Map();
  const sessionDirs = fs.readdirSync(task1EvalDir).sort();

  for (const sessionDirName of sessionDirs) {
    const itemPath = path.join(task1EvalDir, sessionDirName, 'item.json');
    if (!fs.existsSync(itemPath)) {
      continue;
    }

    const item = readJson(itemPath);
    if (!item || typeof item !== 'object' || !item.llm_outputs || typeof item.llm_outputs !== 'object') {
      continue;
    }

    const sessionId = typeof item.session_id === 'string' ? item.session_id : null;
    const canonicalId = typeof item.canonical_id === 'string' ? item.canonical_id : null;
    if (!sessionId || !canonicalId) {
      continue;
    }

    index.set(`${sessionId}::${canonicalId}`, item.llm_outputs);
  }

  return index;
}

function buildTask1JudgeFallbackIndex() {
  const index = new Map();
  const sessionDirs = fs.readdirSync(task1JudgeDir).sort();

  for (const sessionDirName of sessionDirs) {
    const itemPath = path.join(task1JudgeDir, sessionDirName, 'item.json');
    if (!fs.existsSync(itemPath)) {
      continue;
    }

    const item = readJson(itemPath);
    const availableModels =
      item && typeof item === 'object' && item.available_models && typeof item.available_models === 'object'
        ? item.available_models
        : null;

    if (!availableModels) {
      continue;
    }

    const llmOutputs = {};

    for (const [modelName, modelValue] of Object.entries(availableModels)) {
      if (!modelValue || typeof modelValue !== 'object') {
        continue;
      }

      const modelOutput =
        modelValue.model_output && typeof modelValue.model_output === 'object'
          ? modelValue.model_output
          : null;

      if (!modelOutput) {
        continue;
      }

      llmOutputs[modelName] = modelOutput;
    }

    if (Object.keys(llmOutputs).length === 0) {
      continue;
    }

    const sessionId = typeof item.session_id === 'string' ? item.session_id : null;
    const canonicalId = typeof item.canonical_id === 'string' ? item.canonical_id : null;
    if (!sessionId || !canonicalId) {
      continue;
    }

    index.set(`${sessionId}::${canonicalId}`, llmOutputs);
  }

  return index;
}

function merge() {
  const task1Index = buildTask1Index();
  const task1JudgeFallbackIndex = buildTask1JudgeFallbackIndex();
  const packetNames = fs
    .readdirSync(packetDir)
    .filter((name) => /^sess_[^/]+\.json$/.test(name))
    .sort();

  let updated = 0;
  let alreadyMatched = 0;
  let missingTask1 = 0;
  let missingLlmOutputs = 0;
  let mergedFromJudgeFallback = 0;

  for (const packetName of packetNames) {
    const packetPath = path.join(packetDir, packetName);
    const packet = readJson(packetPath);
    const task1 = packet && typeof packet === 'object' ? packet.task1 : null;

    if (!task1 || typeof task1 !== 'object') {
      missingTask1 += 1;
      continue;
    }

    const sessionId = typeof packet.session_id === 'string' ? packet.session_id : null;
    const canonicalId = typeof task1.canonical_id === 'string' ? task1.canonical_id : null;
    if (!sessionId || !canonicalId) {
      missingLlmOutputs += 1;
      continue;
    }

    const llmOutputs =
      task1Index.get(`${sessionId}::${canonicalId}`) ??
      task1JudgeFallbackIndex.get(`${sessionId}::${canonicalId}`);
    if (!llmOutputs) {
      missingLlmOutputs += 1;
      continue;
    }

    const existing = task1.llm_outputs;
    const existingJson =
      existing && typeof existing === 'object' ? JSON.stringify(existing) : null;
    const nextJson = JSON.stringify(llmOutputs);

    if (existingJson === nextJson) {
      alreadyMatched += 1;
      continue;
    }

    task1.llm_outputs = llmOutputs;
    writeJson(packetPath, packet);
    updated += 1;
    if (!task1Index.has(`${sessionId}::${canonicalId}`) && task1JudgeFallbackIndex.has(`${sessionId}::${canonicalId}`)) {
      mergedFromJudgeFallback += 1;
    }
  }

  console.log(
    JSON.stringify(
      {
        packetCount: packetNames.length,
        indexedTask1Items: task1Index.size,
        indexedTask1JudgeFallbackItems: task1JudgeFallbackIndex.size,
        updated,
        alreadyMatched,
        missingTask1,
        missingLlmOutputs,
        mergedFromJudgeFallback,
      },
      null,
      2,
    ),
  );
}

merge();
