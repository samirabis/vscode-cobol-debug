import {
  DebugSession,
  InitializedEvent,
  TerminatedEvent,
  StoppedEvent,
  Thread,
  StackFrame,
  Scope,
  Source,
  Handles,
} from 'vscode-debugadapter';
import { DebugProtocol } from 'vscode-debugprotocol';
import { COBOLRuntime, COBOLBreakpoint } from './cobolRuntime';

export interface LaunchRequestArguments
  extends DebugProtocol.LaunchRequestArguments {
  program: string; // The COBOL program to run
}

export class COBOLDebugSession extends DebugSession {
  private static THREAD_ID = 1;

  private _runtime = new COBOLRuntime();

  protected initializeRequest(
    response: DebugProtocol.InitializeResponse,
    args: DebugProtocol.InitializeRequestArguments
  ): void {
    // This method is called at the start of a debug session
    // Set up any events you want to send to the debug client
    response.body = response.body || {};
    response.body.supportsStepBack = false;
    this.sendResponse(response);
    this.sendEvent(new InitializedEvent());
  }

  protected launchRequest(
    response: DebugProtocol.LaunchResponse,
    args: LaunchRequestArguments
  ): void {
    this._runtime.start(args.program);
    this.sendResponse(response);
  }

  protected setBreakPointsRequest(
    response: DebugProtocol.SetBreakpointsResponse,
    args: DebugProtocol.SetBreakpointsArguments
  ): void {
    // This method is called when the user changes breakpoints in the editor
    // It should communicate the new set of breakpoints to the COBOL runtime
    const path = args.source.path!;
    const breakpoints = args.breakpoints!.map(
      (b) => new COBOLBreakpoint(b.line)
    );

    this._runtime.setBreakPoints(path, breakpoints);
    response.body = {
      breakpoints: breakpoints.map((b) => ({
        verified: b.verified,
        line: b.line,
      })),
    };
    this.sendResponse(response);
  }

  protected threadsRequest(response: DebugProtocol.ThreadsResponse): void {
    // This method is called when the debug client wants to know what threads exist in the debuggee
    // COBOL is usually single-threaded, so we always return a single thread
    response.body = {
      threads: [new Thread(COBOLDebugSession.THREAD_ID, 'thread 1')],
    };
    this.sendResponse(response);
  }
  protected async stackTraceRequest(
    response: DebugProtocol.StackTraceResponse,
    args: DebugProtocol.StackTraceArguments
  ): Promise<void> {
    // Fetch stack frames from the runtime and send them back to the client
    try {
      const frames = await this._runtime.getStackFrames();
      response.body = {
        stackFrames: frames,
        totalFrames: frames.length,
      };
    } catch (error) {
      this.sendErrorResponse(
        response,
        2001,
        `Could not retrieve stack trace: ${error}`
      );
      return;
    }
    this.sendResponse(response);
  }

  protected async scopesRequest(
    response: DebugProtocol.ScopesResponse,
    args: DebugProtocol.ScopesArguments
  ): Promise<void> {
    // Fetch scopes from the runtime and send them back to the client
    try {
      const scopes = await this._runtime.getScopes(args.frameId);
      response.body = { scopes: scopes };
    } catch (error) {
      this.sendErrorResponse(
        response,
        2002,
        `Could not retrieve scopes: ${error}`
      );
      return;
    }
    this.sendResponse(response);
  }

  protected async variablesRequest(
    response: DebugProtocol.VariablesResponse,
    args: DebugProtocol.VariablesArguments
  ): Promise<void> {
    // Fetch variables from the runtime and send them back to the client
    try {
      const variables = await this._runtime.getVariables(
        args.variablesReference
      );
      response.body = { variables: variables };
    } catch (error) {
      this.sendErrorResponse(
        response,
        2003,
        `Could not retrieve variables: ${error}`
      );
      return;
    }
    this.sendResponse(response);
  }
  protected continueRequest(
    response: DebugProtocol.ContinueResponse,
    args: DebugProtocol.ContinueArguments
  ): void {
    this._runtime.continue();
    this.sendResponse(response);
  }

  protected nextRequest(
    response: DebugProtocol.NextResponse,
    args: DebugProtocol.NextArguments
  ): void {
    this._runtime.next();
    this.sendResponse(response);
  }

  protected stepInRequest(
    response: DebugProtocol.StepInResponse,
    args: DebugProtocol.StepInArguments
  ): void {
    this._runtime.stepIn();
    this.sendResponse(response);
  }

  protected stepOutRequest(
    response: DebugProtocol.StepOutResponse,
    args: DebugProtocol.StepOutArguments
  ): void {
    this._runtime.stepOut();
    this.sendResponse(response);
  }
}

DebugSession.run(COBOLDebugSession);
