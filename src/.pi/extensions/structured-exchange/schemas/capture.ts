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
export type CaptureAnswerDetails = z.infer<typeof zCaptureAnswerDetails>;
export const CaptureAnswerDetailsSchema = z.toJSONSchema(zCaptureAnswerDetails, { unrepresentable: 'throw' });

export const zCaptureChoiceDetails = zCaptureDetailsHeader
  .extend({
    tool_meta: zCaptureChoiceToolMeta,
  })
  .strict();
export type CaptureChoiceDetails = z.infer<typeof zCaptureChoiceDetails>;
export const CaptureChoiceDetailsSchema = z.toJSONSchema(zCaptureChoiceDetails, { unrepresentable: 'throw' });

export const zCaptureChoicesDetails = zCaptureDetailsHeader
  .extend({
    tool_meta: zCaptureChoicesToolMeta,
  })
  .strict();
export type CaptureChoicesDetails = z.infer<typeof zCaptureChoicesDetails>;
export const CaptureChoicesDetailsSchema = z.toJSONSchema(zCaptureChoicesDetails, {
  unrepresentable: 'throw',
});

export const zCaptureReviewDetails = zCaptureDetailsHeader
  .extend({
    tool_meta: zCaptureReviewToolMeta,
  })
  .strict();
export type CaptureReviewDetails = z.infer<typeof zCaptureReviewDetails>;
export const CaptureReviewDetailsSchema = z.toJSONSchema(zCaptureReviewDetails, { unrepresentable: 'throw' });

export const zCaptureCandidateDetails = zCaptureDetailsHeader
  .extend({
    tool_meta: zCaptureCandidateToolMeta,
  })
  .strict();
export type CaptureCandidateDetails = z.infer<typeof zCaptureCandidateDetails>;
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
export type CaptureDetails = z.infer<typeof zCaptureDetails>;
export const CaptureDetailsSchema = z.toJSONSchema(zCaptureDetails, {
  unrepresentable: 'throw',
});
