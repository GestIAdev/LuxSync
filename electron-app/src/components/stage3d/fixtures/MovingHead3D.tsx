/**
 * 💡 MOVING HEAD 3D - WAVE 30
 * Componente especializado para cabezas móviles
 */

import React from 'react'
import { Fixture3D, Fixture3DProps } from './Fixture3D'

export interface MovingHead3DProps extends Omit<Fixture3DProps, 'type'> {}

export const MovingHead3D: React.FC<MovingHead3DProps> = (props) => {
  return <Fixture3D {...props} type="moving" />
}

export default MovingHead3D
