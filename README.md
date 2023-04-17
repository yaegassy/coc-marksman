# coc-marksman

> fork from a [marksman-vscode](https://github.com/artempyanykh/marksman-vscode)

Integrates [Marksman](https://github.com/artempyanykh/marksman) language server into [coc.nvim](https://github.com/neoclide/coc.nvim) for delightful Markdown note taking experience.

https://user-images.githubusercontent.com/188642/174696988-98d3f458-7f91-4c06-83e2-9c2a6a6ca5ed.mp4

See the [project page](https://github.com/artempyanykh/marksman) for more detailed information.

## Install

```vim
:CocInstall @yaegassy/coc-marksman
```

> scoped packages

## Configuration options

- `marksman.enable`: Enable coc-marksman extension, default: `true`
- `marksman.customCommand`: allows to specify a custom command to start marksman. Mostly useful for development of marksman itself.
- `marksman.customCommandDir`: allows to specify a CWD for the command above. For development it's convenient to set the command to dotnet run and the command dir to the dir where marksman sources are.
- `marksman.trace.server`: Traces the communication between coc.nvim and the language server, valid option: `["off", "messages", "verbose"]`, default: `"off"`

## Commands

- `marksman.restartServer`: Marksman: Restart Server
- `marksman.showOutputChannel`: Marksman: Show Output

## Code Actions

Marksman has a code action to create and update a table of contents of a document. 

- `Create a Table of Contents`
  - REF: <https://github.com/artempyanykh/marksman#code-actions>

This code action is `source` level. Please key mapping `<Plug>(coc-codeaction-source)` in coc.nvim to call it.

```vim
nmap <leader>as  <Plug>(coc-codeaction-source)
```

## Thanks

- <https://github.com/artempyanykh/marksman>
- <https://github.com/artempyanykh/marksman-vscode>

## License

MIT

---

> This extension is built with [create-coc-extension](https://github.com/fannheyward/create-coc-extension)
