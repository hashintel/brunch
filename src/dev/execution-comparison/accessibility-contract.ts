import { queryAllByRole } from '@testing-library/dom';

import {
  compileAccessibleNamePattern,
  type AccessibleNameContract,
  type ExecutionCasePublicContract,
} from './case-contract.js';

export interface AccessibilityContractAssertion {
  readonly controls: number;
  readonly dynamic: number;
  readonly inspectorFields: number;
  readonly feedbackSurfaces: number;
}

export function assertAccessibilityContract(
  root: HTMLElement,
  contract: ExecutionCasePublicContract['accessibility'],
  requirements: {
    readonly dynamic?: readonly (keyof ExecutionCasePublicContract['accessibility']['dynamic'])[];
    readonly inspectorFields?: readonly string[];
  } = {},
): AccessibilityContractAssertion {
  requireExactlyOne(root, contract.application);
  requireExactlyOne(root, contract.canvas);
  for (const control of contract.controls) requireExactlyOne(root, control);

  let dynamicCount = 0;
  for (const key of requirements.dynamic ?? []) {
    const expected = contract.dynamic[key];
    const matches = queryAllByRole(root, expected.role, {
      name: compileAccessibleNamePattern(expected.namePattern),
    });
    if (matches.length === 0) {
      throw new Error(`${key}: expected at least one accessible ${expected.role}`);
    }
    dynamicCount += matches.length;
  }

  let inspectorFieldCount = 0;
  for (const name of requirements.inspectorFields ?? []) {
    const expected = contract.inspectorFields.find((field) => field.name === name);
    if (expected === undefined) throw new Error(`${name}: not declared by the public accessibility contract`);
    requireExactlyOne(root, expected);
    inspectorFieldCount += 1;
  }

  const feedbackSurfaces = contract.feedbackRoles.reduce(
    (count, role) => count + queryAllByRole(root, role).length,
    0,
  );
  if (feedbackSurfaces === 0) {
    throw new Error('feedback: expected at least one accessible status or alert surface');
  }

  return {
    controls: contract.controls.length,
    dynamic: dynamicCount,
    inspectorFields: inspectorFieldCount,
    feedbackSurfaces,
  };
}

function requireExactlyOne(root: HTMLElement, expected: AccessibleNameContract): HTMLElement {
  const matches = queryAllByRole(root, expected.role, { name: expected.name });
  if (matches.length !== 1) {
    throw new Error(
      `${expected.name}: expected exactly one accessible ${expected.role}, received ${matches.length}`,
    );
  }
  return matches[0]!;
}
