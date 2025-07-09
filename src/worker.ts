import {
  IJCadWorker,
  IJupyterCadTracker,
  IWorkerMessageBase,
  JCadWorkerSupportedFormat,
  WorkerAction
} from '@jupytercad/schema';
import { PromiseDelegate } from '@lumino/coreutils';
import { v4 as uuid } from 'uuid';
import { generateUrdf } from './urdf'; // Import the new function

interface IExportJob {
  primitives: { name: string; shape: string; params: any }[];
  meshes: { name: string; content: string }[];
  total: number;
  received: number;
  jcObjects: string[];
}

export class URDFWorker implements IJCadWorker {
  constructor(options: URDFWorker.IOptions) {
    this._tracker = options.tracker;
  }

  shapeFormat = JCadWorkerSupportedFormat.STL;
  private _jobs = new Map<string, IExportJob>();

  get ready(): Promise<void> {
    this._ready.resolve();
    return this._ready.promise;
  }

  register(options: {
    messageHandler: ((msg: any) => void) | ((msg: any) => Promise<void>);
    thisArg?: any;
  }): string {
    const id = uuid();
    // Not used in this implementation
    return id;
  }

  unregister(id: string): void {
    // Not used in this implementation
  }

  postMessage(msg: IWorkerMessageBase): void {
    if (msg.action !== WorkerAction.POSTPROCESS) {
      return;
    }

    const payload = msg.payload;
    if (!payload || !payload.jcObject || !payload.postShape) {
      return;
    }

    const { jcObject, postShape } = payload;
    const {
      jobId,
      totalFiles,
      Object: objectName,
      isPrimitive,
      shape,
      shapeParams
    } = jcObject.parameters;

    if (!jobId) {
      return;
    }

    if (!this._jobs.has(jobId)) {
      this._jobs.set(jobId, {
        primitives: [],
        meshes: [],
        total: totalFiles,
        received: 0,
        jcObjects: []
      });
    }

    const job = this._jobs.get(jobId)!;
    job.received++;
    job.jcObjects.push(jcObject.name);

    if (isPrimitive) {
      job.primitives.push({
        name: objectName as string,
        shape: shape as string,
        params: JSON.parse(shapeParams as string)
      });
    } else {
      job.meshes.push({ name: `${objectName}.stl`, content: postShape });
    }

    if (job.received === job.total) {
      this._packageAndDownload(job.primitives, job.meshes);
      this._cleanup(job.jcObjects);
      this._jobs.delete(jobId);
    }
  }

  private _downloadBlob(blob: Blob, fileName: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  private _packageAndDownload(
    primitives: { name: string; shape: string; params: any }[],
    meshes: { name: string; content: string }[]
  ): void {
    // NOTE: This will trigger a separate download for the URDF file and each mesh.
    // Your browser may ask for permission for each file.

    // 1. Generate and download the URDF file itself.
    const urdfContent = generateUrdf(primitives, meshes); // Use the new function
    const urdfBlob = new Blob([urdfContent], { type: 'application/xml' });
    this._downloadBlob(urdfBlob, 'robot.urdf');

    // 2. Download each STL mesh file.
    for (const file of meshes) {
      const stlBlob = new Blob([file.content], {
        type: 'application/octet-stream'
      });
      this._downloadBlob(stlBlob, file.name);
    }
  }

  // This function is now gone from the worker!

  private _cleanup(objectNames: string[]): void {
    const currentWidget = this._tracker.currentWidget;
    if (!currentWidget) {
      return;
    }
    const sharedModel = currentWidget.model.sharedModel;
    if (sharedModel) {
      sharedModel.transact(() => {
        for (const name of objectNames) {
          if (sharedModel.objectExists(name)) {
            sharedModel.removeObjectByName(name);
          }
        }
      });
    }
  }

  private _ready = new PromiseDelegate<void>();
  private _tracker: IJupyterCadTracker;
}

export namespace URDFWorker {
  export interface IOptions {
    tracker: IJupyterCadTracker;
  }
}
