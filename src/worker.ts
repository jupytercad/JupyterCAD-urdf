import {
  IJCadWorker,
  IJupyterCadTracker,
  IWorkerMessageBase,
  JCadWorkerSupportedFormat,
  WorkerAction
} from '@jupytercad/schema';
import { showErrorMessage } from '@jupyterlab/apputils';
import { Contents } from '@jupyterlab/services';
import { PromiseDelegate } from '@lumino/coreutils';
import { v4 as uuid } from 'uuid';
import { generateUrdf } from './urdf';

interface IExportJob {
  primitives: { name: string; shape: string; params: any }[];
  meshes: { name: string; content: string; params: any }[];
  total: number;
  received: number;
  jcObjects: string[];
  filePath: string;
}

export class URDFWorker implements IJCadWorker {
  constructor(options: URDFWorker.IOptions) {
    this._tracker = options.tracker;
    this._contentsManager = options.contentsManager;
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
    return id;
  }

  unregister(id: string): void {
    // empty
  }

  postMessage(msg: IWorkerMessageBase): void {
    if (msg.action !== WorkerAction.POSTPROCESS) {
      return;
    }

    const payload = msg.payload;
    if (!payload || !payload.jcObject || payload.postShape === undefined) {
      return;
    }

    const { jcObject, postShape } = payload;
    const {
      jobId,
      totalFiles,
      Object: objectName,
      isPrimitive,
      shape,
      shapeParams,
      filePath
    } = jcObject.parameters;

    if (!jobId || !filePath) {
      return;
    }

    if (!this._jobs.has(jobId)) {
      this._jobs.set(jobId, {
        primitives: [],
        meshes: [],
        total: totalFiles,
        received: 0,
        jcObjects: [],
        filePath: filePath as string
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
      job.meshes.push({
        name: `${objectName}.stl`,
        content: postShape,
        params: jcObject.parameters
      });
    }

    if (job.received === job.total) {
      this._packageAndSave(job);
      this._cleanup(job.jcObjects);
      this._jobs.delete(jobId);
    }
  }

  private async _packageAndSave(job: IExportJob): Promise<void> {
    const { primitives, meshes, filePath } = job;

    const contentsManager = this._contentsManager;
    if (!contentsManager) {
      console.error(
        'FATAL: [worker.ts] ContentsManager was not provided to the worker.'
      );
      showErrorMessage(
        'URDF Export Failed',
        'ContentsManager not available in worker.'
      );
      return;
    }

    const pathParts = filePath.split('/');
    const docName = pathParts.pop() || 'untitled.jcad';
    const baseName = docName.substring(0, docName.lastIndexOf('.'));
    const dirPath = pathParts.join('/');

    const exportDirName = baseName;
    const exportDirPath = dirPath
      ? `${dirPath}/${exportDirName}`
      : exportDirName;

    const urdfFileName = `${baseName}.urdf`;
    const urdfPath = `${exportDirPath}/${urdfFileName}`;
    const meshesDirPath = `${exportDirPath}/meshes`;

    try {
      // Create main export directory if it doesn't exist
      try {
        await contentsManager.get(exportDirPath);
      } catch {
        await contentsManager
          .newUntitled({ path: dirPath, type: 'directory' })
          .then((model: Contents.IModel) =>
            contentsManager.rename(model.path, exportDirPath)
          );
      }

      // Create meshes directory if needed and it doesn't exist
      if (meshes.length > 0) {
        try {
          await contentsManager.get(meshesDirPath);
        } catch {
          await contentsManager
            .newUntitled({ path: exportDirPath, type: 'directory' })
            .then((model: Contents.IModel) =>
              contentsManager.rename(model.path, meshesDirPath)
            );
        }
      }

      // Save or overwrite the URDF file
      const urdfContent = generateUrdf(primitives, meshes, baseName);
      await contentsManager.save(urdfPath, {
        type: 'file',
        format: 'text',
        content: urdfContent
      });

      // Save or overwrite mesh files
      for (const file of meshes) {
        const stlPath = `${meshesDirPath}/${file.name}`;
        await contentsManager.save(stlPath, {
          type: 'file',
          format: 'text',
          content: file.content
        });
      }
    } catch (error) {
      console.error(
        'ERROR: [worker.ts] Failed during file save operation:',
        error
      );
      showErrorMessage('URDF Export Failed', error as string);
    }
  }

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
  private _contentsManager: Contents.IManager;
}

export namespace URDFWorker {
  export interface IOptions {
    tracker: IJupyterCadTracker;
    contentsManager: Contents.IManager;
  }
}
