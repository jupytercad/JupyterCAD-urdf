import {
  IJCadWorker,
  IJupyterCadTracker,
  IWorkerMessageBase,
  JCadWorkerSupportedFormat,
  WorkerAction
} from '@jupytercad/schema';
import { PromiseDelegate } from '@lumino/coreutils';
import { v4 as uuid } from 'uuid';

interface IExportJob {
  files: { name: string; content: string }[];
  total: number;
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
    const { jobId, totalFiles, Object: objectName } = jcObject.parameters;

    if (!jobId) {
      return;
    }

    if (!this._jobs.has(jobId)) {
      this._jobs.set(jobId, { files: [], total: totalFiles, jcObjects: [] });
    }

    const job = this._jobs.get(jobId)!;
    const stlFileName = `${objectName}.stl`;
    job.files.push({ name: stlFileName, content: postShape });
    job.jcObjects.push(jcObject.name);

    if (job.files.length === job.total) {
      this._packageAndDownload(job.files);
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
    files: { name: string; content: string }[]
  ): void {
    // NOTE: This will trigger a separate download for the URDF file and each mesh.
    // Your browser may ask for permission for each file.

    // 1. Generate and download the URDF file itself.
    const urdfContent = this._generateUrdf(files);
    const urdfBlob = new Blob([urdfContent], { type: 'application/xml' });
    this._downloadBlob(urdfBlob, 'robot.urdf');

    // 2. Download each STL mesh file.
    for (const file of files) {
      const stlBlob = new Blob([file.content], {
        type: 'application/octet-stream'
      });
      this._downloadBlob(stlBlob, file.name);
    }
  }

  private _generateUrdf(files: { name: string; content: string }[]): string {
    let links = '';
    for (const file of files) {
      const linkName = file.name.replace('.stl', '');
      links += `
      <link name="${linkName}">
        <visual>
          <geometry>
            <mesh filename="package://meshes/${file.name}" />
          </geometry>
        </visual>
        <collision>
          <geometry>
            <mesh filename="package://meshes/${file.name}" />
          </geometry>
        </collision>
      </link>`;
    }
    return `<robot name="myrobot">${links}\n</robot>`;
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
}

export namespace URDFWorker {
  export interface IOptions {
    tracker: IJupyterCadTracker;
  }
}
