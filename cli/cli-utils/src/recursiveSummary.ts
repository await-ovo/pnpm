import { PnpmError } from '@pnpm/error'

interface ActionFailure {
  status: 'failure'
  duration?: number
  prefix: string
  message: string
  error: Error
}

export type RecursiveSummary = Record<string, {
  status: 'passed' | 'queued' | 'running'
  duration?: number
} | ActionFailure>

class RecursiveFailError extends PnpmError {
  public readonly fails: ActionFailure[]
  public readonly passes: number

  constructor (command: string, recursiveSummary: RecursiveSummary, fails: ActionFailure[]) {
    super('RECURSIVE_FAIL', `"${command}" failed in ${fails.length} packages`)

    this.fails = fails
    this.passes = Object.values(recursiveSummary).filter(({ status }) => status === 'passed').length
  }
}

export function throwOnCommandFail (command: string, recursiveSummary: RecursiveSummary) {
  const fails = Object.values(recursiveSummary).filter(({ status }) => status === 'failure') as ActionFailure[]
  if (fails.length > 0) {
    throw new RecursiveFailError(command, recursiveSummary, fails)
  }
}
