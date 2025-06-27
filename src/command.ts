import { FormDialog } from '@jupytercad/base';
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
import formSchema from './schema.json';
import { exportIcon } from './icon';

export namespace CommandIDs {
  export const exportSTL = 'jupytercad:stl:export';
}

export function addCommands(
  app: JupyterFrontEnd,
  tracker: IJupyterCadTracker,
  translator: ITranslator
) {
  const trans = translator.load('jupyterlab');
  const { commands } = app;
  commands.addCommand(CommandIDs.exportSTL, {
    label: trans.__('Export to STL'),
    icon: exportIcon,
    isEnabled: () => Boolean(tracker.currentWidget),
    execute: Private.executeExportSTL(tracker)
  });
}

namespace Private {
  const stlOperator = {
    title: 'Export to STL',
    shape: 'Post::ExportSTL',
    default: (model: IJupyterCadModel) => {
      const objects = model.getAllObject();
      const selected = model.localState?.selected?.value || {};
      const selectedObjectNames = Object.keys(selected);
      const selectedObjectName =
        selectedObjectNames.length > 0
          ? selectedObjectNames[0]
          : (objects[0]?.name ?? '');
      return {
        Name: selectedObjectName ? `${selectedObjectName}_STL` : 'STL_Export',
        Object: selectedObjectName,
        Quality: 'ultra',
        LinearDeflection: 0.001,
        AngularDeflection: 0.05
      };
    },
    syncData: (model: IJupyterCadModel) => {
      return (props: IDict) => {
        const { Name, ...parameters } = props;
        console.log(
          'JCadWorkerSupportedFormat.STL value:',
          JCadWorkerSupportedFormat.STL
        );
        console.log(
          'All JCadWorkerSupportedFormat values:',
          JCadWorkerSupportedFormat
        );
        const objectModel = {
          shape: 'Post::ExportSTL',
          parameters,
          visible: true,
          name: Name,
          shapeMetadata: {
            shapeFormat: JCadWorkerSupportedFormat.STL,
            workerId: 'jupytercad-stl:worker'
          }
        };
        console.log('Created objectModel:', objectModel);
        const sharedModel = model.sharedModel;
        if (sharedModel) {
          sharedModel.transact(() => {
            if (!sharedModel.objectExists(objectModel.name)) {
              sharedModel.addObject(objectModel as IJCadObject);
            } else {
              showErrorMessage(
                'The object already exists',
                'There is an existing object with the same name.'
              );
            }
          });
        }
      };
    }
  };

  export function executeExportSTL(tracker: IJupyterCadTracker) {
    return async (args: any) => {
      const current = tracker.currentWidget;

      if (!current) {
        return;
      }

      const formJsonSchema = JSON.parse(JSON.stringify(formSchema));
      formJsonSchema['required'] = ['Name', ...formJsonSchema['required']];

      const objects = current.model.getAllObject();
      const objectNames = objects.map(obj => obj.name);

      formJsonSchema['properties'] = {
        Name: { type: 'string', description: 'The Name of the Export Object' },
        ...formJsonSchema['properties']
      };

      formJsonSchema['properties']['Object']['enum'] = objectNames;

      const { ...props } = formJsonSchema;
      const dialog = new FormDialog({
        model: current.model,
        title: stlOperator.title,
        sourceData: stlOperator.default(current.model),
        schema: props,
        syncData: stlOperator.syncData(current.model),
        cancelButton: true
      });
      await dialog.launch();
    };
  }
}
