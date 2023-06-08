import * as vscode from 'vscode';
import { COBOLDebugSession } from './debugAdapter';

export function activate(context: vscode.ExtensionContext) {
  // Register a debug configuration provider for "cobol" debug type
  const provider = new COBOLConfigurationProvider();
  context.subscriptions.push(
    vscode.debug.registerDebugConfigurationProvider('cobol', provider)
  );
  // Register a command that starts a new debug session
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'extension.cobol.debug.startSession',
      async (config) => {
        await vscode.debug.startDebugging(undefined, config);
        COBOLDebugSession.run(COBOLDebugSession);
      }
    )
  );
}

class COBOLConfigurationProvider implements vscode.DebugConfigurationProvider {
  resolveDebugConfiguration(
    folder: vscode.WorkspaceFolder | undefined,
    config: vscode.DebugConfiguration
  ): vscode.DebugConfiguration | Thenable<vscode.DebugConfiguration> {
    if (!config.type && !config.request && !config.name) {
      const editor = vscode.window.activeTextEditor;
      if (editor && editor.document.languageId === 'cobol') {
        config.type = 'cobol';
        config.name = 'Launch';
        config.request = 'launch';
        config.program = '${file}';
      }
    }
    if (!config.program) {
      vscode.window.showInformationMessage('Cannot find a program to debug');
      return Promise.reject(new Error('Cannot find a program to debug')); // reject launch
    }
    return config;
  }
}

export function deactivate() {}
