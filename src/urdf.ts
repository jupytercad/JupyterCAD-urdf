/**
 * Utility functions for generating URDF files.
 */

/**
 * Converts an axis-angle rotation to Roll, Pitch, Yaw Euler angles.
 * @param axis The rotation axis (3-element array).
 * @param angleInDegrees The rotation angle in degrees.
 * @returns An object with {r, p, y} values.
 */
function axisAngleToRpy(
  axis: number[],
  angleInDegrees: number
): { r: number; p: number; y: number } {
  const angle = angleInDegrees * (Math.PI / 180);

  const [ax, ay, az] = axis;
  const s = Math.sin(angle / 2);
  const c = Math.cos(angle / 2);
  const qx = ax * s;
  const qy = ay * s;
  const qz = az * s;
  const qw = c;

  const sinp = 2 * (qw * qy - qz * qx);

  let r: number, p: number, y: number;

  // Check for gimbal lock
  if (Math.abs(sinp) >= 1) {
    p = (Math.PI / 2) * Math.sign(sinp);
    r = 2 * Math.atan2(qx, qw);
    y = 0;
  } else {
    p = Math.asin(sinp);

    const sinr_cosp = 2 * (qw * qx + qy * qz);
    const cosr_cosp = 1 - 2 * (qx * qx + qy * qy);
    r = Math.atan2(sinr_cosp, cosr_cosp);

    const siny_cosp = 2 * (qw * qz + qx * qy);
    const cosy_cosp = 1 - 2 * (qy * qy + qz * qz);
    y = Math.atan2(siny_cosp, cosy_cosp);
  }

  return { r, p, y };
}

/**
 * Generates the URDF XML string from primitives and meshes.
 */
export function generateUrdf(
  primitives: { name: string; shape: string; params: any }[],
  meshes: { name: string; content: string; params: any }[],
  robotName: string
): string {
  let links = '';
  let materials = '';
  // Map to store color to material mappings
  const materialMap = new Map<string, string>();
  let materialIndex = 0;

  const getMaterialTags = (params: any): { main: string; ref: string } => {
    const color = params.Color;
    if (!color) {
      return { main: '', ref: '' };
    }
    if (materialMap.has(color)) {
      return { main: '', ref: `<material name="${materialMap.get(color)}"/>` };
    }
    const materialName = `mat_${materialIndex++}`;
    materialMap.set(color, materialName);

    // Basic hex to RGB conversion
    const r = parseInt(color.slice(1, 3), 16) / 255;
    const g = parseInt(color.slice(3, 5), 16) / 255;
    const b = parseInt(color.slice(5, 7), 16) / 255;

    const mainTag = `\n  <material name="${materialName}">\n    <color rgba="${r.toFixed(2)} ${g.toFixed(2)} ${b.toFixed(2)} 1.0"/>\n  </material>`;
    const refTag = `<material name="${materialName}"/>`;
    return { main: mainTag, ref: refTag };
  };

  // Generate links for primitive shapes
  for (const primitive of primitives) {
    const { name, shape, params } = primitive;
    const pos = params.Placement?.Position || [0, 0, 0];
    const rotAxis = params.Placement?.Axis || [0, 0, 1];
    const rotAngle = params.Placement?.Angle || 0;
    const rpy = axisAngleToRpy(rotAxis, rotAngle);

    const originTag = `<origin xyz="${pos[0]} ${pos[1]} ${pos[2]}" rpy="${rpy.r} ${rpy.p} ${rpy.y}" />`;
    const materialTags = getMaterialTags(params);
    materials += materialTags.main;
    let geometryTag = '';

    switch (shape) {
      case 'Part::Box':
        geometryTag = `<box size="${params.Length} ${params.Width} ${params.Height}"/>`;
        break;
      case 'Part::Cylinder':
        geometryTag = `<cylinder radius="${params.Radius}" length="${params.Height}"/>`;
        break;
      case 'Part::Sphere':
        geometryTag = `<sphere radius="${params.Radius}"/>`;
        break;
    }

    if (geometryTag) {
      links += `
  <link name="${name}">
    <visual>
      <geometry>
      ${geometryTag}
      </geometry>
      ${originTag}
      ${materialTags.ref}
    </visual>
  </link>
  `;
    }
  }

  // Generate links for mesh shapes
  for (const file of meshes) {
    const linkName = file.name.replace('.stl', '');
    const materialTags = getMaterialTags(file.params);
    materials += materialTags.main;
    links += `
  <link name="${linkName}">
    <visual>
      <geometry>
        <mesh filename="package://meshes/${file.name}" />
      </geometry>
      ${materialTags.ref}
    </visual>
  </link>
  `;
  }
  return `<robot name="${robotName}">${materials}${links}\n</robot>`;
}
