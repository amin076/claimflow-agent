import {
  BaseAgent,
  Workflow,
  InMemoryRunner,
  createEvent,
  type Event,
  type InvocationContext,
} from '@google/adk';
import type { AgentRun } from '@claimflow/domain';

export type StepName = AgentRun['agent'];
export const STEPS: StepName[] = [
  'INTAKE',
  'QUALITY',
  'EXTRACTION',
  'VALIDATION',
  'CASE_PLANNER',
  'REVIEW_ROUTER',
];
class WorkflowStep extends BaseAgent {
  constructor(
    name: StepName,
    private readonly execute: (name: StepName) => Promise<void>,
  ) {
    super({ name: name.toLowerCase(), description: `ClaimFlow ${name} step` });
    this.step = name;
  }
  private readonly step: StepName;
  protected async *runLiveImpl(context: InvocationContext): AsyncGenerator<Event, void, undefined> {
    yield* this.runAsyncImpl(context);
  }
  protected async *runAsyncImpl(
    context: InvocationContext,
  ): AsyncGenerator<Event, void, undefined> {
    await this.execute(this.step);
    yield createEvent({
      author: this.name,
      invocationId: context.invocationId,
      content: { role: 'model', parts: [{ text: `${this.step} completed` }] },
    });
  }
}
export async function runAdkWorkflow(execute: (name: StepName) => Promise<void>) {
  let failure: unknown;
  const checked = async (name: StepName) => {
    try {
      await execute(name);
    } catch (error) {
      failure = error;
      throw error;
    }
  };
  const agent = new Workflow({
    name: 'claimflow_workflow',
    edges: [['START', ...STEPS.map((name) => new WorkflowStep(name, checked))]],
    maxConcurrency: 1,
  });
  const runner = new InMemoryRunner({ agent, appName: 'claimflow' });
  // Ephemeral ADK events contain step names only. Durable records live in our case repository.
  for await (const event of runner.runEphemeral({
    userId: 'claimflow-api',
    newMessage: {
      role: 'user',
      parts: [{ text: 'Process the synthetic case using the bounded workflow.' }],
    },
  })) {
    if (event.errorCode) throw failure ?? new Error('ADK workflow failed');
  }
}
