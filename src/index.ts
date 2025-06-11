import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

import { ISettingRegistry } from '@jupyterlab/settingregistry';

/**
 * Initialization data for the jupytercad-urdf extension.
 */
const plugin: JupyterFrontEndPlugin<void> = {
  id: 'jupytercad-urdf:plugin',
  description: 'A JupyterLab extension adding features like exporting jcad files to urdf.',
  autoStart: true,
  optional: [ISettingRegistry],
  activate: (app: JupyterFrontEnd, settingRegistry: ISettingRegistry | null) => {
    console.log('JupyterLab extension jupytercad-urdf is activated!');

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
