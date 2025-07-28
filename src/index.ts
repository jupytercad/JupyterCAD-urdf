import {
  IJCadExternalCommandRegistry,
  IJCadExternalCommandRegistryToken,
  IJCadFormSchemaRegistry,
  IJCadFormSchemaRegistryToken,
  IJCadWorkerRegistry,
  IJCadWorkerRegistryToken,
  IJupyterCadDocTracker,
  IJupyterCadTracker
} from '@jupytercad/schema';
import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';
import { ITranslator, nullTranslator } from '@jupyterlab/translation';
import { CommandIDs, addCommands } from './command';
import formSchema from './schema.json';
import { URDFWorker } from './worker';
import { Contents } from '@jupyterlab/services';

/**
 * Initialization data for the jupytercad-urdf extension.
 */
const plugin: JupyterFrontEndPlugin<void> = {
  id: 'jupytercad-urdf:plugin',
  description: 'A JupyterCAD URDF export extension.',
  autoStart: true,
  requires: [
    IJCadWorkerRegistryToken,
    IJCadFormSchemaRegistryToken,
    IJupyterCadDocTracker,
    IJCadExternalCommandRegistryToken
  ],
  optional: [ITranslator],
  activate: (
    app: JupyterFrontEnd,
    workerRegistry: IJCadWorkerRegistry,
    schemaRegistry: IJCadFormSchemaRegistry,
    tracker: IJupyterCadTracker,
    externalCommandRegistry: IJCadExternalCommandRegistry,
    translator?: ITranslator
  ) => {
    console.log('JupyterLab extension jupytercad-urdf is activated!');

    translator = translator ?? nullTranslator;

    const WORKER_ID = 'jupytercad-urdf:worker';
    const contentsManager = app.serviceManager.contents;
    const worker = new URDFWorker({ tracker, contentsManager });

    workerRegistry.registerWorker(WORKER_ID, worker);
    schemaRegistry.registerSchema('Post::ExportURDF', formSchema);

    addCommands(app, tracker, translator);
    externalCommandRegistry.registerCommand({
      name: 'Export to URDF',
      id: CommandIDs.exportUrdf
    });
  }
};

export default plugin;

export interface IOptions {
  tracker: IJupyterCadTracker;
  contentsManager: Contents.IManager;
}
