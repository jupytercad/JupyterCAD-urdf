import {
  IDisplayPost,
  IJCadObject,
  IJCadWorker,
  IPostOperatorInput,
  IPostResult,
  JCadWorkerSupportedFormat,
  MainAction,
  WorkerAction
} from '@jupytercad/schema';
import { PromiseDelegate } from '@lumino/coreutils';
import { v4 as uuid } from 'uuid';

export const WORKER_ID = 'jupytercad-urdf-worker';

export class UrdfWorker implements IJCadWorker {
  constructor() {
    this._ready.resolve();
  }

  get ready(): Promise<void> {
    return this._ready.promise;
  }

  shapeFormat = JCadWorkerSupportedFormat.STL;

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

  postMessage(msg: {
    id: string;
    action: WorkerAction;
    payload?: IPostOperatorInput;
  }): void {
    if (msg.action !== WorkerAction.POSTPROCESS) {
      return;
    }

    if (msg.payload) {
      const { jcObject, postShape } = msg.payload;
      if (!postShape) {
        return;
      }

      // Generate URDF from STL data
      const stlString =
        typeof postShape === 'string'
          ? postShape
          : new TextDecoder().decode(postShape);
      const urdfContent = this._generateUrdf(jcObject, stlString);

      const payload: {
        jcObject: IJCadObject;
        postResult: IPostResult;
      }[] = [
        {
          postResult: {
            format: 'STL',
            binary: false,
            value: urdfContent
          },
          jcObject
        }
      ];

      const handler: (msg: IDisplayPost) => void = this._messageHandlers.get(
        msg.id
      );
      if (handler) {
        handler({ action: MainAction.DISPLAY_POST, payload });
      }
    }
  }

  private _generateUrdf(jcObject: IJCadObject, stlContent: string): string {
    const objectName = jcObject.name || 'unnamed_object';
    const mass = jcObject.parameters?.Mass || 1.0;

    // Simple URDF template
    const urdf = `<?xml version="1.0"?>
  <robot name="${objectName}">
    <link name="${objectName}_link">
      <visual>
        <geometry>
          <mesh filename="${objectName}.stl"/>
        </geometry>
      </visual>
      <collision>
        <geometry>
          <mesh filename="${objectName}.stl"/>
        </geometry>
      </collision>
      <inertial>
        <mass value="${mass}"/>
        <inertia ixx="1.0" ixy="0.0" ixz="0.0" iyy="1.0" iyz="0.0" izz="1.0"/>
      </inertial>
    </link>
  </robot>`;

    return urdf;
  }

  private _ready = new PromiseDelegate<void>();
  private _messageHandlers = new Map();
}
