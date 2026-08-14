import { lstat, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, relative, resolve, sep } from "node:path";

import {
  DEPLOYMENT_CERTIFICATION_SIDECAR_PATH_V1,
  createDeploymentArtifactManifestV1,
  createDeploymentCertificationSidecarV1,
  sha256BytesV1,
} from "./ai-ux-02d2e4x-browser-proof-deployment-contract-v1.mjs";

export class BrowserProofBuildCertificationErrorV1 extends Error {
  constructor(code) {
    super(code);
    this.name = "BrowserProofBuildCertificationErrorV1";
    this.code = code;
  }
}

function fail(code) {
  throw new BrowserProofBuildCertificationErrorV1(code);
}

function portablePath(root, file) {
  const value = relative(root, file).split(sep).join("/").normalize("NFC");
  if (!value || value.startsWith("../") || value.includes("/../") ||
      value.includes("\\") || value === DEPLOYMENT_CERTIFICATION_SIDECAR_PATH_V1) {
    fail("BROWSER_PROOF_BUILD_PATH_REJECTED");
  }
  return value;
}

async function enumerateFiles(root, directory = root, files = []) {
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    const path = resolve(directory, entry.name);
    const metadata = await lstat(path);
    if (metadata.isSymbolicLink()) fail("BROWSER_PROOF_BUILD_SYMLINK_REJECTED");
    if (metadata.isDirectory()) {
      await enumerateFiles(root, path, files);
    } else if (metadata.isFile()) {
      const relativePath = relative(root, path).split(sep).join("/");
      if (relativePath === DEPLOYMENT_CERTIFICATION_SIDECAR_PATH_V1) continue;
      const normalized = portablePath(root, path);
      const bytes = await readFile(path);
      files.push(Object.freeze({
        path: normalized,
        byteLength: bytes.byteLength,
        sha256: sha256BytesV1(bytes),
      }));
    } else {
      fail("BROWSER_PROOF_BUILD_ENTRY_REJECTED");
    }
  }
  return files;
}

export async function certifyDeploymentOutputV1({
  outputRoot,
  projectId,
  controlProofDigest,
  writeSidecar = true,
}) {
  if (typeof outputRoot !== "string" || !outputRoot.trim()) {
    fail("BROWSER_PROOF_BUILD_ROOT_REJECTED");
  }
  const root = resolve(outputRoot);
  const metadata = await lstat(root);
  if (!metadata.isDirectory() || metadata.isSymbolicLink()) {
    fail("BROWSER_PROOF_BUILD_ROOT_REJECTED");
  }
  const files = await enumerateFiles(root);
  files.sort((left, right) => left.path < right.path ? -1 : left.path > right.path ? 1 : 0);
  const manifest = createDeploymentArtifactManifestV1({
    projectId,
    controlProofDigest,
    files,
  });
  const sidecar = createDeploymentCertificationSidecarV1(manifest);
  if (writeSidecar) {
    const sidecarPath = resolve(root, DEPLOYMENT_CERTIFICATION_SIDECAR_PATH_V1);
    const sidecarRoot = resolve(root, dirname(DEPLOYMENT_CERTIFICATION_SIDECAR_PATH_V1));
    if (!sidecarRoot.startsWith(`${root}${sep}`) || !sidecarPath.startsWith(`${root}${sep}`)) {
      fail("BROWSER_PROOF_BUILD_SIDECAR_PATH_REJECTED");
    }
    const { mkdir } = await import("node:fs/promises");
    await mkdir(sidecarRoot, { recursive: true });
    await writeFile(sidecarPath, `${JSON.stringify(sidecar)}\n`, {
      encoding: "utf8",
      flag: "wx",
    });
  }
  return sidecar;
}
