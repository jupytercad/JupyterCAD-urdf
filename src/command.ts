import { FormDialog, newName } from '@jupytercad/base';
import {
  IDict,
  IJCadObject,
  IJupyterCadModel,
  IJupyterCadTracker,
  JCadWorkerSupportedFormat
} from '@jupytercad/schema';
import { JupyterFrontEnd } from '@jupyterlab/application';
import { showErrorMessage } from '@jupyterlab/apputils';
import { ITranslator } from '@jupyterlab/translation';

import { WORKER_ID } from './worker';
import formSchema from './schema.json';

export namespace CommandIDs {
  export const exportUrdf = 'jupytercad:urdf:export';
}

export function addCommands(
  app: JupyterFrontEnd,
  tracker: IJupyterCadTracker,
  translator: ITranslator
) {
  const trans = translator.load('jupyterlab');
  const { commands } = app;

  commands.addCommand(CommandIDs.exportUrdf, {
    label: trans.__('Export to URDF'),
    isEnabled: () => Boolean(tracker.currentWidget),
    execute: Private.executeUrdfExportFactory(tracker)
  });
}

namespace Private {
  const urdfExporter = {
    title: 'URDF Export Parameters',
    default: (model: IJupyterCadModel) => {
      const objects = model.getAllObject();
      const selected = model.localState?.selected?.value;
      let objectName = objects[0]?.name ?? '';

      if (selected) {
        for (const key in selected) {
          if (selected[key].type === 'shape') {
            objectName = key;
            break;
          }
        }
      }

      return {
        Name: newName('UrdfExport', model),
        Object: objectName,
        Mass: 1.0
      };
    },
    syncData: (model: IJupyterCadModel) => {
      return (props: IDict) => {
        const { Name, ...parameters } = props;
        const objectModel: IJCadObject = {
          shape: 'Post::UrdfExport' as any,
          parameters,
          visible: true,
          name: Name,
          shapeMetadata: {
            shapeFormat: JCadWorkerSupportedFormat.STL,
            workerId: WORKER_ID
          }
        };

        const sharedModel = model.sharedModel;
        if (sharedModel) {
          if (!sharedModel.objectExists(objectModel.name)) {
            sharedModel.addObject(objectModel);
          } else {
            showErrorMessage(
              'The object already exists',
              'There is an existing object with the same name.'
            );
          }
        }
      };
    }
  };

  export function executeUrdfExportFactory(tracker: IJupyterCadTracker) {
    return async (args: any) => {
      const current = tracker.currentWidget;
      if (!current) {
        return;
      }

      const formJsonSchema = JSON.parse(JSON.stringify(formSchema));
      formJsonSchema['required'] = ['Name', ...formJsonSchema['required']];
      formJsonSchema['properties'] = {
        Name: { type: 'string', description: 'The Name of the Export' },
        ...formJsonSchema['properties']
      };

      const dialog = new FormDialog({
        model: current.model,
        title: urdfExporter.title,
        sourceData: urdfExporter.default(current.model),
        schema: formJsonSchema,
        syncData: urdfExporter.syncData(current.model),
        cancelButton: true
      });

      await dialog.launch();
    };
  }
}
