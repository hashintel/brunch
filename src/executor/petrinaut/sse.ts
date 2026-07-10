import type { PetrinautStreamFrame } from './stream-frames.js';

export function serializePetrinautSseFrame(frame: PetrinautStreamFrame): string {
  return `event: ${frame.kind}\ndata: ${JSON.stringify(frameData(frame))}\n\n`;
}

export function serializePetrinautSseFrames(frames: readonly PetrinautStreamFrame[]): string {
  return frames.map(serializePetrinautSseFrame).join('');
}

function frameData(frame: PetrinautStreamFrame): unknown {
  switch (frame.kind) {
    case 'status':
    case 'terminal':
      return { state: frame.state, ...(frame.reason === undefined ? {} : { reason: frame.reason }) };
    case 'definition':
      return frame.definition;
    case 'initial_state':
      return frame.initialState;
    case 'transition_firing':
      return frame.firing;
  }
}
