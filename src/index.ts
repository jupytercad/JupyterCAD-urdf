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

import { addCommands, CommandIDs } from './command';
import { UrdfWorker, WORKER_ID } from './worker';
import formSchema from './schema.json';

/**
 * Initialization data for the jupytercad-urdf extension.
 */
const plugin: JupyterFrontEndPlugin<void> = {
  id: 'jupytercad-urdf:plugin',
  description:
    'A JupyterLab extension adding features like exporting jcad files to urdf.',
  autoStart: true,
  requires: [
    IJCadWorkerRegistryToken,
    IJCadFormSchemaRegistryToken,
    IJupyterCadDocTracker,
    IJCadExternalCommandRegistryToken,
    IMainMenu
  ],
  optional: [ISettingRegistry, ITranslator],
  activate: async (
    app: JupyterFrontEnd,
    workerRegistry: IJCadWorkerRegistry,
    schemaRegistry: IJCadFormSchemaRegistry,
    tracker: IJupyterCadTracker,
    externalCommandRegistry: IJCadExternalCommandRegistry,
    mainMenu: IMainMenu,
    settingRegistry?: ISettingRegistry,
    translator?: ITranslator
  ) => {
    console.log('JupyterLab extension jupytercad-urdf is activated!');

    translator = translator ?? nullTranslator;

    // Create and register the URDF worker
    const worker = new UrdfWorker();
    workerRegistry.registerWorker(WORKER_ID, worker);

    // Register the form schema for URDF export
    schemaRegistry.registerSchema('Post::UrdfExport', formSchema);

    // Add commands
    addCommands(app, tracker, translator);

    // Add the export command to the main "File" menu
    mainMenu.fileMenu.addGroup([{ command: CommandIDs.exportUrdf }], 100);

    // Register external command
    externalCommandRegistry.registerCommand({
      name: 'Export to URDF',
      id: CommandIDs.exportUrdf
    });

    if (settingRegistry) {
      settingRegistry
        .load(plugin.id)
        .then(settings => {
          console.log('jupytercad-urdf settings loaded:', settings.composite);
        })
        .catch(reason => {
          console.error('Failed to load settings for jupytercad-urdf.', reason);
        });
    }
  }
};

export default plugin;
