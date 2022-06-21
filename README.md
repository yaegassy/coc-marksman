# coc-marksman

> fork from a [marksman-vscode](https://github.com/artempyanykh/marksman-vscode)

Integrates [Marksman](https://github.com/artempyanykh/marksman) language server into [coc.nvim](https://github.com/neoclide/coc.nvim) for delightful Markdown note taking experience.

See the [project page](https://github.com/artempyanykh/marksman) for more detailed information.

## Install

**vim-plug**:

```vim
Plug 'yaegassy/coc-marksman', {'do': 'yarn install --frozen-lockfile'}
```

## Note

1. **Get `marksman` server binary**.
   The extension will try to automatically download Marksman language server
   from GH releases. This is the easiest way to get started.

   An alternative is to either download `marksman` binary from the [releases page][mn-releases] or to build `marksman` from source. Put it somewhere in your `PATH` and you should be good to go.
2. **Add `.marksman.toml` to your workspace root folder**.
   The extension is automatically activated only when `.marksman.toml` file is present. This is done to avoid running Zeta Note on random Markdown files, but rather only inside your notes folder.

## Configuration options

- `marksman.enable`: Enable coc-marksman extension, default: `true`
- `marksman.customCommand`: allows to specify a custom command to start marksman. Mostly useful for development of marksman itself.
- `marksman.customCommandDir`: allows to specify a CWD for the command above. For development it's convenient to set the command to dotnet run and the command dir to the dir where marksman sources are.
- `marksman.trace.server`: Traces the communication between coc.nvim and the language server, valid option: `["off", "messages", "verbose"]`, default: `"off"`

## Commands

- `marksman.restartServer`: Marksman: Restart Server
- `marksman.showOutputChannel`: Marksman: Show Output

## Thanks

- <https://github.com/artempyanykh/marksman>
- <https://github.com/artempyanykh/marksman-vscode>

## License

MIT

---

> This extension is built with [create-coc-extension](https://github.com/fannheyward/create-coc-extension)
