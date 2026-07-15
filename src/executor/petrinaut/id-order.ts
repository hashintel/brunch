export function compareNaturalIds(left: string, right: string): number {
  const leftParts = left.match(/\d+|\D+/gu) ?? [];
  const rightParts = right.match(/\d+|\D+/gu) ?? [];

  for (let index = 0; index < Math.min(leftParts.length, rightParts.length); index += 1) {
    const leftPart = leftParts[index]!;
    const rightPart = rightParts[index]!;
    const leftIsNumber = /^\d+$/u.test(leftPart);
    const rightIsNumber = /^\d+$/u.test(rightPart);
    if (leftIsNumber && rightIsNumber) {
      const leftNumber = leftPart.replace(/^0+(?=\d)/u, '');
      const rightNumber = rightPart.replace(/^0+(?=\d)/u, '');
      if (leftNumber.length !== rightNumber.length) return leftNumber.length - rightNumber.length;
      const numberOrder = compareCodePoints(leftNumber, rightNumber);
      if (numberOrder !== 0) return numberOrder;
      if (leftPart.length !== rightPart.length) return leftPart.length - rightPart.length;
      continue;
    }

    const partOrder = compareCodePoints(leftPart, rightPart);
    if (partOrder !== 0) return partOrder;
  }

  return leftParts.length - rightParts.length || compareCodePoints(left, right);
}

function compareCodePoints(left: string, right: string): number {
  const leftPoints = Array.from(left);
  const rightPoints = Array.from(right);
  for (let index = 0; index < Math.min(leftPoints.length, rightPoints.length); index += 1) {
    const difference = leftPoints[index]!.codePointAt(0)! - rightPoints[index]!.codePointAt(0)!;
    if (difference !== 0) return difference;
  }
  return leftPoints.length - rightPoints.length;
}
