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
import { IMainMenu } from '@jupyterlab/mainmenu';
import { ISettingRegistry } from '@jupyterlab/settingregistry';
import { ITranslator, nullTranslator } from '@jupyterlab/translation';
import { CommandIDs, addCommands } from './command';
import formSchema from './schema.json';
import { URDFWorker } from './worker';

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
  optional: [IMainMenu, ISettingRegistry, ITranslator],
  activate: (
    app: JupyterFrontEnd,
    workerRegistry: IJCadWorkerRegistry,
    schemaRegistry: IJCadFormSchemaRegistry,
    tracker: IJupyterCadTracker,
    externalCommandRegistry: IJCadExternalCommandRegistry,
    mainMenu?: IMainMenu | null,
    settingRegistry?: ISettingRegistry | null,
    translator?: ITranslator
  ) => {
    console.log('JupyterLab extension jupytercad-urdf is activated!');

    translator = translator ?? nullTranslator;

    const WORKER_ID = 'jupytercad-urdf:worker';
    const worker = new URDFWorker({ tracker });

    // We still need to register the worker and the schema for the Post objects
    workerRegistry.registerWorker(WORKER_ID, worker);
    schemaRegistry.registerSchema('Post::ExportSTL', formSchema);

    addCommands(app, tracker, translator);
    externalCommandRegistry.registerCommand({
      name: 'Export to URDF',
      id: CommandIDs.exportUrdf
    });
  }
};

export default plugin;
