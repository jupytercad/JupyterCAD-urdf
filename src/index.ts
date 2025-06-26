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
import { STLWorker } from './worker';

/**
 * Initialization data for the jupytercad-stl extension.
 */
const plugin: JupyterFrontEndPlugin<void> = {
  id: 'jupytercad-stl:plugin',
  description: 'A JupyterCAD STL export extension',
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
    console.log('JupyterLab extension jupytercad-stl is activated!');

    translator = translator ?? nullTranslator;

    const WORKER_ID = 'jupytercad-stl:worker';
    const worker = new STLWorker({ tracker });
    console.log('Created STLWorker:', worker);
    console.log('Worker shapeFormat:', worker.shapeFormat);

    workerRegistry.registerWorker(WORKER_ID, worker);
    console.log('Registered worker with ID:', WORKER_ID);

    // Let's also check if the worker is properly registered
    const allWorkers = workerRegistry.getAllWorkers();
    console.log('All registered workers:', allWorkers);
    allWorkers.forEach((worker, index) => {
      console.log(`Worker ${index}:`, {
        shapeFormat: worker.shapeFormat,
        ready: worker.ready,
        constructor: worker.constructor.name
      });
    });

    schemaRegistry.registerSchema('Post::ExportSTL', formSchema);

    addCommands(app, tracker, translator);
    externalCommandRegistry.registerCommand({
      name: 'Export to STL',
      id: CommandIDs.exportSTL
    });

    // Optionally add to main menu if available
    if (mainMenu) {
      mainMenu.fileMenu.addGroup([{ command: CommandIDs.exportSTL }], 100);
    }
  }
};

export default plugin;
