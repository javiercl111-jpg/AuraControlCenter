import * as crypto from 'crypto';

export interface BusinessIdentityResult {
  canonicalBusinessId: string;
  legacyBusinessId: string;
  contentFingerprint: string;
  identityStrategy: 'CLEE' | 'STABLE_FINGERPRINT' | 'HASH_TIEBREAKER';
}

export function resolveBusinessIdentity(
  clee: string | null | undefined,
  razonSocial: string | null | undefined,
  nombreComercial: string | null | undefined,
  direccion: string | null | undefined,
  municipio: string | null | undefined,
  cp: string | null | undefined,
  scian: string | null | undefined,
  telefono: string | null | undefined,
  latitud?: string | null | undefined,
  longitud?: string | null | undefined,
  rowStringFallback?: string
): BusinessIdentityResult {
  const cleanStr = (str: string | null | undefined) =>
    (str || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/g, "")
      .trim();

  const normLegacy = (s: string | null | undefined) => (s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  
  // Legacy ID behavior
  const legacyBusinessId = `inegi_${normLegacy(razonSocial)}_${normLegacy(nombreComercial)}_${normLegacy(municipio)}_${normLegacy(scian)}`;

  // Content fingerprint
  const rawDataForFingerprint = rowStringFallback || JSON.stringify({
    clee, razonSocial, nombreComercial, direccion, municipio, cp, scian, telefono, latitud, longitud
  });
  const contentFingerprint = crypto.createHash('sha256').update(rawDataForFingerprint).digest('hex');

  // 1. CLEE / Official ID
  const cleanClee = cleanStr(clee);
  if (cleanClee && cleanClee.length > 5) {
    return {
      canonicalBusinessId: `inegi_clee_${cleanClee}`,
      legacyBusinessId,
      contentFingerprint,
      identityStrategy: 'CLEE'
    };
  }

  // 2. Stable Hash Fingerprint (Identity Fingerprint)
  const partName = cleanStr(razonSocial) || cleanStr(nombreComercial) || "emp";
  const partMun = cleanStr(municipio) || "mun";
  const partCp = cleanStr(cp) || "cp";
  const partScian = cleanStr(scian) || "sci";
  const partTel = cleanStr(telefono) || "tel";
  const partDir = cleanStr(direccion) || "dir";

  const stableId = `inegi_stable_${partName}_${partDir}_${partMun}_${partCp}_${partScian}_${partTel}`;
  
  // 3. Hash completo únicamente como mecanismo de auditoría o desempate controlado si es proveído explícitamente
  if (rowStringFallback && rowStringFallback.startsWith("TIE_BREAKER:")) {
    const rawData = rowStringFallback.substring("TIE_BREAKER:".length);
    const rowHash = crypto.createHash("sha256").update(rawData).digest("hex").slice(0, 10);
    return {
      canonicalBusinessId: `${stableId.slice(0, 105)}_${rowHash}`,
      legacyBusinessId,
      contentFingerprint,
      identityStrategy: 'HASH_TIEBREAKER'
    };
  }

  return {
    canonicalBusinessId: stableId,
    legacyBusinessId,
    contentFingerprint,
    identityStrategy: 'STABLE_FINGERPRINT'
  };
}

export function generateDeterministicId(
  clee: string | null | undefined,
  razonSocial: string | null | undefined,
  nombreComercial: string | null | undefined,
  municipio: string | null | undefined,
  cp: string | null | undefined,
  scian: string | null | undefined,
  telefono: string | null | undefined,
  direccion: string | null | undefined,
  rowStringFallback?: string
): string {
  return resolveBusinessIdentity(
    clee, razonSocial, nombreComercial, direccion, municipio, cp, scian, telefono, undefined, undefined, rowStringFallback
  ).canonicalBusinessId;
}
