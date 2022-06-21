import {
  commands,
  DocumentSelector,
  ExecutableOptions,
  ExtensionContext,
  LanguageClient,
  LanguageClientOptions,
  Location,
  NotificationType,
  Position,
  ServerOptions,
  State,
  StaticFeature,
  StatusBarItem,
  window,
  workspace,
} from 'coc.nvim';

import fs from 'fs';
import os from 'os';
import which from 'which';

import fetch from 'node-fetch';
import path from 'path';
import stream from 'stream';
import { promisify } from 'util';

let client: LanguageClient | null;
let statusBarItem: StatusBarItem;

type RunState = 'init' | 'dead' | 'ok';

type StatusParams = {
  state: RunState;
  docCount: number;
};

const defaultStatus: StatusParams = { state: 'init', docCount: 0 };
const deadStatus: StatusParams = { state: 'dead', docCount: 0 };

const extId = 'marksman';
const extName = 'Marksman';
const compatibleServerRelease = '2022-06-02';
const releaseBaseUrl = 'https://github.com/artempyanykh/marksman/releases/download';

const statusNotificationType = new NotificationType<StatusParams>('marksman/status');

// eslint-disable-next-line @typescript-eslint/no-unused-vars
type ShowReferencesData = {
  uri: string;
  position: Position;
  locations: Location[];
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
type FollowLinkData = {
  from: Location;
  to: Location;
};

type ExperimentalCapabilities = {
  codeLensShowReferences?: boolean;
  followLinks?: boolean;
  statusNotification?: boolean;
};

class ExperimentalFeatures implements StaticFeature {
  fillClientCapabilities(capabilities: any): void {
    const experimental: ExperimentalCapabilities = capabilities.experimental ?? {};
    experimental.codeLensShowReferences = true;
    experimental.followLinks = true;
    experimental.statusNotification = true;

    capabilities.experimental = experimental;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  initialize(_capabilities: any, _documentSelector: DocumentSelector | undefined): void {}

  dispose(): void {}
}

export async function activate(context: ExtensionContext): Promise<void> {
  if (!workspace.getConfiguration('marksman').get('enable', true)) return;

  // Create a status
  statusBarItem = createDefaultStatus();
  statusBarItem.show();

  client = await connectToServer(context, statusBarItem);

  const restartServerCmd = commands.registerCommand(`${extId}.restartServer`, async () => {
    stopClient(client);
    updateStatus(statusBarItem, defaultStatus);

    client = await connectToServer(context, statusBarItem);
    if (client) {
      context.subscriptions.push(client.start());
    }
  });

  const showOutputCmd = commands.registerCommand(`${extId}.showOutputChannel`, () => {
    if (client) {
      const outputchannel = client.outputChannel;
      outputchannel.show(true);
    }
  });

  // **MEMO**
  // Not implemented because the correct behavior was not known,
  // It may be a feature under development at this time.
  // ---
  //
  //const showReferencesCmd = commands.registerCommand(`${extId}.showReferences`, async (data: ShowReferencesData) => {
  //  if (client) {
  //    await commands.executeCommand(
  //      'editor.action.showReferences',
  //      data.uri,
  //      Position.create(data.position.line, data.position.character),
  //      data.locations.map((d) => {
  //        Location.create(
  //          d.uri,
  //          Range.create(d.range.start.line, d.range.start.character, d.range.end.line, d.range.end.character)
  //        );
  //      })
  //    );
  //  }
  //});

  // **MEMO**
  // In coc.nvim, this does not have to be implemented.
  // If you want to open the URL, please do the following
  //
  // :call CocActionAsync('openLink')
  // ---
  //
  //const followLinkCmd = commands.registerCommand(`${extId}.followLink`, async (data: FollowLinkData) => {
  //  if (client) {
  //    const fromLoc = data.from;
  //    const toLoc = data.to;
  //    await commands.executeCommand(
  //      'editor.action.goToLocations',
  //      fromLoc.uri,
  //      fromLoc.range.start,
  //      [toLoc],
  //      'goto',
  //      "Couldn't locate the target of the link"
  //    );
  //  }
  //});

  if (client) {
    context.subscriptions.push(client.start());
  }
  context.subscriptions.push(restartServerCmd, showOutputCmd);
}

async function connectToServer(context: ExtensionContext, status: StatusBarItem): Promise<LanguageClient | null> {
  // Try to find the server binary and create ServerOptions
  // Return early if no binary can be found
  let serverOptions: ServerOptions;
  const maybeServerOptions: ServerOptions | null = await mkServerOptions(context);
  if (maybeServerOptions === null) {
    console.error(`Couldn't find ${serverBinName()} server binary`);
    updateStatus(status, deadStatus);
    return null;
  } else {
    serverOptions = maybeServerOptions;
  }

  // Init LS client
  const clientOptions: LanguageClientOptions = {
    documentSelector: [{ scheme: 'file', language: 'markdown' }],
  };

  return createClient(serverOptions, clientOptions);
}

async function mkServerOptions(context: ExtensionContext): Promise<ServerOptions | null> {
  const fromConfig = mkServerOptionsFromConfig();
  if (fromConfig) {
    return fromConfig;
  }

  const binInPath = await findServerInPath();
  if (binInPath) {
    return {
      command: binInPath,
    };
  }

  return await downloadServerFromGH(context);
}

function mkServerOptionsFromConfig(): ServerOptions | null {
  const extConf = workspace.getConfiguration(`${extId}`);
  const customCommand = extConf.get<string>('customCommand');
  const customCommandDir = extConf.get<string>('customCommandDir');
  if (customCommand) {
    const [command, ...args] = customCommand.split(' ');
    let options: ExecutableOptions = {};
    if (customCommandDir) {
      options = { cwd: customCommandDir };
    }

    return {
      command: command,
      args: args,
      options: options,
    };
  } else {
    return null;
  }
}

function serverBinName(): string {
  const platform = os.platform();
  if (platform === 'win32') {
    return 'marksman.exe';
  } else if (platform === 'darwin' || platform === 'linux') {
    return 'marksman';
  } else {
    throw new Error(`Unsupported platform: ${platform}`);
  }
}

function releaseBinName(): string {
  const platform = os.platform();

  if (platform === 'win32') {
    return 'marksman-windows.exe';
  } else if (platform === 'darwin') {
    return 'marksman-macos';
  } else if (platform === 'linux') {
    return 'marksman-linux';
  } else {
    throw new Error(`Unsupported platform: ${platform}`);
  }
}

function releaseDownloadUrl(): string {
  return releaseBaseUrl + '/' + compatibleServerRelease + '/' + releaseBinName();
}

async function downloadRelease(targetDir: string, onProgress: (progress: number) => void): Promise<void> {
  const targetFile = path.join(targetDir, serverBinName());
  const tempName = (Math.round(Math.random() * 100) + 1).toString();
  const tempFile = path.join(targetDir, tempName);
  const downloadUrl = releaseDownloadUrl();

  console.log(`Downloading from ${downloadUrl}; destination file ${tempFile}`);
  const resp = await fetch(downloadUrl);

  if (!resp.ok) {
    console.error("Couldn't download the server binary");
    console.error({ body: await resp.text() });
    return;
  }

  const contentLength = resp.headers.get('content-length');
  if (contentLength === null || Number.isNaN(contentLength)) {
    console.error(`Unexpected content-length: ${contentLength}`);
    return;
  }
  const totalBytes = Number.parseInt(contentLength);
  console.log(`The size of the binary is ${totalBytes} bytes`);

  let currentBytes = 0;
  let reportedPercent = 0;
  resp.body.on('data', (chunk) => {
    currentBytes = currentBytes + chunk.length;
    const currentPercent = Math.floor((currentBytes / totalBytes) * 100);
    if (currentPercent > reportedPercent) {
      onProgress(currentPercent);
      reportedPercent = currentPercent;
    }
  });

  const destStream = fs.createWriteStream(tempFile);
  const downloadProcess = promisify(stream.pipeline);
  await downloadProcess(resp.body, destStream);

  console.log(`Downloaded the binary to ${tempFile}`);
  fs.renameSync(tempFile, targetFile);
  await fs.promises.chmod(targetFile, 0o755);
}

async function downloadServerFromGH(context: ExtensionContext): Promise<ServerOptions | null> {
  const targetDir = path.join(context.storagePath, compatibleServerRelease);
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  const targetFile = path.join(targetDir, serverBinName());

  try {
    fs.statSync(targetFile);
    console.log('marksman binary is already downloaded');
  } catch {
    // The file doesn't exist. Continue to download
    await window.withProgress(
      {
        cancellable: false,
        title: `Downloading marksman ${compatibleServerRelease} from GH`,
      },
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      async (progress, _cancellationToken) => {
        let lastPercent = 0;
        await downloadRelease(targetDir, (percent) => {
          progress.report({ message: `${percent}%`, increment: percent - lastPercent });
          lastPercent = percent;
        });
      }
    );
  }

  const serverPath = targetFile;
  try {
    fs.statSync(targetFile);
    return {
      command: serverPath,
    };
  } catch {
    console.error('Failed to download marksman server binary');
    return null;
  }
}

async function findServerInPath(): Promise<string | null> {
  const binName = serverBinName();
  const inPath = new Promise<string>((resolve, reject) => {
    which(binName, (err, path) => {
      if (err) {
        reject(err);
      }
      if (path === undefined) {
        reject(new Error('which return undefined path'));
      } else {
        resolve(path);
      }
    });
  });

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const resolved = await inPath.catch((_) => null);
  return resolved;
}

function createClient(serverOptions: ServerOptions, clientOptions: LanguageClientOptions): LanguageClient {
  const client = new LanguageClient(extId, extName, serverOptions, clientOptions);
  configureClient(client);
  return client;
}

function configureClient(client: LanguageClient) {
  client.registerFeature(new ExperimentalFeatures());

  client.onReady().then(() => {
    console.log('Client onReady');

    client.onNotification(statusNotificationType, (statusParams) => {
      console.log('Got marksman/status notification');
      updateStatus(statusBarItem, statusParams);
    });
  });
  client.onDidChangeState((ev) => {
    if (ev.newState === State.Stopped) {
      updateStatus(statusBarItem, deadStatus);
    }
  });
}

function createDefaultStatus(): StatusBarItem {
  const item = window.createStatusBarItem(99);
  updateStatus(item, defaultStatus);
  return item;
}

function updateStatus(item: StatusBarItem, statusParams: StatusParams) {
  let status: string;
  if (statusParams.state === 'init') {
    status = '? MN';
  } else if (statusParams.state === 'ok') {
    status = `✓ MN (${statusParams.docCount})`;
  } else {
    status = '☠️ MN';
  }

  item.text = status;
}

async function stopClient(client: LanguageClient | null) {
  if (client) {
    await client.stop();
    client.outputChannel.dispose();
  }
}

export async function deactivate() {
  await stopClient(client);

  if (statusBarItem) {
    statusBarItem.hide();
  }
}
