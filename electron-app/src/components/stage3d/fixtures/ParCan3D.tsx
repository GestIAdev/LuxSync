/**
 * 💡 PAR CAN 3D - WAVE 30
 * Componente especializado para focos PAR
 */

import React from 'react'
import { Fixture3D, Fixture3DProps } from './Fixture3D'

export interface ParCan3DProps extends Omit<Fixture3DProps, 'type'> {}

export const ParCan3D: React.FC<ParCan3DProps> = (props) => {
  return <Fixture3D {...props} type="par" />
}

export default ParCan3D
