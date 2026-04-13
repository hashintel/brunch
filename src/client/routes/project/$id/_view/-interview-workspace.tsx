import { InterviewWorkspaceScreen } from '../../../../screens/InterviewWorkspaceScreen.js';
import { useWorkspaceController } from '../../../../workspace/workspace-controller';

export function InterviewWorkspace() {
  return <InterviewWorkspaceScreen workspace={useWorkspaceController()} />;
}
