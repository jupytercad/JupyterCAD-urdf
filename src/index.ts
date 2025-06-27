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

    workerRegistry.registerWorker(WORKER_ID, worker);
    schemaRegistry.registerSchema('Post::ExportSTL', formSchema);

    addCommands(app, tracker, translator);
    externalCommandRegistry.registerCommand({
      name: 'Export to STL',
      id: CommandIDs.exportSTL
    });
  }
};

export default plugin;
