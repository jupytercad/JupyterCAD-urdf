/**
 * A collection of utility functions for generating URDF files.
 */

/**
 * Converts an axis-angle rotation to Roll, Pitch, Yaw Euler angles.
 * @param axis The rotation axis (3-element array).
 * @param angle The rotation angle in radians.
 * @returns An object with {r, p, y} values.
 */
function axisAngleToRpy(
  axis: number[],
  angle: number
): { r: number; p: number; y: number } {
  const [ax, ay, az] = axis;
  const s = Math.sin(angle / 2);
  const c = Math.cos(angle / 2);
  const qx = ax * s;
  const qy = ay * s;
  const qz = az * s;
  const qw = c;

  // Roll (x-axis rotation)
  const sinr_cosp = 2 * (qw * qx + qy * qz);
  const cosr_cosp = 1 - 2 * (qx * qx + qy * qy);
  const r = Math.atan2(sinr_cosp, cosr_cosp);

  // Pitch (y-axis rotation)
  const sinp = 2 * (qw * qy - qz * qx);
  let p;
  if (Math.abs(sinp) >= 1) {
    p = (Math.PI / 2) * Math.sign(sinp); // Use 90 degrees if out of range
  } else {
    p = Math.asin(sinp);
  }

  // Yaw (z-axis rotation)
  const siny_cosp = 2 * (qw * qz + qx * qy);
  const cosy_cosp = 1 - 2 * (qy * qy + qz * qz);
  const y = Math.atan2(siny_cosp, cosy_cosp);

  return { r, p, y };
}

/**
 * Generates the complete URDF XML string from primitives and meshes.
 */
export function generateUrdf(
  primitives: { name: string; shape: string; params: any }[],
  meshes: { name: string; content: string }[]
): string {
  let links = '';

  // Generate links for primitive shapes
  for (const primitive of primitives) {
    const { name, shape, params } = primitive;
    const pos = params.Placement?.Position || [0, 0, 0];
    const rotAxis = params.Placement?.Axis || [0, 0, 1];
    const rotAngle = params.Placement?.Angle || 0;
    const rpy = axisAngleToRpy(rotAxis, rotAngle);

    const originTag = `<origin xyz="${pos[0]} ${pos[1]} ${pos[2]}" rpy="${rpy.r} ${rpy.p} ${rpy.y}" />`;
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
      ${originTag}
      <geometry>${geometryTag}</geometry>
    </visual>
    <collision>
      ${originTag}
      <geometry>${geometryTag}</geometry>
    </collision>
  </link>`;
    }
  }

  // Generate links for mesh shapes
  for (const file of meshes) {
    const linkName = file.name.replace('.stl', '');
    links += `
  <link name="${linkName}">
    <visual>
      <geometry>
        <mesh filename="package://meshes/${file.name}" />
      </geometry>
    </visual>
    <collision>
      <geometry>
        <mesh filename="package://meshes/${file.name}" />
      </geometry>
    </collision>
  </link>`;
  }
  return `<robot name="myrobot">${links}\n</robot>`;
}
