import {
  IJCadWorker,
  IJupyterCadTracker,
  IWorkerMessageBase,
  JCadWorkerSupportedFormat,
  WorkerAction
} from '@jupytercad/schema';
import { PromiseDelegate } from '@lumino/coreutils';
import { v4 as uuid } from 'uuid';

export class STLWorker implements IJCadWorker {
  constructor(options: STLWorker.IOptions) {
    console.log('STLWorker constructor called');
    // Resolve the ready promise immediately since we don't have async initialization
    this._ready.resolve();
  }

  shapeFormat = JCadWorkerSupportedFormat.STL;

  get ready(): Promise<void> {
    return this._ready.promise;
  }

  register(options: {
    messageHandler: ((msg: any) => void) | ((msg: any) => Promise<void>);
    thisArg?: any;
  }): string {
    const { messageHandler, thisArg } = options;
    const id = uuid();
    if (thisArg) {
      messageHandler.bind(thisArg);
    }
    this._messageHandlers.set(id, messageHandler);
    return id;
  }

  unregister(id: string): void {
    this._messageHandlers.delete(id);
  }

  postMessage(msg: IWorkerMessageBase): void {
    console.log('STLWorker received message:', msg);

    if (msg.action !== WorkerAction.POSTPROCESS) {
      console.log('Not a POSTPROCESS action, ignoring');
      return;
    }

    if (msg.payload && Object.keys(msg.payload).length > 0) {
      const jCadObject = msg.payload['jcObject'];
      const stlContent = msg.payload['postShape'];

      if (stlContent && typeof stlContent === 'string') {
        this._downloadSTL(jCadObject.name, stlContent);
      } else {
        console.error('No STL content received for object:', jCadObject.name);
      }
    }
  }

  private _downloadSTL(objectName: string, stlContent: string): void {
    console.log(`Downloading STL for object: ${objectName}`);
    console.log(`STL content length: ${stlContent.length}`);

    // Create a blob and download link
    const blob = new Blob([stlContent], {
      type: 'application/octet-stream'
    });
    const url = URL.createObjectURL(blob);

    // Create download link and trigger download
    const link = document.createElement('a');
    link.href = url;
    link.download = `${objectName.toLowerCase().replace(/[^a-z0-9]/g, '_')}.stl`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    console.log(`STL file exported successfully: ${link.download}`);
  }

  private _ready = new PromiseDelegate<void>();
  private _messageHandlers = new Map();
}

export namespace STLWorker {
  export interface IOptions {
    // I can remove this
    tracker: IJupyterCadTracker;
  }
}
