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
import { v4 as uuid } from 'uuid';
import formSchema from './schema.json';
import { exportIcon } from './icon';

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
    icon: exportIcon,
    isEnabled: () => Boolean(tracker.currentWidget),
    execute: Private.executeExportURDF(tracker)
  });
}

namespace Private {
  const urdfOperator = {
    title: 'Export to URDF',
    shape: 'Post::ExportSTL', // We still use the same Post operator type
    default: (model: IJupyterCadModel) => {
      return {
        Name: newName('URDF_Export', model),
        LinearDeflection: 0.01,
        AngularDeflection: 0.05
      };
    },
    syncData: (model: IJupyterCadModel) => {
      return (props: IDict) => {
        const { Name, ...parameters } = props;
        const sharedModel = model.sharedModel;
        if (!sharedModel) {
          return;
        }

        const objectsToExport = model
          .getAllObject()
          .filter(obj => obj.shape && !obj.shape.startsWith('Post::'));

        if (objectsToExport.length === 0) {
          showErrorMessage(
            'No objects to export',
            'The document has no geometric shapes to export.'
          );
          return;
        }

        const jobId = uuid();
        const exportObjects: IJCadObject[] = [];
        const filePath = model.filePath; // Get the current file path
        const primitiveShapes = ['Part::Box', 'Part::Cylinder', 'Part::Sphere'];

        for (const object of objectsToExport) {
          const isPrimitive =
            object.shape !== undefined &&
            primitiveShapes.includes(object.shape);

          // We still create a Post::ExportSTL object for every shape.
          // For primitives, the worker will simply ignore the generated STL
          // and use the parameters we pass here instead.
          const specificParams = {
            isPrimitive,
            // Pass primitive info only if it is one
            ...(isPrimitive && {
              shape: object.shape,
              shapeParams: JSON.stringify(object.parameters)
            })
          };

          const exportObjectName = newName(`${object.name}_STL_Export`, model);
          const objectModel = {
            shape: 'Post::ExportSTL',
            parameters: {
              ...parameters,
              Object: object.name,
              jobId,
              totalFiles: objectsToExport.length,
              filePath,
              ...specificParams // Add our new primitive-identifying parameters
            },
            visible: false, // Hide these temporary objects
            name: exportObjectName,
            shapeMetadata: {
              shapeFormat: JCadWorkerSupportedFormat.STL,
              workerId: 'jupytercad-urdf:worker'
            }
          };
          exportObjects.push(objectModel as IJCadObject);
        }

        sharedModel.transact(() => {
          for (const obj of exportObjects) {
            if (!sharedModel.objectExists(obj.name)) {
              sharedModel.addObject(obj);
            }
          }
        });
      };
    }
  };

  export function executeExportURDF(tracker: IJupyterCadTracker) {
    return async (args: any) => {
      const current = tracker.currentWidget;
      if (!current) {
        return;
      }

      const formJsonSchema = JSON.parse(JSON.stringify(formSchema));
      formJsonSchema['required'] = ['Name', ...formJsonSchema['required']];
      formJsonSchema['properties'] = {
        Name: { type: 'string', description: 'The Name of the export job' },
        ...formJsonSchema['properties']
      };

      const dialog = new FormDialog({
        model: current.model,
        title: urdfOperator.title,
        sourceData: urdfOperator.default(current.model),
        schema: formJsonSchema,
        syncData: urdfOperator.syncData(current.model),
        cancelButton: true
      });
      await dialog.launch();
    };
  }
}
