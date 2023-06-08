import { spawn } from 'child_process';
import { DebugProtocol } from 'vscode-debugprotocol';
import { Scope, StackFrame, Handles, Source } from 'vscode-debugadapter';

import * as path from 'path';

export class COBOLRuntime {
  private _cobolProcess: any;
  private _gdbProcess: any;
  private _variableHandles: Handles<string>;

  constructor() {
    this._variableHandles = new Handles<string>();
  }
  public start(program: string): void {
    // Compile the COBOL program into an executable
    const cobc = spawn('cobc', ['-x', '-g', program]);

    cobc.on('close', (code) => {
      if (code !== 0) {
        console.log(`cobc process exited with code ${code}`);
        return;
      }

      // Get the executable name (same as the program name without the extension)
      const executable = path.basename(program, path.extname(program));

      // Start the executable with GDB
      this._gdbProcess = spawn('gdb', ['-quiet', executable]);

      // Handle GDB output
      let dataBuffer = '';

      this._gdbProcess.stdout.on('data', (data: { toString: () => string }) => {
        // GDB/MI output is line-based, so we buffer data until we see a newline
        dataBuffer += data.toString();
        let newlineIndex;

        while ((newlineIndex = dataBuffer.indexOf('\n')) !== -1) {
          const line = dataBuffer.substring(0, newlineIndex);
          dataBuffer = dataBuffer.substring(newlineIndex + 1);

          this.handleGDBOutput(line);
        }
      });
    });
  }

  private handleGDBOutput(line: string): void {
    if (line[0] !== '*') {
      // This line is not a notification, so we ignore it
      return;
    }

    // Parse the line as JSON (GDB/MI output is a form of JSON)
    const notification = JSON.parse(line.substring(1));

    if (notification.reason === 'breakpoint-hit') {
      // The program hit a breakpoint
      console.log(`Breakpoint hit at ${notification['thread-id']}`);
    } else if (notification.reason === 'exited') {
      // The program exited
      console.log(`Program exited with code ${notification['exit-code']}`);
    } else if (notification.reason === 'signal-received') {
      // The program received a signal (e.g. segfault)
      console.log(`Program received signal ${notification.signal}`);
    } else {
      // Some other notification that we don't handle
      console.log(`Received unhandled notification: ${line}`);
    }
  }

  public setBreakPoints(path: string, breakpoints: COBOLBreakpoint[]): void {
    // Send breakpoint commands to GDB
    for (let bp of breakpoints) {
      this._gdbProcess.stdin.write(`break '${path}:${bp.line}'\n`);
    }
  }
  public continue(): void {
    this._gdbProcess.stdin.write('-exec-continue\n');
  }

  public next(): void {
    this._gdbProcess.stdin.write('-exec-next\n');
  }

  public stepIn(): void {
    this._gdbProcess.stdin.write('-exec-step\n');
  }

  public stepOut(): void {
    this._gdbProcess.stdin.write('-exec-finish\n');
  }
  public getStackFrames(): Promise<StackFrame[]> {
    return new Promise((resolve, reject) => {
      // Send 'bt' command to GDB and parse the output
      this._gdbProcess.stdin.write('bt\n');

      this._gdbProcess.stdout.once(
        'data',
        (data: { toString: () => string }) => {
          // Parse the output and create StackFrame objects
          const lines = data.toString().split('\n');
          const frames: StackFrame[] = [];

          lines.forEach((line, i) => {
            // This is a naive parsing, adjust it according to your needs
            const match = line.match(/#(\d+)  (.+) at ([^:]+):(\d+)/);

            if (match) {
              const [, level, func, path, line] = match;

              frames.push(
                new StackFrame(
                  parseInt(level),
                  func,
                  new Source(path, path),
                  parseInt(line),
                  0
                )
              );
            }
          });

          resolve(frames);
        }
      );
    });
  }

  public getScopes(frameId: number): Promise<Scope[]> {
    return new Promise((resolve, reject) => {
      // Send 'info args' and 'info locals' commands to GDB and collect the output
      this._gdbProcess.stdin.write(`info args\ninfo locals\n`);

      this._gdbProcess.stdout.once(
        'data',
        (data: { toString: () => string }) => {
          // Parse the output and create Scope objects
          const lines = data.toString().split('\n');
          const args: DebugProtocol.Variable[] = [];
          const locals: DebugProtocol.Variable[] = [];

          lines.forEach((line, i) => {
            // This is a naive parsing, adjust it according to your needs
            const match = line.match(/([^=]+)=([^;]+)/);

            if (match) {
              const [, name, value] = match;
              if (i < line.indexOf('info locals')) {
                args.push({
                  name: name.trim(),
                  value: value.trim(),
                  variablesReference: this._variableHandles.create('args'),
                });
              } else {
                locals.push({
                  name: name.trim(),
                  value: value.trim(),
                  variablesReference: this._variableHandles.create('locals'),
                });
              }
            }
          });

          const scopes = [
            new Scope('Arguments', this._variableHandles.create('args'), false),
            new Scope('Locals', this._variableHandles.create('locals'), false),
          ];

          resolve(scopes);
        }
      );
    });
  }

  public getVariables(
    variablesReference: number
  ): Promise<DebugProtocol.Variable[]> {
    return new Promise((resolve, reject) => {
      // Here we need to look up the actual variables
      const variables = this._variableHandles.get(variablesReference);

      if (variables === 'args') {
        this._gdbProcess.stdin.write('info args\n');

        this._gdbProcess.stdout.once(
          'data',
          (data: { toString: () => string }) => {
            const lines = data.toString().split('\n');
            const args: DebugProtocol.Variable[] = [];

            lines.forEach((line) => {
              const match = line.match(/([^=]+)=([^;]+)/);

              if (match) {
                const [, name, value] = match;
                args.push({
                  name: name.trim(),
                  value: value.trim(),
                  variablesReference: 0,
                });
              }
            });

            resolve(args);
          }
        );
      } else if (variables === 'locals') {
        this._gdbProcess.stdin.write('info locals\n');

        this._gdbProcess.stdout.once(
          'data',
          (data: { toString: () => string }) => {
            const lines = data.toString().split('\n');
            const locals: DebugProtocol.Variable[] = [];

            lines.forEach((line) => {
              const match = line.match(/([^=]+)=([^;]+)/);

              if (match) {
                const [, name, value] = match;
                locals.push({
                  name: name.trim(),
                  value: value.trim(),
                  variablesReference: 0,
                });
              }
            });

            resolve(locals);
          }
        );
      }
    });
  }

  // TODO: Add methods to control execution and inspect state of the COBOL program
}

export class COBOLBreakpoint {
  public verified = false;

  constructor(public line: number) {}
}
