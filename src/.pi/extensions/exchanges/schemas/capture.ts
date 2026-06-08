import * as z from 'zod';

import {
  zCaptureAnswerToolMeta,
  zCaptureCandidateToolMeta,
  zCaptureChoiceToolMeta,
  zCaptureChoicesToolMeta,
  zCaptureDetailsHeader,
  zCaptureReviewToolMeta,
} from './shared.js';

export const zCaptureAnswerDetails = zCaptureDetailsHeader
  .extend({
    tool_meta: zCaptureAnswerToolMeta,
  })
  .strict();
export const CaptureAnswerDetailsSchema = z.toJSONSchema(zCaptureAnswerDetails, { unrepresentable: 'throw' });

export const zCaptureChoiceDetails = zCaptureDetailsHeader
  .extend({
    tool_meta: zCaptureChoiceToolMeta,
  })
  .strict();
export const CaptureChoiceDetailsSchema = z.toJSONSchema(zCaptureChoiceDetails, { unrepresentable: 'throw' });

export const zCaptureChoicesDetails = zCaptureDetailsHeader
  .extend({
    tool_meta: zCaptureChoicesToolMeta,
  })
  .strict();
export const CaptureChoicesDetailsSchema = z.toJSONSchema(zCaptureChoicesDetails, {
  unrepresentable: 'throw',
});

export const zCaptureReviewDetails = zCaptureDetailsHeader
  .extend({
    tool_meta: zCaptureReviewToolMeta,
  })
  .strict();
export const CaptureReviewDetailsSchema = z.toJSONSchema(zCaptureReviewDetails, { unrepresentable: 'throw' });

export const zCaptureCandidateDetails = zCaptureDetailsHeader
  .extend({
    tool_meta: zCaptureCandidateToolMeta,
  })
  .strict();
export const CaptureCandidateDetailsSchema = z.toJSONSchema(zCaptureCandidateDetails, {
  unrepresentable: 'throw',
});

export const zCaptureDetails = z.union([
  zCaptureAnswerDetails,
  zCaptureChoiceDetails,
  zCaptureChoicesDetails,
  zCaptureReviewDetails,
  zCaptureCandidateDetails,
]);
export const CaptureDetailsSchema = z.toJSONSchema(zCaptureDetails, {
  unrepresentable: 'throw',
});
