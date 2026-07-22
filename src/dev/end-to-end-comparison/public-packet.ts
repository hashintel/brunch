import { createHash } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import {
  loadPublicCasePacket,
  parsePublicCaseContract,
  type PublicCasePacket,
} from '../execution-comparison/case-contract.js';

export async function materializeExactExecutionPacket(input: {
  readonly specificationPath: string;
  readonly publicContractTemplatePath: string;
  readonly packetDir: string;
}): Promise<{
  readonly packetDir: string;
  readonly packet: PublicCasePacket;
}> {
  const specification = await readFile(input.specificationPath);
  const templateBytes = await readFile(input.publicContractTemplatePath);
  const template = parsePublicCaseContract(parseJson(templateBytes.toString('utf8')));
  const specificationSha256 = createHash('sha256').update(specification).digest('hex');
  const contract = parsePublicCaseContract({
    ...template,
    case: {
      ...template.case,
      specificationSha256,
    },
  });
  const contractBytes =
    template.case.specificationSha256 === specificationSha256
      ? templateBytes
      : Buffer.from(`${JSON.stringify(contract, null, 2)}\n`);

  await mkdir(dirname(input.packetDir), { recursive: true });
  try {
    await mkdir(input.packetDir);
  } catch (error) {
    if (errorRecord(error) && error['code'] === 'EEXIST') {
      throw new Error(`execution packet already exists: ${input.packetDir}`);
    }
    throw error;
  }
  try {
    await writeFile(join(input.packetDir, contract.case.specification), specification, {
      flag: 'wx',
    });
    await writeFile(join(input.packetDir, 'public-contract.json'), contractBytes, { flag: 'wx' });
    const packet = await loadPublicCasePacket(input.packetDir);
    return { packetDir: input.packetDir, packet };
  } catch (error) {
    await rm(input.packetDir, { recursive: true, force: true });
    throw error;
  }
}

function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    throw new Error('invalid public execution contract template JSON');
  }
}

function errorRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
