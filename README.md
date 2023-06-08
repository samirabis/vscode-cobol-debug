# COBOL Debugging Extension for Visual Studio Code

This extension provides support for debugging COBOL programs in Visual Studio Code.

## Features

- Setting and hitting breakpoints
- Stepping through code (step in, step over, step out)
- Viewing variables and scopes
- Continuing execution after hitting a breakpoint

## Getting Started

1. Install the extension in Visual Studio Code.
2. Open a COBOL file that you want to debug.
3. Set breakpoints by clicking the gutter next to the line numbers, or by pressing `F9` on the line you want to break on.
4. Press `F5` to start debugging.

## Requirements

To use this extension, you'll need to have the following installed:

- GNU COBOL compiler
- GNU Debugger (GDB)

The extension assumes that `cobc` (the COBOL compiler) and `gdb` (the debugger) are in your system's PATH.

## Configuration

The extension provides the following configuration options:

- `program`: The path to the COBOL program to debug. You can use `${file}` to refer to the currently active file in Visual Studio Code.

## Known Issues

- The extension is currently not supporting multi-threaded COBOL programs.

## Contributing

Contributions are welcome! Please create an issue or open a pull request with your changes.

## License

This extension is licensed under the [MIT License](LICENSE.txt).
