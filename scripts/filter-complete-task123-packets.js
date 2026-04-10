import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const workspaceRoot = path.resolve(__dirname, '../../..');
const dataRoot = path.join(workspaceRoot, 'task1_3_data/Alps_data_task1_3_Annotation');
const packetDir = path.join(dataRoot, 'cleaned_data/task123_session_packets');
const excludedDir = path.join(dataRoot, 'cleaned_data/task123_session_packets_excluded_incomplete');
const manifestPath = path.join(packetDir, 'manifest.json');
const excludedSummaryPath = path.join(excludedDir, 'excluded_manifest.json');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function isCompletePacket(packet) {
  const tasks = packet && typeof packet === 'object' ? packet.available_tasks : null;
  return Boolean(tasks && tasks.task1 === true && tasks.task2 === true && tasks.task3 === true);
}

function listPacketNames(dirPath) {
  if (!fs.existsSync(dirPath)) {
    return [];
  }

  return fs
    .readdirSync(dirPath)
    .filter((name) => /^sess_[^/]+\.json$/.test(name))
    .sort();
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function moveIncompletePackets() {
  ensureDir(excludedDir);

  const packetNames = listPacketNames(packetDir);
  const moved = [];
  const kept = [];

  for (const packetName of packetNames) {
    const sourcePath = path.join(packetDir, packetName);
    const packet = readJson(sourcePath);

    if (isCompletePacket(packet)) {
      kept.push(packetName);
      continue;
    }

    const targetPath = path.join(excludedDir, packetName);
    fs.renameSync(sourcePath, targetPath);
    moved.push({
      packet: packetName,
      session_id: packet.session_id ?? null,
      available_tasks: packet.available_tasks ?? null,
    });
  }

  return { moved, kept };
}

function buildManifest(packetNames) {
  return {
    output_dir: packetDir,
    session_file_count: packetNames.length,
    task1_session_count: packetNames.length,
    task2_session_count: packetNames.length,
    task3_session_count: packetNames.length,
    union_session_count: packetNames.length,
    intersection_session_count: packetNames.length,
    notes: [
      'Filtered to sessions where task1, task2, and task3 are all available.',
      'Excluded incomplete packets were moved to `task123_session_packets_excluded_incomplete`.',
      'Each JSON file contains one session packet for external annotation.',
      'task2_selected_memory and task3_selected_memory are intentionally kept as separate fields.',
      'dialogue is stored once at the top level to avoid repeating long conversations.',
    ],
  };
}

function main() {
  const beforePacketNames = listPacketNames(packetDir);
  const beforeCount = beforePacketNames.length;
  const { moved } = moveIncompletePackets();
  const remainingPacketNames = listPacketNames(packetDir);
  const excludedPacketNames = listPacketNames(excludedDir);

  writeJson(manifestPath, buildManifest(remainingPacketNames));
  writeJson(excludedSummaryPath, {
    source_dir: packetDir,
    excluded_dir: excludedDir,
    original_session_file_count: beforeCount,
    kept_session_file_count: remainingPacketNames.length,
    excluded_session_file_count: excludedPacketNames.length,
    excluded_packets: moved,
  });

  console.log(
    JSON.stringify(
      {
        originalPacketCount: beforeCount,
        keptPacketCount: remainingPacketNames.length,
        excludedPacketCount: excludedPacketNames.length,
      },
      null,
      2,
    ),
  );
}

main();
