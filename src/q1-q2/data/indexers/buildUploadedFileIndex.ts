import type { UploadedFileIndex } from '../../types';

function normalizePath(value: string): string {
  return value.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+/g, '/');
}

function hashString(value: string): string {
  let hash = 5381;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 33) ^ value.charCodeAt(index);
  }

  return (hash >>> 0).toString(16);
}

export function buildUploadedFileIndex(fileList: FileList | File[]): UploadedFileIndex {
  const files = Array.from(fileList);

  if (files.length === 0) {
    throw new Error('No files were provided.');
  }

  const firstRelativePath = files[0].webkitRelativePath
    ? normalizePath(files[0].webkitRelativePath)
    : normalizePath(files[0].name);
  const rootName = firstRelativePath.split('/')[0] || files[0].name;

  const filesByRelativePath = new Map<string, File>();
  const fingerprintParts: string[] = [rootName];

  files.forEach((file) => {
    const originalPath = file.webkitRelativePath
      ? normalizePath(file.webkitRelativePath)
      : normalizePath(file.name);
    const pathSegments = originalPath.split('/');
    const strippedRelativePath =
      pathSegments.length > 1 ? pathSegments.slice(1).join('/') : originalPath;

    filesByRelativePath.set(strippedRelativePath, file);
    fingerprintParts.push(`${strippedRelativePath}:${file.size}:${file.lastModified}`);
  });

  return {
    rootName,
    datasetFingerprint: hashString(fingerprintParts.sort().join('|')),
    filesByRelativePath,
    allRelativePaths: Array.from(filesByRelativePath.keys()).sort(),
  };
}
